package wechatv2

import (
	"context"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
)

const testAPIKey = "test-api-key"

func TestSignUsesWechatV2SortedMD5(t *testing.T) {
	params := Values{"b": "2", "a": "1", "empty": "", "sign": "ignored"}
	if got, want := sign(params, "key"), "735A0BAFC42420A9B223CE31415E043A"; got != want {
		t.Fatalf("sign()=%q, want %q", got, want)
	}
}

func TestUnifiedOrderReturnsSignedMiniProgramParameters(t *testing.T) {
	server := signedServer(t, func(t *testing.T, request Values) Values {
		if request["trade_type"] != "JSAPI" || request["openid"] != "openid-37" || request["total_fee"] != "1" {
			t.Fatalf("request=%v", request)
		}
		return Values{"return_code": "SUCCESS", "result_code": "SUCCESS", "appid": "app-1", "mch_id": "mch-1", "nonce_str": "response-nonce", "prepay_id": "prepay-1", "trade_type": "JSAPI"}
	})
	client := newTestClient(t, server.URL)

	result, err := client.UnifiedOrder(context.Background(), paymentports.UnifiedOrderRequest{OrderNo: "P1", AmountCents: 1, Description: "充值", ClientIP: "127.0.0.1", OpenID: "openid-37"})
	if err != nil {
		t.Fatal(err)
	}
	if result.PrepayID != "prepay-1" || result.Parameters.Package != "prepay_id=prepay-1" || result.Parameters.PaySign == "" {
		t.Fatalf("result=%+v", result)
	}
}

func TestUnifiedOrderRejectsInvalidResponseSignature(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeXML(t, w, Values{"return_code": "SUCCESS", "result_code": "SUCCESS", "appid": "app-1", "mch_id": "mch-1", "prepay_id": "prepay-1", "sign": "BAD"})
	}))
	defer server.Close()
	client := newTestClient(t, server.URL)

	_, err := client.UnifiedOrder(context.Background(), paymentports.UnifiedOrderRequest{OrderNo: "P1", AmountCents: 1, Description: "充值", ClientIP: "127.0.0.1", OpenID: "openid-37"})
	if !errors.Is(err, paymentports.ErrProviderUnavailable) {
		t.Fatalf("UnifiedOrder() error=%v", err)
	}
}

func TestQueryOrderMapsSuccessfulTrade(t *testing.T) {
	server := signedServer(t, func(t *testing.T, request Values) Values {
		if request["out_trade_no"] != "P1" {
			t.Fatalf("request=%v", request)
		}
		return Values{
			"return_code": "SUCCESS", "result_code": "SUCCESS", "appid": "app-1", "mch_id": "mch-1",
			"trade_state": "SUCCESS", "out_trade_no": "P1", "transaction_id": "wx-1", "total_fee": "88", "time_end": "20260809153045",
		}
	})
	client := newTestClient(t, server.URL)

	result, err := client.QueryOrder(context.Background(), "P1")
	if err != nil {
		t.Fatal(err)
	}
	if !result.Paid || result.AmountCents != 88 || result.TransactionID != "wx-1" || result.PaidAt.IsZero() {
		t.Fatalf("result=%+v", result)
	}
}

func TestCloseOrderMapsOrderPaidAndSystemError(t *testing.T) {
	for name, test := range map[string]struct {
		errCode string
		want    paymentports.CloseOutcome
		wantErr error
	}{
		"paid":   {errCode: "ORDERPAID", want: paymentports.CloseOutcomePaid},
		"system": {errCode: "SYSTEMERROR", wantErr: paymentports.ErrProviderUnavailable},
	} {
		t.Run(name, func(t *testing.T) {
			server := signedServer(t, func(*testing.T, Values) Values {
				return Values{"return_code": "SUCCESS", "result_code": "FAIL", "appid": "app-1", "mch_id": "mch-1", "err_code": test.errCode}
			})
			client := newTestClient(t, server.URL)
			got, err := client.CloseOrder(context.Background(), "P1")
			server.Close()
			if !errors.Is(err, test.wantErr) || got != test.want {
				t.Fatalf("CloseOrder()=(%q,%v), want (%q,%v)", got, err, test.want, test.wantErr)
			}
		})
	}
}

func TestParseNotificationVerifiesMerchantAndSignature(t *testing.T) {
	client := newTestClient(t, "http://unused")
	values := Values{
		"return_code": "SUCCESS", "result_code": "SUCCESS", "appid": "app-1", "mch_id": "mch-1",
		"out_trade_no": "P1", "transaction_id": "wx-1", "total_fee": "99", "time_end": "20260809153045",
	}
	values["sign"] = sign(values, testAPIKey)
	body, err := xml.Marshal(values)
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.ParseNotification(body)
	if err != nil {
		t.Fatal(err)
	}
	if result.OrderNo != "P1" || result.AmountCents != 99 || !result.Paid {
		t.Fatalf("result=%+v", result)
	}

	values["mch_id"] = "another-merchant"
	values["sign"] = sign(values, testAPIKey)
	body, _ = xml.Marshal(values)
	if _, err := client.ParseNotification(body); !errors.Is(err, paymentports.ErrProviderRejected) {
		t.Fatalf("wrong merchant error=%v", err)
	}
}

func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()
	client, err := NewClient(http.DefaultClient, Config{
		AppID: "app-1", MerchantID: "mch-1", APIKey: testAPIKey, BaseURL: baseURL,
		NotifyURL: "https://example.com/api/v1/webhooks/wechat-pay",
		Nonce:     func() string { return "fixed-nonce" }, Now: func() time.Time { return time.Unix(100, 0) },
	})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func signedServer(t *testing.T, response func(*testing.T, Values) Values) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		var request Values
		if err := xml.Unmarshal(body, &request); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if !verify(request, testAPIKey) {
			t.Fatalf("invalid request signature: %v", request)
		}
		values := response(t, request)
		values["sign"] = sign(values, testAPIKey)
		writeXML(t, w, values)
	}))
}

func writeXML(t *testing.T, w http.ResponseWriter, values Values) {
	t.Helper()
	w.Header().Set("Content-Type", "application/xml")
	if err := xml.NewEncoder(w).Encode(values); err != nil {
		t.Fatal(err)
	}
}
