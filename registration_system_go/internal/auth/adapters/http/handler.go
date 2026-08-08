package authhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/application"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type WechatLoginUseCase interface {
	Execute(context.Context, string) (application.WechatLoginResult, error)
}

type Handler struct {
	wechatLogin WechatLoginUseCase
}

type WechatLoginRequest struct {
	JSCode string `json:"js_code" binding:"required"`
}

type WechatLoginResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID          int64   `json:"id"`
	Nickname    string  `json:"nickname"`
	AvatarURL   *string `json:"avatar_url"`
	RealName    *string `json:"real_name"`
	PhoneNumber *string `json:"phone_number"`
	Status      string  `json:"status"`
}

func NewHandler(wechatLogin WechatLoginUseCase) *Handler {
	return &Handler{wechatLogin: wechatLogin}
}

func (h *Handler) WechatLogin(c *gin.Context) {
	var request WechatLoginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "微信登录 code 不能为空"))
		return
	}
	result, err := h.wechatLogin.Execute(c.Request.Context(), request.JSCode)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, WechatLoginResponse{
		Token: result.Token,
		User:  mapUserResponse(result.User),
	})
}

func mapUserResponse(user userdomain.User) UserResponse {
	return UserResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
	}
}

func (h *Handler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.POST("/auth/wechat/login", h.WechatLogin)
}
