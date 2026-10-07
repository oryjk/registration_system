package teamhttp

import (
	"context"
	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
)

type HonorShareCommands interface {
	Issue(context.Context, sharedauth.Actor, int64) (application.HonorShareView, error)
	Resolve(context.Context, sharedauth.Actor, string) (application.HonorShareView, error)
	MiniCode(context.Context, sharedauth.Actor, string, string) (string, error)
}
type HonorShareHandler struct{ service HonorShareCommands }

func NewHonorShareHandler(service HonorShareCommands) *HonorShareHandler {
	return &HonorShareHandler{service: service}
}
func (h *HonorShareHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.POST("/teams/:id/honor-share", h.Issue)
	group.GET("/honor-shares/:code", h.Resolve)
	group.POST("/honor-shares/:code/mini-code", h.MiniCode)
}

type HonorShareResponse struct {
	Code             string  `json:"code"`
	TeamID           int64   `json:"team_id"`
	UserID           int64   `json:"user_id"`
	Year             int32   `json:"year"`
	TeamName         string  `json:"team_name"`
	TeamDescription  *string `json:"team_description"`
	TeamLogoURL      *string `json:"team_logo_url"`
	Nickname         string  `json:"nickname"`
	AvatarURL        *string `json:"avatar_url"`
	Points           float64 `json:"participation_points"`
	Rank             int64   `json:"participation_rank"`
	IsPaidMember     bool    `json:"is_paid_member"`
	RequiresPassword bool    `json:"requires_password"`
	IsMember         bool    `json:"is_member"`
}

func honorResponse(v application.HonorShareView) HonorShareResponse {
	return HonorShareResponse{Code: v.Code, TeamID: v.TeamID, UserID: v.UserID, Year: v.ScoreYear, TeamName: v.TeamName, TeamDescription: v.TeamDescription, TeamLogoURL: v.TeamLogoURL, Nickname: v.Nickname, AvatarURL: v.AvatarURL, Points: float64(v.ParticipationPoints) / 10, Rank: v.ParticipationRank, IsPaidMember: v.IsPaidMember, RequiresPassword: v.RequiresPassword, IsMember: v.IsMember}
}
func (h *HonorShareHandler) Issue(c *gin.Context) {
	actor, id, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	view, err := h.service.Issue(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, honorResponse(view))
}
func (h *HonorShareHandler) Resolve(c *gin.Context) {
	actor, ok := appActor(c)
	if !ok {
		return
	}
	view, err := h.service.Resolve(c.Request.Context(), actor, c.Param("code"))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, honorResponse(view))
}
func (h *HonorShareHandler) MiniCode(c *gin.Context) {
	actor, ok := appActor(c)
	if !ok {
		return
	}
	var request struct {
		Environment string `json:"environment" binding:"required,oneof=release trial develop"`
	}
	if c.ShouldBindJSON(&request) != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "小程序版本无效"))
		return
	}
	imageURL, err := h.service.MiniCode(c.Request.Context(), actor, c.Param("code"), request.Environment)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, struct {
		ImageURL string `json:"image_url"`
	}{ImageURL: imageURL})
}
