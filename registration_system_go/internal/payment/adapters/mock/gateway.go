package mock

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
)

type mockOrder struct {
	request     paymentports.UnifiedOrderRequest
	paidAt      time.Time
	transaction string
	closed      bool
}

type Gateway struct {
	mu     sync.Mutex
	appID  string
	now    func() time.Time
	orders map[string]*mockOrder
}

func NewGateway(appID string, now func() time.Time) *Gateway {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return &Gateway{appID: appID, now: now, orders: make(map[string]*mockOrder)}
}

func (g *Gateway) UnifiedOrder(_ context.Context, request paymentports.UnifiedOrderRequest) (paymentports.UnifiedOrderResult, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if request.OrderNo == "" || request.AmountCents < 1 || request.OpenID == "" {
		return paymentports.UnifiedOrderResult{}, paymentports.ErrProviderRejected
	}
	if _, exists := g.orders[request.OrderNo]; exists {
		return paymentports.UnifiedOrderResult{}, paymentports.ErrProviderRejected
	}
	g.orders[request.OrderNo] = &mockOrder{request: request}
	prepayID := "mock-prepay-" + request.OrderNo
	timestamp := strconv.FormatInt(g.now().Unix(), 10)
	return paymentports.UnifiedOrderResult{
		PrepayID: prepayID,
		Parameters: paymentports.JSAPIParameters{
			AppID: g.appID, TimeStamp: timestamp, NonceStr: "mock-nonce-" + request.OrderNo,
			// PaySign 哨兵值与小程序端 isMockWxPaymentParams 的识别约定保持一致。
			Package: "prepay_id=" + prepayID, SignType: "MD5", PaySign: "mock_sign_for_testing",
		},
	}, nil
}

func (g *Gateway) QueryOrder(_ context.Context, orderNo string) (paymentports.ProviderPayment, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	order, exists := g.orders[orderNo]
	if !exists {
		return paymentports.ProviderPayment{}, paymentports.ErrProviderRejected
	}
	if order.closed {
		return paymentports.ProviderPayment{OrderNo: orderNo}, nil
	}
	if order.transaction == "" {
		order.paidAt = g.now()
		order.transaction = "mock-wx-" + orderNo
	}
	return paymentports.ProviderPayment{
		OrderNo: orderNo, AmountCents: order.request.AmountCents, TransactionID: order.transaction,
		PaidAt: order.paidAt, Paid: true,
	}, nil
}

func (g *Gateway) CloseOrder(_ context.Context, orderNo string) (paymentports.CloseOutcome, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	order, exists := g.orders[orderNo]
	if !exists {
		return "", paymentports.ErrProviderRejected
	}
	if order.transaction != "" {
		return paymentports.CloseOutcomePaid, nil
	}
	order.closed = true
	return paymentports.CloseOutcomeClosed, nil
}

func (g *Gateway) ParseNotification([]byte) (paymentports.ProviderPayment, error) {
	return paymentports.ProviderPayment{}, fmt.Errorf("mock gateway does not accept webhooks: %w", paymentports.ErrProviderRejected)
}
