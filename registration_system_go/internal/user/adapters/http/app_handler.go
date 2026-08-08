package userhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type AppUsers interface {
	GetMe(context.Context, sharedauth.Actor) (domain.User, error)
	UpdateMe(context.Context, sharedauth.Actor, application.UpdateMeCommand) (domain.User, error)
}

type AppHandler struct {
	users AppUsers
}

type UpdateMeRequest struct {
	Nickname *string `json:"nickname"`
	RealName *string `json:"real_name"`
}

func NewAppHandler(users AppUsers) *AppHandler {
	return &AppHandler{users: users}
}

func (h *AppHandler) GetMe(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	user, err := h.users.GetMe(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapProfileResponse(user))
}

func (h *AppHandler) UpdateMe(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	var request UpdateMeRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Nickname == nil && request.RealName == nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户资料无效"))
		return
	}
	user, err := h.users.UpdateMe(c.Request.Context(), actor, application.UpdateMeCommand{
		Nickname: request.Nickname,
		RealName: request.RealName,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapProfileResponse(user))
}

func (h *AppHandler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.GET("/users/me", h.GetMe)
	group.PATCH("/users/me", h.UpdateMe)
}

func mapProfileResponse(user domain.User) ProfileResponse {
	return ProfileResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
	}
}
