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
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type TeamQuery interface {
	ListByUser(context.Context, int64) ([]domain.TeamMembership, error)
	ListTeams(context.Context, sharedauth.Actor, *domain.TeamStatus) ([]domain.Team, error)
	GetTeam(context.Context, sharedauth.Actor, int64) (domain.Team, error)
	CreateTeam(context.Context, sharedauth.Actor, string, *string) (domain.Team, error)
	UpdateTeam(context.Context, sharedauth.Actor, int64, string, *string, domain.TeamStatus) (domain.Team, error)
	DeleteTeam(context.Context, sharedauth.Actor, int64) error
}

type Handler struct {
	query   TeamQuery
	members TeamMembers
}

type TeamMembershipResponse struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joined_at"`
}

func NewHandler(query TeamQuery, members TeamMembers) *Handler {
	return &Handler{query: query, members: members}
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
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	var status *domain.TeamStatus
	if value := c.Query("status"); value != "" {
		parsed := domain.TeamStatus(value)
		status = &parsed
	}
	items, err := h.query.ListTeams(c.Request.Context(), actor, status)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]TeamResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapTeam(item))
	}
	sharedhttpapi.WriteSuccess(c, response)
}

type TeamResponse struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Description *string           `json:"description"`
	LogoURL     *string           `json:"logo_url"`
	CaptainID   *int64            `json:"captain_id"`
	Status      domain.TeamStatus `json:"status"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type CreateTeamRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

func (h *Handler) AdminCreateTeam(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
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
	sharedhttpapi.WriteSuccess(c, mapTeam(team))
}

func (h *Handler) AdminGetTeam(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	team, err := h.query.GetTeam(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeam(team))
}

type UpdateTeamRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description *string           `json:"description"`
	Status      domain.TeamStatus `json:"status" binding:"required"`
}

func (h *Handler) AdminUpdateTeam(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	var request UpdateTeamRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队名称和状态不能为空"))
		return
	}
	team, err := h.query.UpdateTeam(c.Request.Context(), actor, teamID, request.Name, request.Description, request.Status)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeam(team))
}

func (h *Handler) AdminDeleteTeam(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	if err := h.query.DeleteTeam(c.Request.Context(), actor, teamID); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"id": teamID})
}

func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/teams", h.AdminTeams)
	group.POST("/teams", h.AdminCreateTeam)
	group.GET("/teams/:id", h.AdminGetTeam)
	group.PATCH("/teams/:id", h.AdminUpdateTeam)
	group.DELETE("/teams/:id", h.AdminDeleteTeam)
	h.registerAdminMemberRoutes(group)
}

func adminActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok || !actor.IsAdmin() {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, false
	}
	return actor, true
}

func adminActorAndTeamID(c *gin.Context) (sharedauth.Actor, int64, bool) {
	actor, ok := adminActor(c)
	if !ok {
		return sharedauth.Actor{}, 0, false
	}
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队 ID 无效"))
		return sharedauth.Actor{}, 0, false
	}
	return actor, teamID, true
}

func adminActorTeamAndUserID(c *gin.Context) (sharedauth.Actor, int64, int64, bool) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return sharedauth.Actor{}, 0, 0, false
	}
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户 ID 无效"))
		return sharedauth.Actor{}, 0, 0, false
	}
	return actor, teamID, userID, true
}

func mapTeam(team domain.Team) TeamResponse {
	return TeamResponse{
		ID: team.ID, Name: team.Name, Description: team.Description, LogoURL: team.LogoURL,
		CaptainID: team.CaptainID, Status: team.Status, CreatedAt: team.CreatedAt, UpdatedAt: team.UpdatedAt,
	}
}
