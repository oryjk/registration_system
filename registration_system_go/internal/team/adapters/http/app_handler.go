package teamhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type AppTeamQueries interface {
	GetTeam(context.Context, sharedauth.Actor, int64) (application.AppTeamDetail, error)
	ListMembers(context.Context, sharedauth.Actor, int64) ([]application.AppTeamMember, error)
}

type AppHandler struct {
	queries AppTeamQueries
}

type AppTeamDetailResponse struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Description *string           `json:"description"`
	LogoURL     *string           `json:"logo_url"`
	CaptainID   *int64            `json:"captain_id"`
	Status      domain.TeamStatus `json:"status"`
	MyRole      domain.Role       `json:"my_role"`
}

type AppTeamMemberResponse struct {
	UserID    int64               `json:"user_id"`
	Nickname  string              `json:"nickname"`
	AvatarURL *string             `json:"avatar_url"`
	RealName  *string             `json:"real_name"`
	Role      domain.Role         `json:"role"`
	Status    domain.MemberStatus `json:"status"`
	JoinedAt  time.Time           `json:"joined_at"`
}

func NewAppHandler(queries AppTeamQueries) *AppHandler {
	return &AppHandler{queries: queries}
}

func (h *AppHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/teams/:id", h.GetTeam)
	group.GET("/teams/:id/members", h.ListMembers)
}

func (h *AppHandler) GetTeam(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	detail, err := h.queries.GetTeam(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	team := detail.Team
	sharedhttpapi.WriteSuccess(c, AppTeamDetailResponse{
		ID: team.ID, Name: team.Name, Description: team.Description, LogoURL: team.LogoURL,
		CaptainID: team.CaptainID, Status: team.Status, MyRole: detail.MyRole,
	})
}

func (h *AppHandler) ListMembers(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	items, err := h.queries.ListMembers(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]AppTeamMemberResponse, 0, len(items))
	for _, item := range items {
		response = append(response, AppTeamMemberResponse{
			UserID: item.UserID, Nickname: item.Nickname, AvatarURL: item.AvatarURL,
			RealName: item.RealName, Role: item.Role, Status: item.Status, JoinedAt: item.JoinedAt,
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func appActorAndTeamID(c *gin.Context) (sharedauth.Actor, int64, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, 0, false
	}
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队 ID 无效"))
		return sharedauth.Actor{}, 0, false
	}
	return actor, teamID, true
}
