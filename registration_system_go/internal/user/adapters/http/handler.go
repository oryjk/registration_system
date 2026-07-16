package userhttp

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type ProfileUpdater interface {
	Update(context.Context, sharedauth.Actor, int64, string, string) (domain.User, error)
}

type Handler struct {
	profiles ProfileUpdater
}

type UpdateProfileRequest struct {
	RealName    *string `json:"real_name"`
	PhoneNumber *string `json:"phone_number"`
}

type ProfileResponse struct {
	ID          int64   `json:"id"`
	Nickname    string  `json:"nickname"`
	AvatarURL   *string `json:"avatar_url"`
	RealName    *string `json:"real_name"`
	PhoneNumber *string `json:"phone_number"`
	Status      string  `json:"status"`
}

func NewHandler(profiles ProfileUpdater) *Handler {
	return &Handler{profiles: profiles}
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球员 ID 无效"))
		return
	}
	var request UpdateProfileRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球员资料无效"))
		return
	}
	user, err := h.profiles.Update(c.Request.Context(), actor, userID, stringValue(request.RealName), stringValue(request.PhoneNumber))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, ProfileResponse{
		ID: user.ID, Nickname: user.Nickname, AvatarURL: user.AvatarURL,
		RealName: user.RealName, PhoneNumber: user.PhoneNumber, Status: string(user.Status),
	})
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.PATCH("/users/:id/profile", h.UpdateProfile)
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
