package mock

import (
	"context"
	"testing"
	"time"

	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
)

func TestGatewayStaysPendingUntilQueryThenReturnsStablePayment(t *testing.T) {
	gateway := NewGateway("app-1", func() time.Time { return time.Unix(100, 0) })
	created, err := gateway.UnifiedOrder(context.Background(), paymentports.UnifiedOrderRequest{OrderNo: "P1", AmountCents: 1, OpenID: "openid"})
	if err != nil {
		t.Fatal(err)
	}
	if created.PrepayID == "" {
		t.Fatalf("created=%+v", created)
	}
	first, err := gateway.QueryOrder(context.Background(), "P1")
	if err != nil {
		t.Fatal(err)
	}
	second, err := gateway.QueryOrder(context.Background(), "P1")
	if err != nil {
		t.Fatal(err)
	}
	if !first.Paid || first.TransactionID == "" || first.TransactionID != second.TransactionID {
		t.Fatalf("first=%+v second=%+v", first, second)
	}
}

func TestGatewayCanCloseBeforeSync(t *testing.T) {
	gateway := NewGateway("app-1", time.Now)
	_, _ = gateway.UnifiedOrder(context.Background(), paymentports.UnifiedOrderRequest{OrderNo: "P1", AmountCents: 1, OpenID: "openid"})
	outcome, err := gateway.CloseOrder(context.Background(), "P1")
	if err != nil || outcome != paymentports.CloseOutcomeClosed {
		t.Fatalf("CloseOrder()=(%q,%v)", outcome, err)
	}
}
