package authhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type WebviewCodeService interface {
	Issue(ctx context.Context, actor sharedauth.Actor) (application.WebviewCodeIssueResult, error)
	Exchange(ctx context.Context, code string) (application.WebviewCodeExchangeResult, error)
}

// WebviewCodeHandler web-view 一次性 code：签发需登录，兑换公开。
type WebviewCodeHandler struct {
	service WebviewCodeService
}

func NewWebviewCodeHandler(service WebviewCodeService) *WebviewCodeHandler {
	return &WebviewCodeHandler{service: service}
}

type WebviewCodeIssueResponse struct {
	Code      string `json:"code"`
	ExpiresAt string `json:"expires_at"`
}

type WebviewCodeExchangeRequest struct {
	Code string `json:"code" binding:"required"`
}

type WebviewCodeExchangeResponse struct {
	Token string `json:"token"`
}

// RegisterUserRoutes 签发入口挂在需登录且激活的用户路由组。
func (h *WebviewCodeHandler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.POST("/auth/webview-codes", h.Issue)
}

// RegisterPublicRoutes 兑换入口公开（code 本身即凭证），无鉴权。
func (h *WebviewCodeHandler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.POST("/auth/webview-codes/exchange", h.Exchange)
}

func (h *WebviewCodeHandler) Issue(c *gin.Context) {
	actor, ok := ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	result, err := h.service.Issue(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, WebviewCodeIssueResponse{
		Code:      result.Code,
		ExpiresAt: result.ExpiresAt.Format(time.RFC3339),
	})
}

func (h *WebviewCodeHandler) Exchange(c *gin.Context) {
	var request WebviewCodeExchangeRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		// code 缺失与无效/已用/过期统一按 401 处理，不区分原因。
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindUnauthorized, "code 无效或已过期"))
		return
	}
	result, err := h.service.Exchange(c.Request.Context(), request.Code)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, WebviewCodeExchangeResponse{Token: result.Token})
}
