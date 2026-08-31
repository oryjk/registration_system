package authhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type ImpersonationService interface {
	SearchTargets(ctx context.Context, actorID int64, keyword string) ([]userdomain.User, error)
	Impersonate(ctx context.Context, actorID, targetUserID int64) (application.ImpersonationResult, error)
}

// ImpersonationHandler 身份切换（impersonate）：仅白名单账号可用，挂在需登录的用户路由组。
type ImpersonationHandler struct {
	service ImpersonationService
}

func NewImpersonationHandler(service ImpersonationService) *ImpersonationHandler {
	return &ImpersonationHandler{service: service}
}

type ImpersonationRequest struct {
	UserID int64 `json:"user_id" binding:"required"`
}

type ImpersonationResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type ImpersonationTargetsResponse struct {
	Items []UserResponse `json:"items"`
}

func (h *ImpersonationHandler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.GET("/auth/impersonation/targets", h.SearchTargets)
	group.POST("/auth/impersonation", h.Impersonate)
}

func (h *ImpersonationHandler) SearchTargets(c *gin.Context) {
	actor, ok := ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	users, err := h.service.SearchTargets(c.Request.Context(), actor.ID, c.Query("keyword"))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]UserResponse, 0, len(users))
	for _, user := range users {
		items = append(items, mapUserResponse(user))
	}
	sharedhttpapi.WriteSuccess(c, ImpersonationTargetsResponse{Items: items})
}

func (h *ImpersonationHandler) Impersonate(c *gin.Context) {
	actor, ok := ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	var request ImpersonationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "目标用户 ID 不能为空"))
		return
	}
	result, err := h.service.Impersonate(c.Request.Context(), actor.ID, request.UserID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ImpersonationResponse{
		Token: result.Token,
		User:  mapUserResponse(result.User),
	})
}
