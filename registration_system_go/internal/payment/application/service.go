package application

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
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
	orders        paymentports.OrderRepository
	users         paymentports.UserOpenIDReader
	nicknames     paymentports.UserNicknameReader
	gateway       paymentports.Gateway
	settlement    paymentports.Settlement
	memberships   paymentports.MembershipSettlement
	teams         paymentports.TeamEligibility
	matchFees     paymentports.MatchRegistrationFeeSource
	registrations paymentports.RegistrationSettlement
	tips          paymentports.TipRepository
	orderNos      paymentports.OrderNumberGenerator
	clock         paymentports.Clock
}

func NewService(orders paymentports.OrderRepository, users paymentports.UserOpenIDReader, nicknames paymentports.UserNicknameReader, gateway paymentports.Gateway, settlement paymentports.Settlement, memberships paymentports.MembershipSettlement, teams paymentports.TeamEligibility, matchFees paymentports.MatchRegistrationFeeSource, registrations paymentports.RegistrationSettlement, tips paymentports.TipRepository, orderNos paymentports.OrderNumberGenerator, clock paymentports.Clock) *Service {
	return &Service{orders: orders, users: users, nicknames: nicknames, gateway: gateway, settlement: settlement, memberships: memberships, teams: teams, matchFees: matchFees, registrations: registrations, tips: tips, orderNos: orderNos, clock: clock}
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

// CreateTeamMembership 为球队创建队费订单并发起微信支付；金额由用户填写，与时间无关；
// 仅该队队长/领队可操作，订单归属被点击的球队。
func (s *Service) CreateTeamMembership(ctx context.Context, actor sharedauth.Actor, command CreateTeamMembershipCommand) (CreateRechargeResult, error) {
	if !actor.IsUser() {
		return CreateRechargeResult{}, sharederror.ErrForbidden
	}
	if err := s.teams.EnsureActiveMember(ctx, command.TeamID, actor.ID); err != nil {
		return CreateRechargeResult{}, err
	}
	now := s.clock.Now()
	order, err := paymentdomain.NewTeamMembershipOrder(s.orderNos.NewOrderNo(), actor.ID, command.TeamID, command.AmountCents, now)
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
		Description: "球队队费缴纳",
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
	TeamID      int64
	AmountCents int64
	ClientIP    string
}

type CreateTipCommand struct {
	AmountCents int64
	Suggestion  string
	ClientIP    string
}

// CreateTip 为"请开发者喝咖啡"创建打赏订单并发起微信支付：金额由用户自由填写，
// 可选功能建议随订单落库（昵称下单时快照），支付成功核销后建议才生效。
func (s *Service) CreateTip(ctx context.Context, actor sharedauth.Actor, command CreateTipCommand) (CreateRechargeResult, error) {
	if !actor.IsUser() {
		return CreateRechargeResult{}, sharederror.ErrForbidden
	}
	now := s.clock.Now()
	order, err := paymentdomain.NewTipOrder(s.orderNos.NewOrderNo(), actor.ID, command.AmountCents, now)
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
	nickname, err := s.nicknames.NicknameForUser(ctx, actor.ID)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	tip, err := paymentdomain.NewTip(order, nickname, command.Suggestion)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	if err := s.orders.Create(ctx, order); err != nil {
		return CreateRechargeResult{}, err
	}
	if err := s.tips.CreateTip(ctx, tip); err != nil {
		return CreateRechargeResult{}, err
	}
	providerResult, err := s.gateway.UnifiedOrder(ctx, paymentports.UnifiedOrderRequest{
		OrderNo: order.OrderNo, AmountCents: order.AmountCents,
		Description: "请开发者喝咖啡",
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

type CreateMatchRegistrationCommand struct {
	MatchID  uuid.UUID
	ClientIP string
}

// CreateMatchRegistration 为散人报名创建报名费订单并发起微信支付；
// 金额由比赛定价（服务端），下单前校验操作者已报名且尚未支付。
func (s *Service) CreateMatchRegistration(ctx context.Context, actor sharedauth.Actor, command CreateMatchRegistrationCommand) (CreateRechargeResult, error) {
	if !actor.IsUser() {
		return CreateRechargeResult{}, sharederror.ErrForbidden
	}
	if command.MatchID == uuid.Nil {
		return CreateRechargeResult{}, sharederror.New(sharederror.KindValidation, "比赛无效")
	}
	fee, err := s.matchFees.RegistrationFee(ctx, command.MatchID, actor.ID)
	if err != nil {
		return CreateRechargeResult{}, err
	}
	now := s.clock.Now()
	// 调整人数后重新下单：先关闭同比赛同人的遗留未付订单，避免旧金额订单被误付。
	if err := s.orders.CancelPendingForMatch(ctx, command.MatchID, actor.ID, now); err != nil {
		return CreateRechargeResult{}, err
	}
	order, err := paymentdomain.NewMatchRegistrationOrder(s.orderNos.NewOrderNo(), actor.ID, command.MatchID, fee.AmountCents, now)
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
		Description: "比赛报名费",
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
		return s.settleVerified(ctx, verifiedFromOrder(order))
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
	return s.settleVerified(ctx, verified)
}

// settleVerified 按订单类型路由结算：队费订单入付款人在该球队的个人账户，充值订单入个人钱包，
// 报名费订单把对应报名标记为已支付。
func (s *Service) settleVerified(ctx context.Context, verified paymentports.VerifiedPayment) (paymentports.SettlementResult, error) {
	order, err := s.orders.Get(ctx, verified.OrderNo)
	if err != nil {
		return paymentports.SettlementResult{}, err
	}
	switch order.Kind {
	case paymentdomain.KindTeamMembership:
		if order.TeamID == nil {
			return paymentports.SettlementResult{}, sharederror.New(sharederror.KindConflict, "队费订单缺少球队信息")
		}
		return s.memberships.ApplyMembershipPayment(ctx, verified, paymentports.TeamFundCredit{
			TeamID:      *order.TeamID,
			UserID:      order.UserID,
			AmountCents: order.AmountCents,
		})
	case paymentdomain.KindMatchRegistration:
		if order.MatchID == nil {
			return paymentports.SettlementResult{}, sharederror.New(sharederror.KindConflict, "报名费订单缺少比赛信息")
		}
		return s.registrations.ApplyRegistrationPayment(ctx, verified, paymentports.MatchRegistrationCredit{
			MatchID:     *order.MatchID,
			UserID:      order.UserID,
			AmountCents: order.AmountCents,
		})
	case paymentdomain.KindTip:
		return s.tips.ApplyTipPayment(ctx, verified)
	default:
		return s.settlement.CreditRecharge(ctx, verified)
	}
}

type TipListQuery struct {
	Page     int
	PageSize int
}

type TipListResult struct {
	Items    []paymentdomain.Tip
	Total    int64
	Page     int
	PageSize int
}

// ListTips 管理端"打赏与建议"列表：只返回已支付（建议已生效）的记录，按提交时间倒序。
func (s *Service) ListTips(ctx context.Context, actor sharedauth.Actor, query TipListQuery) (TipListResult, error) {
	if !actor.IsAdmin() {
		return TipListResult{}, sharederror.ErrForbidden
	}
	query.Page, query.PageSize = normalizePage(query.Page, query.PageSize)
	items, total, err := s.tips.ListTips(ctx, paymentports.TipFilter{Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize})
	if err != nil {
		return TipListResult{}, err
	}
	return TipListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
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
