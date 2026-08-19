package application

import (
	"context"

	"errors"
	"github.com/google/uuid"
	"testing"
	"time"

	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestCreateRechargeUsesAuthenticatedUsersOpenID(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{unified: paymentports.UnifiedOrderResult{PrepayID: "prepay-1", Parameters: paymentports.JSAPIParameters{Package: "prepay_id=prepay-1"}}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{"P202608090001"}, fixedClock{time.Unix(100, 0)})

	result, err := service.CreateRecharge(context.Background(), userActor(37), CreateRechargeCommand{AmountCents: 1, ClientIP: "127.0.0.1"})
	if err != nil {
		t.Fatal(err)
	}
	if gateway.request.OpenID != "openid-37" || result.Order.Status != paymentdomain.StatusPending || result.Payment.Package != "prepay_id=prepay-1" {
		t.Fatalf("result=%+v request=%+v", result, gateway.request)
	}
	if store.order.PrepayID != "prepay-1" {
		t.Fatalf("stored order = %+v", store.order)
	}
}

func TestCreateRechargeRejectsNonUserAndZeroAmount(t *testing.T) {
	service := NewService(newFakePaymentStore(), newFakePaymentStore(), &fakeGateway{}, newFakePaymentStore(), newFakePaymentStore(), allowTeams{}, fakeRegistrationFees{}, newFakePaymentStore(), fixedOrderNumbers{"P1"}, fixedClock{})
	if _, err := service.CreateRecharge(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, CreateRechargeCommand{AmountCents: 1}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("admin error=%v", err)
	}
	if _, err := service.CreateRecharge(context.Background(), userActor(37), CreateRechargeCommand{}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("zero amount error=%v", err)
	}
}

func TestListRejectsInvalidPaymentStatus(t *testing.T) {
	store := newFakePaymentStore()
	service := NewService(store, store, &fakeGateway{}, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	_, err := service.List(context.Background(), userActor(37), ListQuery{Status: paymentdomain.Status("unknown")})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("List() error=%v, want validation", err)
	}
}

func TestSyncPaidOrderCreditsWalletOnce(t *testing.T) {
	store := newFakePaymentStore()
	store.order = mustOrder(t, "P202608090002", 37, 500)
	gateway := &fakeGateway{query: paymentports.ProviderPayment{OrderNo: store.order.OrderNo, AmountCents: 500, TransactionID: "wx-1", PaidAt: time.Unix(200, 0), Paid: true}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	first, err := service.Sync(context.Background(), userActor(37), store.order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.Sync(context.Background(), userActor(37), store.order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if first.Order.Status != paymentdomain.StatusPaid || first.BalanceCents != 500 || second.BalanceCents != 500 || store.creditCalls != 2 {
		t.Fatalf("first=%+v second=%+v calls=%d", first, second, store.creditCalls)
	}
}

func TestGetRejectsAnotherUsersOrder(t *testing.T) {
	store := newFakePaymentStore()
	store.order = mustOrder(t, "P202608090003", 37, 100)
	service := NewService(store, store, &fakeGateway{}, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})
	if _, err := service.Get(context.Background(), userActor(38), store.order.OrderNo); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("Get() error=%v, want not found", err)
	}
}

func TestCancelClosesProviderOrderBeforeLocalCancellation(t *testing.T) {
	store := newFakePaymentStore()
	store.order = mustOrder(t, "P202608090004", 37, 100)
	gateway := &fakeGateway{close: paymentports.CloseOutcomeClosed}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{time.Unix(300, 0)})

	order, err := service.Cancel(context.Background(), userActor(37), store.order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if !gateway.closeCalled || order.Status != paymentdomain.StatusCancelled {
		t.Fatalf("close=%v order=%+v", gateway.closeCalled, order)
	}
}

func TestCancelOrderPaidSettlesInsteadOfCancelling(t *testing.T) {
	store := newFakePaymentStore()
	store.order = mustOrder(t, "P202608090005", 37, 100)
	gateway := &fakeGateway{
		close: paymentports.CloseOutcomePaid,
		query: paymentports.ProviderPayment{OrderNo: store.order.OrderNo, AmountCents: 100, TransactionID: "wx-2", PaidAt: time.Unix(400, 0), Paid: true},
	}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	order, err := service.Cancel(context.Background(), userActor(37), store.order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if order.Status != paymentdomain.StatusPaid || store.balance != 100 {
		t.Fatalf("order=%+v balance=%d", order, store.balance)
	}
}

func TestHandleNotificationUsesSameSettlement(t *testing.T) {
	store := newFakePaymentStore()
	store.order = mustOrder(t, "P202608090006", 37, 88)
	gateway := &fakeGateway{notification: paymentports.ProviderPayment{OrderNo: store.order.OrderNo, AmountCents: 88, TransactionID: "wx-3", PaidAt: time.Unix(500, 0), Paid: true}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	result, err := service.HandleNotification(context.Background(), []byte("signed xml"))
	if err != nil {
		t.Fatal(err)
	}
	if result.Order.Status != paymentdomain.StatusPaid || result.BalanceCents != 88 {
		t.Fatalf("result=%+v", result)
	}
}

type fakePaymentStore struct {
	order             paymentdomain.Order
	balance           int64
	creditCalls       int
	membershipApplies []paymentports.TeamFundCredit
}

func newFakePaymentStore() *fakePaymentStore { return &fakePaymentStore{} }

func (f *fakePaymentStore) OpenIDForUser(_ context.Context, userID int64) (string, error) {
	if userID <= 0 {
		return "", sharederror.ErrNotFound
	}
	return "openid-37", nil
}

func (f *fakePaymentStore) Create(_ context.Context, order paymentdomain.Order) error {
	f.order = order
	return nil
}

func (f *fakePaymentStore) SavePrepared(_ context.Context, orderNo, prepayID string, now time.Time) (paymentdomain.Order, error) {
	if f.order.OrderNo != orderNo {
		return paymentdomain.Order{}, sharederror.ErrNotFound
	}
	if err := f.order.MarkPrepared(prepayID, now); err != nil {
		return paymentdomain.Order{}, err
	}
	return f.order, nil
}

func (f *fakePaymentStore) MarkFailed(_ context.Context, orderNo string, now time.Time) error {
	if f.order.OrderNo != orderNo {
		return sharederror.ErrNotFound
	}
	return f.order.MarkFailed(now)
}

func (f *fakePaymentStore) Get(_ context.Context, orderNo string) (paymentdomain.Order, error) {
	if f.order.OrderNo != orderNo {
		return paymentdomain.Order{}, sharederror.ErrNotFound
	}
	return f.order, nil
}

func (f *fakePaymentStore) List(_ context.Context, filter paymentports.OrderFilter) ([]paymentdomain.Order, int64, error) {
	if f.order.OrderNo == "" || (filter.UserID != 0 && f.order.UserID != filter.UserID) {
		return nil, 0, nil
	}
	return []paymentdomain.Order{f.order}, 1, nil
}

func (f *fakePaymentStore) Cancel(_ context.Context, orderNo string, now time.Time) (paymentdomain.Order, error) {
	if f.order.OrderNo != orderNo {
		return paymentdomain.Order{}, sharederror.ErrNotFound
	}
	if err := f.order.MarkCancelled(now); err != nil {
		return paymentdomain.Order{}, err
	}
	return f.order, nil
}

func (f *fakePaymentStore) CreditRecharge(_ context.Context, payment paymentports.VerifiedPayment) (paymentports.SettlementResult, error) {
	f.creditCalls++
	if f.order.OrderNo != payment.OrderNo || f.order.AmountCents != payment.AmountCents {
		return paymentports.SettlementResult{}, sharederror.ErrConflict
	}
	if f.order.Status != paymentdomain.StatusPaid {
		if err := f.order.MarkPaid(payment.TransactionID, payment.PaidAt); err != nil {
			return paymentports.SettlementResult{}, err
		}
		f.balance += payment.AmountCents
	}
	return paymentports.SettlementResult{Order: f.order, BalanceCents: f.balance}, nil
}

type fakeGateway struct {
	unified      paymentports.UnifiedOrderResult
	query        paymentports.ProviderPayment
	close        paymentports.CloseOutcome
	notification paymentports.ProviderPayment
	request      paymentports.UnifiedOrderRequest
	closeCalled  bool
}

func (f *fakeGateway) UnifiedOrder(_ context.Context, request paymentports.UnifiedOrderRequest) (paymentports.UnifiedOrderResult, error) {
	f.request = request
	return f.unified, nil
}

func (f *fakeGateway) QueryOrder(context.Context, string) (paymentports.ProviderPayment, error) {
	return f.query, nil
}

func (f *fakeGateway) CloseOrder(context.Context, string) (paymentports.CloseOutcome, error) {
	f.closeCalled = true
	return f.close, nil
}

func (f *fakeGateway) ParseNotification([]byte) (paymentports.ProviderPayment, error) {
	return f.notification, nil
}

type fixedOrderNumbers []string

func (f fixedOrderNumbers) NewOrderNo() string {
	if len(f) == 0 {
		return "P202608099999"
	}
	return f[0]
}

type fixedClock struct{ now time.Time }

func (f fixedClock) Now() time.Time { return f.now }

func userActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func mustOrder(t *testing.T, orderNo string, userID, amount int64) paymentdomain.Order {
	t.Helper()
	order, err := paymentdomain.NewRechargeOrder(orderNo, userID, amount, time.Unix(100, 0))
	if err != nil {
		t.Fatal(err)
	}
	return order
}

func (f *fakePaymentStore) ApplyMembershipPayment(_ context.Context, _ paymentports.VerifiedPayment, credit paymentports.TeamFundCredit) (paymentports.SettlementResult, error) {
	f.membershipApplies = append(f.membershipApplies, credit)
	return paymentports.SettlementResult{Credited: true}, nil
}

type allowTeams struct{}

func (allowTeams) EnsureManager(context.Context, int64, int64) error { return nil }
func (allowTeams) EnsureExists(context.Context, int64) error         { return nil }

func TestCreateTeamMembershipRequiresTeamManager(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{}
	service := NewService(store, store, gateway, store, store, denyTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{"P-team-1"}, fixedClock{})

	if _, err := service.CreateTeamMembership(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, CreateTeamMembershipCommand{TeamID: 7, AmountCents: 3000}); err == nil {
		t.Fatal("expected forbidden for non-manager")
	}
}

type denyTeams struct{}

func (denyTeams) EnsureManager(context.Context, int64, int64) error {
	return sharederror.ErrForbidden
}
func (denyTeams) EnsureExists(context.Context, int64) error { return nil }

func TestCreateTeamMembershipOrdersForClickedTeam(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{unified: paymentports.UnifiedOrderResult{
		PrepayID:   "prepay-team-9",
		Parameters: paymentports.JSAPIParameters{Package: "prepay_id=prepay-team-9"},
	}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{"P-team-9"}, fixedClock{})

	result, err := service.CreateTeamMembership(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, CreateTeamMembershipCommand{TeamID: 7, AmountCents: 7500})
	if err != nil {
		t.Fatal(err)
	}
	if result.Order.AmountCents != 7500 {
		t.Fatalf("amount=%d", result.Order.AmountCents)
	}
	if result.Order.Kind != paymentdomain.KindTeamMembership || result.Order.Months != nil {
		t.Fatalf("kind=%s months=%v", result.Order.Kind, result.Order.Months)
	}
	if gateway.request.OpenID != "openid-37" || gateway.request.AmountCents != 7500 {
		t.Fatalf("gateway request: %+v", gateway.request)
	}
}

func TestSyncTeamMembershipCreditsTeamFund(t *testing.T) {
	store := newFakePaymentStore()
	order, err := paymentdomain.NewTeamMembershipOrder("P-team-settle", 37, 7, 7500, time.Unix(100, 0))
	if err != nil {
		t.Fatal(err)
	}
	store.order = order
	gateway := &fakeGateway{query: paymentports.ProviderPayment{OrderNo: order.OrderNo, AmountCents: 7500, TransactionID: "wx-team-1", PaidAt: time.Unix(200, 0), Paid: true}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	if _, err := service.Sync(context.Background(), userActor(37), order.OrderNo); err != nil {
		t.Fatal(err)
	}
	if len(store.membershipApplies) != 1 {
		t.Fatalf("membership applies: %+v", store.membershipApplies)
	}
	// 队费只入球队余额，与信用分无关。
	if apply := store.membershipApplies[0]; apply.TeamID != 7 || apply.AmountCents != 7500 {
		t.Fatalf("apply=%+v", apply)
	}
}

// 已付的队费订单再次 Sync（如微信回调先到、用户端随后轮询）必须仍走队费结算，
// 不能误入个人钱包 CreditRecharge。
func TestSyncAlreadyPaidTeamMembershipOrderRoutesToMembershipSettlement(t *testing.T) {
	store := newFakePaymentStore()
	order, err := paymentdomain.NewTeamMembershipOrder("P-team-paid", 37, 7, 6000, time.Unix(100, 0))
	if err != nil {
		t.Fatal(err)
	}
	if err := order.MarkPaid("wx-team-paid", time.Unix(150, 0)); err != nil {
		t.Fatal(err)
	}
	store.order = order
	gateway := &fakeGateway{}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	result, err := service.Sync(context.Background(), userActor(37), order.OrderNo)
	if err != nil {
		t.Fatal(err)
	}
	if store.creditCalls != 0 {
		t.Fatalf("team order must not touch user wallet, creditCalls=%d", store.creditCalls)
	}
	if len(store.membershipApplies) != 1 {
		t.Fatalf("membership applies: %+v", store.membershipApplies)
	}
	if !result.Credited {
		t.Fatalf("result=%+v", result)
	}
}

type fakeRegistrationFees struct{}

func (fakeRegistrationFees) RegistrationFee(context.Context, uuid.UUID, int64) (paymentports.MatchRegistrationFee, error) {
	return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindValidation, "比赛无效")
}

func (s *fakePaymentStore) ApplyRegistrationPayment(context.Context, paymentports.VerifiedPayment, paymentports.MatchRegistrationCredit) (paymentports.SettlementResult, error) {
	return paymentports.SettlementResult{}, nil
}

func TestCreateMatchRegistrationRejectsInvalidFeeContext(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fakeRegistrationFees{}, store, fixedOrderNumbers{}, fixedClock{})

	if _, err := service.CreateMatchRegistration(context.Background(), userActor(37), CreateMatchRegistrationCommand{MatchID: uuid.New()}); err == nil {
		t.Fatal("expected fee validation to reject the order")
	}
}

func TestCreateMatchRegistrationUsesServerPricedFee(t *testing.T) {
	store := newFakePaymentStore()
	gateway := &fakeGateway{unified: paymentports.UnifiedOrderResult{PrepayID: "prepay-m1", Parameters: paymentports.JSAPIParameters{Package: "prepay_id=prepay-m1"}}}
	fees := pricedRegistrationFees{fee: paymentports.MatchRegistrationFee{MatchID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), AmountCents: 2500}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fees, store, fixedOrderNumbers{"P-match-1"}, fixedClock{time.Unix(100, 0)})

	result, err := service.CreateMatchRegistration(context.Background(), userActor(37), CreateMatchRegistrationCommand{MatchID: fees.fee.MatchID})
	if err != nil {
		t.Fatal(err)
	}
	if result.Order.Kind != paymentdomain.KindMatchRegistration || result.Order.AmountCents != 2500 {
		t.Fatalf("unexpected order: %+v", result.Order)
	}
	if result.Order.MatchID == nil || *result.Order.MatchID != fees.fee.MatchID {
		t.Fatalf("order should reference match: %+v", result.Order)
	}
	if gateway.request.AmountCents != 2500 || gateway.request.OpenID != "openid-37" {
		t.Fatalf("unexpected gateway request: %+v", gateway.request)
	}
}

type pricedRegistrationFees struct {
	fee paymentports.MatchRegistrationFee
}

func (f pricedRegistrationFees) RegistrationFee(_ context.Context, matchID uuid.UUID, _ int64) (paymentports.MatchRegistrationFee, error) {
	if matchID != f.fee.MatchID {
		return paymentports.MatchRegistrationFee{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	return f.fee, nil
}
