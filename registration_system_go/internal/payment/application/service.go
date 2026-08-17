package application

import (
	"context"
	"errors"
	"fmt"
	"strings"

	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	defaultPageSize = 20
	maxPageSize     = 100
)

type Service struct {
	orders      paymentports.OrderRepository
	users       paymentports.UserOpenIDReader
	gateway     paymentports.Gateway
	settlement  paymentports.Settlement
	memberships paymentports.MembershipSettlement
	teams       paymentports.TeamEligibility
	orderNos    paymentports.OrderNumberGenerator
	clock       paymentports.Clock
}

func NewService(orders paymentports.OrderRepository, users paymentports.UserOpenIDReader, gateway paymentports.Gateway, settlement paymentports.Settlement, memberships paymentports.MembershipSettlement, teams paymentports.TeamEligibility, orderNos paymentports.OrderNumberGenerator, clock paymentports.Clock) *Service {
	return &Service{orders: orders, users: users, gateway: gateway, settlement: settlement, memberships: memberships, teams: teams, orderNos: orderNos, clock: clock}
}

type CreateRechargeCommand struct {
	AmountCents int64
	ClientIP    string
}

type CreateRechargeResult struct {
	Order   paymentdomain.Order
	Payment paymentports.JSAPIParameters
}

func (s *Service) CreateRecharge(ctx context.Context, actor sharedauth.Actor, command CreateRechargeCommand) (CreateRechargeResult, error) {
	if !actor.IsUser() {
		return CreateRechargeResult{}, sharederror.ErrForbidden
	}
	now := s.clock.Now()
	order, err := paymentdomain.NewRechargeOrder(s.orderNos.NewOrderNo(), actor.ID, command.AmountCents, now)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	openid, err := s.users.OpenIDForUser(ctx, actor.ID)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	if strings.TrimSpace(openid) == "" {
		return CreateRechargeResult{}, sharederror.New(sharederror.KindConflict, "当前用户缺少微信身份信息")
	}
	if err := s.orders.Create(ctx, order); err != nil {
		return CreateRechargeResult{}, err
	}
	providerResult, err := s.gateway.UnifiedOrder(ctx, paymentports.UnifiedOrderRequest{
		OrderNo: order.OrderNo, AmountCents: order.AmountCents, Description: "个人余额充值",
		ClientIP: strings.TrimSpace(command.ClientIP), OpenID: openid,
	})
	if err != nil {
		if errors.Is(err, paymentports.ErrProviderRejected) {
			_ = s.orders.MarkFailed(ctx, order.OrderNo, s.clock.Now())
		}
		return CreateRechargeResult{}, err
	}
	order, err = s.orders.SavePrepared(ctx, order.OrderNo, providerResult.PrepayID, s.clock.Now())
	if err != nil {
		return CreateRechargeResult{}, err
	}
	return CreateRechargeResult{Order: order, Payment: providerResult.Parameters}, nil
}

// CreateTeamMembership 为球队创建队费（会员续费）订单并发起微信支付；
// 仅该队队长/领队可操作，订单归属被点击的球队。
func (s *Service) CreateTeamMembership(ctx context.Context, actor sharedauth.Actor, command CreateTeamMembershipCommand) (CreateRechargeResult, error) {
	if !actor.IsUser() {
		return CreateRechargeResult{}, sharederror.ErrForbidden
	}
	if err := s.teams.EnsureManager(ctx, command.TeamID, actor.ID); err != nil {
		return CreateRechargeResult{}, err
	}
	now := s.clock.Now()
	order, err := paymentdomain.NewTeamMembershipOrder(s.orderNos.NewOrderNo(), actor.ID, command.TeamID, command.Months, now)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	openid, err := s.users.OpenIDForUser(ctx, actor.ID)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	if strings.TrimSpace(openid) == "" {
		return CreateRechargeResult{}, sharederror.New(sharederror.KindConflict, "当前用户缺少微信身份信息")
	}
	if err := s.orders.Create(ctx, order); err != nil {
		return CreateRechargeResult{}, err
	}
	providerResult, err := s.gateway.UnifiedOrder(ctx, paymentports.UnifiedOrderRequest{
		OrderNo: order.OrderNo, AmountCents: order.AmountCents,
		Description: fmt.Sprintf("球队队费续费 %d 个月", command.Months),
		ClientIP:    strings.TrimSpace(command.ClientIP), OpenID: openid,
	})
	if err != nil {
		if errors.Is(err, paymentports.ErrProviderRejected) {
			_ = s.orders.MarkFailed(ctx, order.OrderNo, s.clock.Now())
		}
		return CreateRechargeResult{}, err
	}
	order, err = s.orders.SavePrepared(ctx, order.OrderNo, providerResult.PrepayID, s.clock.Now())
	if err != nil {
		return CreateRechargeResult{}, err
	}
	return CreateRechargeResult{Order: order, Payment: providerResult.Parameters}, nil
}

type CreateTeamMembershipCommand struct {
	TeamID   int64
	Months   int
	ClientIP string
}

type ListQuery struct {
	Status   paymentdomain.Status
	Search   string
	Page     int
	PageSize int
}

type ListResult struct {
	Items    []paymentdomain.Order
	Total    int64
	Page     int
	PageSize int
}

func (s *Service) List(ctx context.Context, actor sharedauth.Actor, query ListQuery) (ListResult, error) {
	if !actor.IsUser() && !actor.IsAdmin() {
		return ListResult{}, sharederror.ErrForbidden
	}
	if query.Status != "" && query.Status != paymentdomain.StatusPending && query.Status != paymentdomain.StatusPaid && query.Status != paymentdomain.StatusCancelled && query.Status != paymentdomain.StatusFailed {
		return ListResult{}, sharederror.New(sharederror.KindValidation, "支付订单状态筛选无效")
	}
	query.Page, query.PageSize = normalizePage(query.Page, query.PageSize)
	filter := paymentports.OrderFilter{Status: query.Status, Search: strings.TrimSpace(query.Search), Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize}
	if actor.IsUser() {
		filter.UserID = actor.ID
	}
	items, total, err := s.orders.List(ctx, filter)
	if err != nil {
		return ListResult{}, err
	}
	return ListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

func (s *Service) Get(ctx context.Context, actor sharedauth.Actor, orderNo string) (paymentdomain.Order, error) {
	if !actor.IsUser() && !actor.IsAdmin() {
		return paymentdomain.Order{}, sharederror.ErrForbidden
	}
	order, err := s.orders.Get(ctx, strings.TrimSpace(orderNo))
	if err != nil {
		return paymentdomain.Order{}, err
	}
	if actor.IsUser() && order.UserID != actor.ID {
		return paymentdomain.Order{}, sharederror.ErrNotFound
	}
	return order, nil
}

func (s *Service) Sync(ctx context.Context, actor sharedauth.Actor, orderNo string) (paymentports.SettlementResult, error) {
	order, err := s.Get(ctx, actor, orderNo)
	if err != nil {
		return paymentports.SettlementResult{}, err
	}
	if !actor.IsUser() {
		return paymentports.SettlementResult{}, sharederror.ErrForbidden
	}
	if order.Status == paymentdomain.StatusPaid {
		return s.settlement.CreditRecharge(ctx, verifiedFromOrder(order))
	}
	if order.Status != paymentdomain.StatusPending {
		return paymentports.SettlementResult{Order: order}, nil
	}
	payment, err := s.gateway.QueryOrder(ctx, order.OrderNo)
	if err != nil {
		return paymentports.SettlementResult{}, err
	}
	if !payment.Paid {
		return paymentports.SettlementResult{Order: order}, nil
	}
	return s.settle(ctx, payment)
}

func (s *Service) Cancel(ctx context.Context, actor sharedauth.Actor, orderNo string) (paymentdomain.Order, error) {
	order, err := s.Get(ctx, actor, orderNo)
	if err != nil {
		return paymentdomain.Order{}, err
	}
	if !actor.IsUser() {
		return paymentdomain.Order{}, sharederror.ErrForbidden
	}
	if order.Status == paymentdomain.StatusCancelled {
		return order, nil
	}
	if order.Status != paymentdomain.StatusPending {
		return paymentdomain.Order{}, sharederror.ErrConflict
	}
	outcome, err := s.gateway.CloseOrder(ctx, order.OrderNo)
	if err != nil {
		return paymentdomain.Order{}, err
	}
	if outcome == paymentports.CloseOutcomePaid {
		payment, queryErr := s.gateway.QueryOrder(ctx, order.OrderNo)
		if queryErr != nil {
			return paymentdomain.Order{}, queryErr
		}
		result, settleErr := s.settle(ctx, payment)
		return result.Order, settleErr
	}
	if outcome != paymentports.CloseOutcomeClosed {
		return paymentdomain.Order{}, paymentports.ErrProviderUnavailable
	}
	return s.orders.Cancel(ctx, order.OrderNo, s.clock.Now())
}

func (s *Service) HandleNotification(ctx context.Context, body []byte) (paymentports.SettlementResult, error) {
	payment, err := s.gateway.ParseNotification(body)
	if err != nil {
		return paymentports.SettlementResult{}, err
	}
	return s.settle(ctx, payment)
}

func (s *Service) settle(ctx context.Context, payment paymentports.ProviderPayment) (paymentports.SettlementResult, error) {
	if !payment.Paid || payment.OrderNo == "" || payment.TransactionID == "" || payment.AmountCents < 1 || payment.PaidAt.IsZero() {
		return paymentports.SettlementResult{}, sharederror.New(sharederror.KindValidation, "支付结果无效")
	}
	verified := paymentports.VerifiedPayment{
		OrderNo: payment.OrderNo, AmountCents: payment.AmountCents,
		TransactionID: payment.TransactionID, PaidAt: payment.PaidAt,
	}
	order, err := s.orders.Get(ctx, payment.OrderNo)
	if err != nil {
		return paymentports.SettlementResult{}, err
	}
	switch order.Kind {
	case paymentdomain.KindTeamMembership:
		if order.TeamID == nil || order.Months == nil {
			return paymentports.SettlementResult{}, sharederror.New(sharederror.KindConflict, "队费订单缺少球队信息")
		}
		return s.memberships.ApplyMembershipPayment(ctx, verified, paymentports.MembershipPurchase{
			TeamID: *order.TeamID, Months: *order.Months,
			CreditDelta: *order.Months * paymentdomain.MembershipCreditPerMonth,
		})
	default:
		return s.settlement.CreditRecharge(ctx, verified)
	}
}

func normalizePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return page, pageSize
}

func verifiedFromOrder(order paymentdomain.Order) paymentports.VerifiedPayment {
	paidAt := order.UpdatedAt
	if order.PaidAt != nil {
		paidAt = *order.PaidAt
	}
	return paymentports.VerifiedPayment{OrderNo: order.OrderNo, AmountCents: order.AmountCents, TransactionID: order.TransactionID, PaidAt: paidAt}
}
