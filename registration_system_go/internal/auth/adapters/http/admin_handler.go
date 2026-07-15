package authhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type AdminAuthService interface {
	Login(context.Context, string, string) (application.AdminLoginResult, error)
	Current(context.Context, sharedauth.Actor) (domain.Admin, error)
}

type AdminHandler struct {
	service AdminAuthService
}

type AdminLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AdminLoginResponse struct {
	AccessToken string        `json:"access_token"`
	TokenType   string        `json:"token_type"`
	Admin       AdminResponse `json:"admin"`
}

type AdminResponse struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	Role         string `json:"role"`
	Status       string `json:"status"`
	IsSuperAdmin bool   `json:"is_super_admin"`
}

func NewAdminHandler(service AdminAuthService) *AdminHandler {
	return &AdminHandler{service: service}
}

func (h *AdminHandler) Login(c *gin.Context) {
	var request AdminLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "账号和密码不能为空"))
		return
	}
	result, err := h.service.Login(c.Request.Context(), request.Username, request.Password)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, AdminLoginResponse{
		AccessToken: result.Token,
		TokenType:   "Bearer",
		Admin:       mapAdminResponse(result.Admin),
	})
}

func (h *AdminHandler) Me(c *gin.Context) {
	actor, ok := ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	admin, err := h.service.Current(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapAdminResponse(admin))
}

func (h *AdminHandler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.POST("/auth/login", h.Login)
}

func (h *AdminHandler) RegisterProtectedRoutes(group *gin.RouterGroup) {
	group.GET("/auth/me", h.Me)
}

func mapAdminResponse(admin domain.Admin) AdminResponse {
	return AdminResponse{
		ID: admin.ID, Username: admin.Username, Role: string(admin.Role), Status: string(admin.Status), IsSuperAdmin: admin.IsSuper(),
	}
}
