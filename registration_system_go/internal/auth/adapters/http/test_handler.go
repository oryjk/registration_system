package authhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type TestAuthService interface {
	ListUsers(context.Context, int64) (application.TestLoginUsersResult, error)
	Login(context.Context, int64) (application.TestLoginResult, error)
}

type TestHandler struct {
	service       TestAuthService
	defaultUserID int64
}

type TestLoginTeamResponse struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}

type TestLoginUserResponse struct {
	ID          int64                   `json:"id"`
	DisplayName string                  `json:"display_name"`
	AvatarURL   *string                 `json:"avatar_url"`
	Teams       []TestLoginTeamResponse `json:"teams"`
}

type TestLoginUsersResponse struct {
	Items         []TestLoginUserResponse `json:"items"`
	DefaultUserID int64                   `json:"default_user_id"`
}

type TestLoginRequest struct {
	UserID int64 `json:"user_id" binding:"required"`
}

func NewTestHandler(service TestAuthService, defaultUserID int64) *TestHandler {
	return &TestHandler{service: service, defaultUserID: defaultUserID}
}

func (h *TestHandler) ListUsers(c *gin.Context) {
	result, err := h.service.ListUsers(c.Request.Context(), h.defaultUserID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]TestLoginUserResponse, 0, len(result.Items))
	for _, item := range result.Items {
		teams := make([]TestLoginTeamResponse, 0, len(item.Teams))
		for _, team := range item.Teams {
			teams = append(teams, TestLoginTeamResponse{ID: team.ID, Name: team.Name, Role: team.Role})
		}
		items = append(items, TestLoginUserResponse{ID: item.ID, DisplayName: item.DisplayName, AvatarURL: item.AvatarURL, Teams: teams})
	}
	sharedhttpapi.WriteSuccess(c, TestLoginUsersResponse{Items: items, DefaultUserID: result.DefaultUserID})
}

func (h *TestHandler) Login(c *gin.Context) {
	var request TestLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.UserID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "测试用户 ID 无效"))
		return
	}
	result, err := h.service.Login(c.Request.Context(), request.UserID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, WechatLoginResponse{Token: result.Token, User: mapUserResponse(result.User)})
}

func (h *TestHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/test-auth/users", h.ListUsers)
	group.POST("/test-auth/login", h.Login)
}
