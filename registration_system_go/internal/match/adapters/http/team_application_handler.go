package matchhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type TeamApplicationUseCase interface {
	List(context.Context, sharedauth.Actor, uuid.UUID) ([]ports.TeamApplicationItem, error)
	Apply(context.Context, sharedauth.Actor, uuid.UUID, int64, string) (domain.TeamApplication, error)
	Select(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) (domain.TeamApplication, error)
	Withdraw(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) (domain.TeamApplication, error)
}

type TeamApplicationHandler struct {
	service TeamApplicationUseCase
}

func NewTeamApplicationHandler(service TeamApplicationUseCase) *TeamApplicationHandler {
	return &TeamApplicationHandler{service: service}
}

type CreateTeamApplicationRequest struct {
	TeamID       int64  `json:"team_id" binding:"required"`
	Introduction string `json:"introduction" binding:"required"`
}

type TeamApplicationResponse struct {
	ID              string                   `json:"id"`
	MatchID         string                   `json:"match_id"`
	ApplicantTeamID int64                    `json:"applicant_team_id"`
	ApplicantTeam   string                   `json:"applicant_team_name,omitempty"`
	Introduction    string                   `json:"introduction"`
	Status          domain.ApplicationStatus `json:"status"`
	CreatedByUserID int64                    `json:"created_by_user_id"`
	SelectedAt      *time.Time               `json:"selected_at"`
	WithdrawnAt     *time.Time               `json:"withdrawn_at"`
	CreatedAt       time.Time                `json:"created_at"`
	UpdatedAt       time.Time                `json:"updated_at"`
}

func (h *TeamApplicationHandler) List(c *gin.Context) {
	actor, matchID, ok := teamApplicationActorAndMatchID(c)
	if !ok {
		return
	}
	items, err := h.service.List(c.Request.Context(), actor, matchID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]TeamApplicationResponse, 0, len(items))
	for _, item := range items {
		response = append(response, mapTeamApplication(item.Application, item.TeamName))
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func (h *TeamApplicationHandler) Apply(c *gin.Context) {
	actor, matchID, ok := teamApplicationActorAndMatchID(c)
	if !ok {
		return
	}
	var request CreateTeamApplicationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队申请信息不完整"))
		return
	}
	application, err := h.service.Apply(c.Request.Context(), actor, matchID, request.TeamID, request.Introduction)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeamApplication(application, ""))
}

func (h *TeamApplicationHandler) Select(c *gin.Context) {
	actor, matchID, applicationID, ok := teamApplicationActorAndIDs(c)
	if !ok {
		return
	}
	application, err := h.service.Select(c.Request.Context(), actor, matchID, applicationID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeamApplication(application, ""))
}

func (h *TeamApplicationHandler) Withdraw(c *gin.Context) {
	actor, matchID, applicationID, ok := teamApplicationActorAndIDs(c)
	if !ok {
		return
	}
	application, err := h.service.Withdraw(c.Request.Context(), actor, matchID, applicationID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeamApplication(application, ""))
}

func (h *TeamApplicationHandler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.GET("/matches/:id/team-applications", h.List)
	group.POST("/matches/:id/team-applications", h.Apply)
	group.POST("/matches/:id/team-applications/:application_id/select", h.Select)
	group.POST("/matches/:id/team-applications/:application_id/withdraw", h.Withdraw)
}

func (h *TeamApplicationHandler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.GET("/matches/:id/team-applications", h.List)
	group.POST("/matches/:id/team-applications/:application_id/select", h.Select)
	group.POST("/matches/:id/team-applications/:application_id/withdraw", h.Withdraw)
}

func teamApplicationActorAndMatchID(c *gin.Context) (sharedauth.Actor, uuid.UUID, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, uuid.Nil, false
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, false
	}
	return actor, matchID, true
}

func teamApplicationActorAndIDs(c *gin.Context) (sharedauth.Actor, uuid.UUID, uuid.UUID, bool) {
	actor, matchID, ok := teamApplicationActorAndMatchID(c)
	if !ok {
		return sharedauth.Actor{}, uuid.Nil, uuid.Nil, false
	}
	applicationID, err := uuid.Parse(c.Param("application_id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队申请 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, uuid.Nil, false
	}
	return actor, matchID, applicationID, true
}

func mapTeamApplication(application domain.TeamApplication, teamName string) TeamApplicationResponse {
	return TeamApplicationResponse{
		ID: application.ID.String(), MatchID: application.MatchID.String(), ApplicantTeamID: application.ApplicantTeamID,
		ApplicantTeam: teamName, Introduction: application.Introduction, Status: application.Status,
		CreatedByUserID: application.CreatedByUserID, SelectedAt: application.SelectedAt, WithdrawnAt: application.WithdrawnAt,
		CreatedAt: application.CreatedAt, UpdatedAt: application.UpdatedAt,
	}
}
