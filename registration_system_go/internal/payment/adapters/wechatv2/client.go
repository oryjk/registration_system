package wechatv2

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
)

const maxResponseBytes = 1 << 20

type Config struct {
	AppID      string
	MerchantID string
	APIKey     string
	BaseURL    string
	NotifyURL  string
	Nonce      func() string
	Now        func() time.Time
}

type Client struct {
	httpClient *http.Client
	config     Config
}

func NewClient(httpClient *http.Client, config Config) (*Client, error) {
	config.AppID = strings.TrimSpace(config.AppID)
	config.MerchantID = strings.TrimSpace(config.MerchantID)
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	config.NotifyURL = strings.TrimSpace(config.NotifyURL)
	if httpClient == nil || config.AppID == "" || config.MerchantID == "" || config.APIKey == "" || config.BaseURL == "" || config.NotifyURL == "" {
		return nil, fmt.Errorf("incomplete WeChat Pay V2 configuration")
	}
	if _, err := url.ParseRequestURI(config.BaseURL); err != nil {
		return nil, fmt.Errorf("invalid WeChat Pay base URL: %w", err)
	}
	notify, err := url.Parse(config.NotifyURL)
	if err != nil || notify.Scheme == "" || notify.Host == "" {
		return nil, fmt.Errorf("invalid WeChat Pay notify URL")
	}
	if config.Nonce == nil {
		config.Nonce = randomNonce
	}
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	return &Client{httpClient: httpClient, config: config}, nil
}

func (c *Client) UnifiedOrder(ctx context.Context, request paymentports.UnifiedOrderRequest) (paymentports.UnifiedOrderResult, error) {
	values := c.baseRequest()
	values["body"] = request.Description
	values["out_trade_no"] = request.OrderNo
	values["total_fee"] = strconv.FormatInt(request.AmountCents, 10)
	values["spbill_create_ip"] = request.ClientIP
	values["notify_url"] = c.config.NotifyURL
	values["trade_type"] = "JSAPI"
	values["openid"] = request.OpenID
	values["sign_type"] = "MD5"
	response, err := c.post(ctx, "/pay/unifiedorder", values)
	if err != nil {
		return paymentports.UnifiedOrderResult{}, err
	}
	if err := c.validateSuccess(response); err != nil {
		return paymentports.UnifiedOrderResult{}, err
	}
	prepayID := strings.TrimSpace(response["prepay_id"])
	if prepayID == "" || response["trade_type"] != "JSAPI" {
		return paymentports.UnifiedOrderResult{}, providerUnavailable("invalid unified order response", nil)
	}
	parameters := paymentports.JSAPIParameters{
		AppID: c.config.AppID, TimeStamp: strconv.FormatInt(c.config.Now().Unix(), 10),
		NonceStr: c.config.Nonce(), Package: "prepay_id=" + prepayID, SignType: "MD5",
	}
	parameters.PaySign = sign(Values{
		"appId": parameters.AppID, "timeStamp": parameters.TimeStamp, "nonceStr": parameters.NonceStr,
		"package": parameters.Package, "signType": parameters.SignType,
	}, c.config.APIKey)
	return paymentports.UnifiedOrderResult{PrepayID: prepayID, Parameters: parameters}, nil
}

func (c *Client) QueryOrder(ctx context.Context, orderNo string) (paymentports.ProviderPayment, error) {
	orderNo = strings.TrimSpace(orderNo)
	values := c.baseRequest()
	values["out_trade_no"] = orderNo
	response, err := c.post(ctx, "/pay/orderquery", values)
	if err != nil {
		return paymentports.ProviderPayment{}, err
	}
	if err := c.validateSuccess(response); err != nil {
		return paymentports.ProviderPayment{}, err
	}
	if response["out_trade_no"] != orderNo {
		return paymentports.ProviderPayment{}, providerUnavailable("WeChat order query identity mismatch", nil)
	}
	result := paymentports.ProviderPayment{OrderNo: response["out_trade_no"]}
	if response["trade_state"] != "SUCCESS" {
		return result, nil
	}
	return providerPayment(response)
}

func (c *Client) CloseOrder(ctx context.Context, orderNo string) (paymentports.CloseOutcome, error) {
	values := c.baseRequest()
	values["out_trade_no"] = strings.TrimSpace(orderNo)
	response, err := c.post(ctx, "/pay/closeorder", values)
	if err != nil {
		return "", err
	}
	if response["return_code"] != "SUCCESS" {
		return "", providerError(response)
	}
	if err := c.validateIdentity(response); err != nil {
		return "", err
	}
	if response["result_code"] == "SUCCESS" || response["err_code"] == "ORDERCLOSED" {
		return paymentports.CloseOutcomeClosed, nil
	}
	switch response["err_code"] {
	case "ORDERPAID":
		return paymentports.CloseOutcomePaid, nil
	case "SYSTEMERROR":
		return "", providerUnavailable("WeChat close order system error", nil)
	default:
		return "", providerRejected("WeChat close order rejected", nil)
	}
}

func (c *Client) ParseNotification(body []byte) (paymentports.ProviderPayment, error) {
	if len(body) == 0 || len(body) > maxResponseBytes {
		return paymentports.ProviderPayment{}, providerRejected("invalid notification size", nil)
	}
	var values Values
	if err := xml.Unmarshal(body, &values); err != nil {
		return paymentports.ProviderPayment{}, providerRejected("malformed notification XML", err)
	}
	if !verify(values, c.config.APIKey) {
		return paymentports.ProviderPayment{}, providerRejected("invalid notification signature", nil)
	}
	if err := c.validateIdentity(values); err != nil {
		return paymentports.ProviderPayment{}, err
	}
	if values["return_code"] != "SUCCESS" || values["result_code"] != "SUCCESS" {
		return paymentports.ProviderPayment{}, providerRejected("unsuccessful payment notification", nil)
	}
	return providerPayment(values)
}

func (c *Client) baseRequest() Values {
	values := Values{"appid": c.config.AppID, "mch_id": c.config.MerchantID, "nonce_str": c.config.Nonce()}
	return values
}

func (c *Client) post(ctx context.Context, path string, values Values) (Values, error) {
	values["sign"] = sign(values, c.config.APIKey)
	body, err := xml.Marshal(values)
	if err != nil {
		return nil, providerUnavailable("encode WeChat request", err)
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, providerUnavailable("create WeChat request", err)
	}
	httpRequest.Header.Set("Content-Type", "application/xml; charset=utf-8")
	response, err := c.httpClient.Do(httpRequest)
	if err != nil {
		return nil, providerUnavailable("call WeChat Pay", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, providerUnavailable("WeChat Pay returned non-2xx", nil)
	}
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil || len(responseBody) > maxResponseBytes {
		return nil, providerUnavailable("read WeChat response", err)
	}
	var result Values
	if err := xml.Unmarshal(responseBody, &result); err != nil {
		return nil, providerUnavailable("decode WeChat response", err)
	}
	if !verify(result, c.config.APIKey) {
		return nil, providerUnavailable("invalid WeChat response signature", nil)
	}
	return result, nil
}

func (c *Client) validateSuccess(values Values) error {
	if values["return_code"] != "SUCCESS" || values["result_code"] != "SUCCESS" {
		return providerError(values)
	}
	return c.validateIdentity(values)
}

func (c *Client) validateIdentity(values Values) error {
	if values["appid"] != c.config.AppID || values["mch_id"] != c.config.MerchantID {
		return providerRejected("WeChat merchant identity mismatch", nil)
	}
	return nil
}

func providerPayment(values Values) (paymentports.ProviderPayment, error) {
	amount, err := strconv.ParseInt(values["total_fee"], 10, 64)
	if err != nil || amount < 1 || values["out_trade_no"] == "" || values["transaction_id"] == "" {
		return paymentports.ProviderPayment{}, providerRejected("invalid paid order fields", err)
	}
	paidAt, err := parseWechatTime(values["time_end"])
	if err != nil {
		return paymentports.ProviderPayment{}, providerRejected("invalid payment time", err)
	}
	return paymentports.ProviderPayment{
		OrderNo: values["out_trade_no"], AmountCents: amount, TransactionID: values["transaction_id"],
		PaidAt: paidAt, Paid: true,
	}, nil
}

func parseWechatTime(value string) (time.Time, error) {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.FixedZone("CST", 8*60*60)
	}
	return time.ParseInLocation("20060102150405", value, location)
}

func providerError(values Values) error {
	if values["err_code"] == "SYSTEMERROR" {
		return providerUnavailable("WeChat Pay system error", nil)
	}
	return providerRejected("WeChat Pay rejected request", nil)
}

func providerUnavailable(message string, cause error) error {
	return fmt.Errorf("%s: %w", message, errors.Join(paymentports.ErrProviderUnavailable, cause))
}

func providerRejected(message string, cause error) error {
	return fmt.Errorf("%s: %w", message, errors.Join(paymentports.ErrProviderRejected, cause))
}

func randomNonce() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(buffer)
}
