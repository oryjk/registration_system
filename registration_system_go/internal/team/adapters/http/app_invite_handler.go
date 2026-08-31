package teamhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
)

// AppTeamInviteCommands 球队邀请码的签发与解析。
type AppTeamInviteCommands interface {
	Issue(ctx context.Context, actor sharedauth.Actor, teamID int64) (string, time.Time, error)
	Resolve(ctx context.Context, actor sharedauth.Actor, code string) (application.AppTeamInviteView, error)
}

type AppInviteHandler struct {
	invites AppTeamInviteCommands
}

func NewAppInviteHandler(invites AppTeamInviteCommands) *AppInviteHandler {
	return &AppInviteHandler{invites: invites}
}

func (h *AppInviteHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/teams/:id/invite-code", h.IssueCode)
	group.POST("/teams/invites/resolve", h.Resolve)
}

type AppTeamInviteCodeResponse struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
}

type AppTeamInviteViewResponse struct {
	TeamID           int64   `json:"team_id"`
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	LogoURL          *string `json:"logo_url"`
	RequiresPassword bool    `json:"requires_password"`
	IsMember         bool    `json:"is_member"`
}

// IssueCode 仅在队成员可签发邀请码（分享卡片用）。
func (h *AppInviteHandler) IssueCode(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	code, expiresAt, err := h.invites.Issue(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, AppTeamInviteCodeResponse{Code: code, ExpiresAt: expiresAt})
}

type AppTeamInviteResolveRequest struct {
	Code string `json:"code"`
}

// Resolve 校验邀请码并返回球队公开信息；无效/过期码统一 Forbidden。
func (h *AppInviteHandler) Resolve(c *gin.Context) {
	actor, ok := appActor(c)
	if !ok {
		return
	}
	var request AppTeamInviteResolveRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.Code == "" {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "邀请码不能为空"))
		return
	}
	view, err := h.invites.Resolve(c.Request.Context(), actor, request.Code)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, AppTeamInviteViewResponse{
		TeamID: view.TeamID, Name: view.Name, Description: view.Description, LogoURL: view.LogoURL,
		RequiresPassword: view.RequiresPassword, IsMember: view.IsMember,
	})
}
