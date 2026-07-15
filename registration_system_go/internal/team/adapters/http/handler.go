package teamhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type TeamQuery interface {
	ListByUser(context.Context, int64) ([]domain.TeamMembership, error)
	ListActive(context.Context) ([]domain.Team, error)
	CreateTeam(context.Context, sharedauth.Actor, string, *string) (domain.Team, error)
}

type Handler struct {
	query TeamQuery
}

type TeamMembershipResponse struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joined_at"`
}

func NewHandler(query TeamQuery) *Handler {
	return &Handler{query: query}
}

func (h *Handler) MyTeams(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	items, err := h.query.ListByUser(c.Request.Context(), actor.ID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]TeamMembershipResponse, 0, len(items))
	for _, item := range items {
		response = append(response, TeamMembershipResponse{
			ID:          item.Team.ID,
			Name:        item.Team.Name,
			Description: item.Team.Description,
			LogoURL:     item.Team.LogoURL,
			Role:        string(item.Member.Role),
			JoinedAt:    item.Member.JoinedAt.Format("2006-01-02T15:04:05"),
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func (h *Handler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.GET("/teams/my", h.MyTeams)
}

func (h *Handler) AdminTeams(c *gin.Context) {
	items, err := h.query.ListActive(c.Request.Context())
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]TeamOptionResponse, 0, len(items))
	for _, item := range items {
		response = append(response, TeamOptionResponse{ID: item.ID, Name: item.Name, LogoURL: item.LogoURL})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

type TeamOptionResponse struct {
	ID      int64   `json:"id"`
	Name    string  `json:"name"`
	LogoURL *string `json:"logo_url"`
}

type CreateTeamRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

func (h *Handler) AdminCreateTeam(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok || !actor.IsAdmin() {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	var request CreateTeamRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队名称不能为空"))
		return
	}
	team, err := h.query.CreateTeam(c.Request.Context(), actor, request.Name, request.Description)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, TeamOptionResponse{ID: team.ID, Name: team.Name, LogoURL: team.LogoURL})
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/teams", h.AdminTeams)
	group.POST("/teams", h.AdminCreateTeam)
}
