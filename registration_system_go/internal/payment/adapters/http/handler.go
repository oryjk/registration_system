package paymenthttp

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	paymentapplication "github.com/oryjk/registration_system/registration_system_go/internal/payment/application"
	paymentdomain "github.com/oryjk/registration_system/registration_system_go/internal/payment/domain"
	paymentports "github.com/oryjk/registration_system/registration_system_go/internal/payment/ports"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	sharedhttp "github.com/oryjk/registration_system/registration_system_go/internal/shared/http"
)

const maxWebhookBodyBytes = 1 << 20

type PaymentService interface {
	CreateRecharge(context.Context, sharedauth.Actor, paymentapplication.CreateRechargeCommand) (paymentapplication.CreateRechargeResult, error)
	CreateTeamMembership(context.Context, sharedauth.Actor, paymentapplication.CreateTeamMembershipCommand) (paymentapplication.CreateRechargeResult, error)
	CreateMatchRegistration(context.Context, sharedauth.Actor, paymentapplication.CreateMatchRegistrationCommand) (paymentapplication.CreateRechargeResult, error)
	CreateTip(context.Context, sharedauth.Actor, paymentapplication.CreateTipCommand) (paymentapplication.CreateRechargeResult, error)
	List(context.Context, sharedauth.Actor, paymentapplication.ListQuery) (paymentapplication.ListResult, error)
	ListTips(context.Context, sharedauth.Actor, paymentapplication.TipListQuery) (paymentapplication.TipListResult, error)
	Get(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error)
	Sync(context.Context, sharedauth.Actor, string) (paymentports.SettlementResult, error)
	Cancel(context.Context, sharedauth.Actor, string) (paymentdomain.Order, error)
	HandleNotification(context.Context, []byte) (paymentports.SettlementResult, error)
}

type Handler struct{ service PaymentService }

func NewHandler(service PaymentService) *Handler { return &Handler{service: service} }

type CreateRechargeRequest struct {
	AmountCents int64 `json:"amount_cents" binding:"required,min=1"`
}

type CreateTeamMembershipRequest struct {
	TeamID      int64 `json:"team_id" binding:"required,min=1"`
	AmountCents int64 `json:"amount_cents" binding:"required,min=1"`
}

type CreateMatchRegistrationRequest struct {
	MatchID string `json:"match_id" binding:"required,uuid"`
}

type CreateTipRequest struct {
	AmountCents int64 `json:"amount_cents" binding:"required,min=1"`
	// 功能建议可选；长度上限在领域层校验（按 rune 计），handler 不重复绑定规则。
	Suggestion string `json:"suggestion"`
}

type OrderResponse struct {
	OrderNo       string               `json:"order_no"`
	UserID        int64                `json:"user_id"`
	AmountCents   int64                `json:"amount_cents"`
	Provider      string               `json:"provider"`
	Channel       string               `json:"channel"`
	Kind          paymentdomain.Kind   `json:"kind"`
	TeamID        *int64               `json:"team_id"`
	MatchID       *string              `json:"match_id"`
	Months        *int                 `json:"months"`
	Status        paymentdomain.Status `json:"status"`
	PrepayID      string               `json:"prepay_id,omitempty"`
	TransactionID string               `json:"transaction_id,omitempty"`
	PaidAt        *time.Time           `json:"paid_at,omitempty"`
	CancelledAt   *time.Time           `json:"cancelled_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

type CreateRechargeResponse struct {
	Order   OrderResponse                `json:"order"`
	Payment paymentports.JSAPIParameters `json:"payment"`
}

type OrderListResponse struct {
	Items    []OrderResponse `json:"items"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

// TipResponse 管理端"打赏与建议"列表项；只包含已支付（建议已生效）的记录。
type TipResponse struct {
	OrderNo     string                  `json:"order_no"`
	UserID      int64                   `json:"user_id"`
	Nickname    string                  `json:"nickname"`
	AmountCents int64                   `json:"amount_cents"`
	Suggestion  string                  `json:"suggestion"`
	Status      paymentdomain.TipStatus `json:"status"`
	SubmittedAt *time.Time              `json:"submitted_at,omitempty"`
	CreatedAt   time.Time               `json:"created_at"`
}

type TipListResponse struct {
	Items    []TipResponse `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type SyncResponse struct {
	Order        OrderResponse `json:"order"`
	BalanceCents int64         `json:"balance_cents"`
	Credited     bool          `json:"credited"`
}

type wechatCallbackResponse struct {
	XMLName    struct{} `xml:"xml"`
	ReturnCode string   `xml:"return_code"`
	ReturnMsg  string   `xml:"return_msg"`
}

func (h *Handler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.POST("/payments/recharge-orders", h.CreateRecharge)
	group.POST("/payments/team-membership-orders", h.CreateTeamMembership)
	group.POST("/payments/match-registration-orders", h.CreateMatchRegistration)
	group.POST("/payments/tip-orders", h.CreateTip)
	group.GET("/payments/orders", h.List)
	group.GET("/payments/orders/:order_no", h.Get)
	group.POST("/payments/orders/:order_no/sync", h.Sync)
	group.POST("/payments/orders/:order_no/cancel", h.Cancel)
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/payments/orders", h.List)
	group.GET("/payments/orders/:order_no", h.Get)
	group.GET("/payments/tips", h.ListTips)
}

func (h *Handler) RegisterWebhookRoutes(group *gin.RouterGroup) {
	group.POST("/wechat-pay", h.WechatPayWebhook)
}

func (h *Handler) CreateRecharge(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	var request CreateRechargeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "充值金额至少为 1 分"))
		return
	}
	result, err := h.service.CreateRecharge(c.Request.Context(), actor, paymentapplication.CreateRechargeCommand{AmountCents: request.AmountCents, ClientIP: c.ClientIP()})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CreateRechargeResponse{Order: mapOrder(result.Order), Payment: result.Payment})
}

func (h *Handler) CreateTeamMembership(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	var request CreateTeamMembershipRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "队费金额无效"))
		return
	}
	result, err := h.service.CreateTeamMembership(c.Request.Context(), actor, paymentapplication.CreateTeamMembershipCommand{
		TeamID: request.TeamID, AmountCents: request.AmountCents, ClientIP: c.ClientIP(),
	})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CreateRechargeResponse{Order: mapOrder(result.Order), Payment: result.Payment})
}

func (h *Handler) CreateMatchRegistration(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	var request CreateMatchRegistrationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛无效"))
		return
	}
	matchID, err := uuid.Parse(request.MatchID)
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛无效"))
		return
	}
	result, err := h.service.CreateMatchRegistration(c.Request.Context(), actor, paymentapplication.CreateMatchRegistrationCommand{
		MatchID: matchID, ClientIP: c.ClientIP(),
	})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CreateRechargeResponse{Order: mapOrder(result.Order), Payment: result.Payment})
}

func (h *Handler) CreateTip(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	var request CreateTipRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "打赏金额无效"))
		return
	}
	result, err := h.service.CreateTip(c.Request.Context(), actor, paymentapplication.CreateTipCommand{
		AmountCents: request.AmountCents, Suggestion: request.Suggestion, ClientIP: c.ClientIP(),
	})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CreateRechargeResponse{Order: mapOrder(result.Order), Payment: result.Payment})
}

func (h *Handler) ListTips(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	result, err := h.service.ListTips(c.Request.Context(), actor, paymentapplication.TipListQuery{Page: page, PageSize: pageSize})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	items := make([]TipResponse, 0, len(result.Items))
	for _, tip := range result.Items {
		items = append(items, mapTip(tip))
	}
	sharedhttpapi.WriteSuccess(c, TipListResponse{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

func (h *Handler) List(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	result, err := h.service.List(c.Request.Context(), actor, paymentapplication.ListQuery{
		Status: paymentdomain.Status(c.Query("status")), Search: c.Query("search"), Page: page, PageSize: pageSize,
	})
	if err != nil {
		writePaymentError(c, err)
		return
	}
	items := make([]OrderResponse, 0, len(result.Items))
	for _, order := range result.Items {
		items = append(items, mapOrder(order))
	}
	sharedhttpapi.WriteSuccess(c, OrderListResponse{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

func (h *Handler) Get(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	order, err := h.service.Get(c.Request.Context(), actor, c.Param("order_no"))
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapOrder(order))
}

func (h *Handler) Sync(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	result, err := h.service.Sync(c.Request.Context(), actor, c.Param("order_no"))
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, SyncResponse{Order: mapOrder(result.Order), BalanceCents: result.BalanceCents, Credited: result.Credited})
}

func (h *Handler) Cancel(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	order, err := h.service.Cancel(c.Request.Context(), actor, c.Param("order_no"))
	if err != nil {
		writePaymentError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapOrder(order))
}

func (h *Handler) WechatPayWebhook(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxWebhookBodyBytes)
	body, err := io.ReadAll(c.Request.Body)
	if err == nil {
		_, err = h.service.HandleNotification(c.Request.Context(), body)
	}
	response := wechatCallbackResponse{ReturnCode: "SUCCESS", ReturnMsg: "OK"}
	if err != nil {
		response.ReturnCode = "FAIL"
		response.ReturnMsg = "RETRY"
	}
	c.XML(http.StatusOK, response)
}

func paymentActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
	}
	return actor, ok
}

func writePaymentError(c *gin.Context, err error) {
	if errors.Is(err, paymentports.ErrProviderUnavailable) || errors.Is(err, paymentports.ErrProviderRejected) {
		c.JSON(http.StatusBadGateway, sharedhttp.Response[any]{Code: http.StatusBadGateway, Message: "payment provider error", Data: nil})
		return
	}
	sharedhttpapi.WriteError(c, err)
}

func mapTip(tip paymentdomain.Tip) TipResponse {
	return TipResponse{
		OrderNo: tip.OrderNo, UserID: tip.UserID, Nickname: tip.Nickname,
		AmountCents: tip.AmountCents, Suggestion: tip.Suggestion,
		Status: tip.Status, SubmittedAt: tip.SubmittedAt, CreatedAt: tip.CreatedAt,
	}
}

func mapOrder(order paymentdomain.Order) OrderResponse {
	var matchID *string
	if order.MatchID != nil {
		id := order.MatchID.String()
		matchID = &id
	}
	return OrderResponse{
		OrderNo: order.OrderNo, UserID: order.UserID, AmountCents: order.AmountCents,
		Provider: order.Provider, Channel: order.Channel,
		Kind: order.Kind, TeamID: order.TeamID, MatchID: matchID, Months: order.Months, Status: order.Status,
		PrepayID: order.PrepayID, TransactionID: order.TransactionID,
		PaidAt: order.PaidAt, CancelledAt: order.CancelledAt,
		CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt,
	}
}
