package application

import (
	"context"
	"errors"
	"testing"
	"time"

	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeTeamVipPlanResolver struct {
	plans map[string]paymentports.TeamVipPlan
}

func (f fakeTeamVipPlanResolver) ResolveTeamVipPlan(code string) (paymentports.TeamVipPlan, error) {
	plan, ok := f.plans[code]
	if !ok {
		return paymentports.TeamVipPlan{}, sharederror.New(sharederror.KindValidation, "球队会员套餐无效")
	}
	return plan, nil
}

type fakeTeamVipSettlement struct {
	store        *fakePaymentStore
	calls        int
	lastPlan     string
	lastDays     int
	lastCredits  int
	lastVerified paymentports.VerifiedPayment
}

func (f *fakeTeamVipSettlement) ApplyTeamVipPayment(_ context.Context, verified paymentports.VerifiedPayment, plan string, durationDays int, credits int) (paymentports.SettlementResult, error) {
	f.calls++
	f.lastPlan = plan
	f.lastDays = durationDays
	f.lastCredits = credits
	f.lastVerified = verified
	credited := f.store.order.Status != paymentdomain.StatusPaid
	if err := f.store.order.MarkPaid(verified.TransactionID, verified.PaidAt); err != nil {
		return paymentports.SettlementResult{}, err
	}
	return paymentports.SettlementResult{Order: f.store.order, Credited: credited}, nil
}

func defaultFakeTeamVipPlans() fakeTeamVipPlanResolver {
	return fakeTeamVipPlanResolver{
		plans: map[string]paymentports.TeamVipPlan{
			"once":    {Code: "once", Name: "单次体验", AmountCents: 900, DurationDays: 0, Credits: 1},
			"monthly": {Code: "monthly", Name: "月度会员", AmountCents: 1900, DurationDays: 30, Credits: 0},
			"yearly":  {Code: "yearly", Name: "年度会员", AmountCents: 9900, DurationDays: 365, Credits: 0},
		},
	}
}

func TestCreateTeamVipResolvesPlanAndCreatesJSAPIOrder(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{
		unified: paymentports.UnifiedOrderResult{
			PrepayID:   "prepay-vip-1",
			Parameters: paymentports.JSAPIParameters{Package: "prepay_id=prepay-vip-1"},
		},
	}
	vipSettlement := &fakeTeamVipSettlement{store: store}
	service := NewService(store, store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, store, fixedOrderNumbers{"PVIP20261123001"}, fixedClock{time.Unix(1000, 0)}).
		WithTeamVip(defaultFakeTeamVipPlans(), vipSettlement)

	result, err := service.CreateTeamVip(context.Background(), userActor(37), CreateTeamVipCommand{
		TeamID:   7,
		Plan:     "yearly",
		ClientIP: "127.0.0.1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Order.Kind != paymentdomain.KindTeamVip || result.Order.AmountCents != 9900 ||
		result.Order.TeamID == nil || *result.Order.TeamID != 7 ||
		result.Order.VipPlan == nil || *result.Order.VipPlan != "yearly" {
		t.Fatalf("unexpected order: %+v", result.Order)
	}
	if gateway.request.AmountCents != 9900 || gateway.request.OpenID != "openid-37" || gateway.request.Description != "球队会员-年度会员" {
		t.Fatalf("unexpected gateway request: %+v", gateway.request)
	}
}

func TestCreateTeamVipRejectsUnauthorizedInvalidPlanAndUnconfigured(t *testing.T) {
	store := newFakePaymentStore()
	unconfigured := NewService(store, store, store, &fakeGateway{}, store, store, allowTeams{}, fakeRegistrationFees{}, store, store, fixedOrderNumbers{"PVIP1"}, fixedClock{})
	if _, err := unconfigured.CreateTeamVip(context.Background(), userActor(37), CreateTeamVipCommand{TeamID: 7, Plan: "once"}); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("unconfigured err=%v, want internal", err)
	}

	service := NewService(store, store, store, &fakeGateway{}, store, store, denyMemberTeams{}, fakeRegistrationFees{}, store, store, fixedOrderNumbers{"PVIP2"}, fixedClock{}).
		WithTeamVip(defaultFakeTeamVipPlans(), &fakeTeamVipSettlement{store: store})
	if _, err := service.CreateTeamVip(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, CreateTeamVipCommand{TeamID: 7, Plan: "once"}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("admin err=%v, want forbidden", err)
	}
	if _, err := service.CreateTeamVip(context.Background(), userActor(37), CreateTeamVipCommand{TeamID: 7, Plan: "once"}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("non-member err=%v, want forbidden", err)
	}

	memberService := NewService(store, store, store, &fakeGateway{}, store, store, allowTeams{}, fakeRegistrationFees{}, store, store, fixedOrderNumbers{"PVIP3"}, fixedClock{}).
		WithTeamVip(defaultFakeTeamVipPlans(), &fakeTeamVipSettlement{store: store})
	if _, err := memberService.CreateTeamVip(context.Background(), userActor(37), CreateTeamVipCommand{TeamID: 7, Plan: "invalid"}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid plan err=%v, want validation", err)
	}
}

func TestSettleTeamVipCoversSyncAndWebhookNotification(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	store := newFakePaymentStore()
	order, err := paymentdomain.NewTeamVipOrder("PVIP20261123002", 37, 7, "monthly", 1900, now)
	if err != nil {
		t.Fatal(err)
	}
	store.order = order
	gateway := &fakeGateway{
		query: paymentports.ProviderPayment{
			OrderNo: order.OrderNo, AmountCents: 1900, TransactionID: "wx-vip-1", PaidAt: now.Add(time.Minute), Paid: true,
		},
		notification: paymentports.ProviderPayment{
			OrderNo: order.OrderNo, AmountCents: 1900, TransactionID: "wx-vip-1", PaidAt: now.Add(time.Minute), Paid: true,
		},
	}
	vipSettlement := &fakeTeamVipSettlement{store: store}
	service := NewService(store, store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, store, fixedOrderNumbers{}, fixedClock{now}).
		WithTeamVip(defaultFakeTeamVipPlans(), vipSettlement)

	// Sync 触发核销。
	first, err := service.Sync(context.Background(), userActor(37), order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if !first.Credited || first.Order.Status != paymentdomain.StatusPaid ||
		vipSettlement.lastPlan != "monthly" || vipSettlement.lastDays != 30 || vipSettlement.lastCredits != 0 {
		t.Fatalf("first=%+v settlement=%+v", first, vipSettlement)
	}

	// 微信回调重放走同一条核销路由，幂等返回 Credited=false。
	second, err := service.HandleNotification(context.Background(), []byte("<xml/>"))
	if err != nil {
		t.Fatal(err)
	}
	if second.Credited || second.Order.Status != paymentdomain.StatusPaid || vipSettlement.calls != 2 {
		t.Fatalf("second=%+v calls=%d", second, vipSettlement.calls)
	}
}

type denyMemberTeams struct{}

func (denyMemberTeams) EnsureManager(context.Context, int64, int64) error {
	return sharederror.ErrForbidden
}
func (denyMemberTeams) EnsureActiveMember(context.Context, int64, int64) error {
	return sharederror.ErrForbidden
}
func (denyMemberTeams) EnsureExists(context.Context, int64) error {
	return nil
}
