package matchhttp

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type VenueSideUseCase interface {
	Claim(context.Context, sharedauth.Actor, uuid.UUID, int64) (domain.RegistrationGroup, error)
	Withdraw(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) error
	Remove(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) error
}

type VenueSideHandler struct {
	service VenueSideUseCase
}

func NewVenueSideHandler(service VenueSideUseCase) *VenueSideHandler {
	return &VenueSideHandler{service: service}
}

type ClaimVenueSideRequest struct {
	TeamID int64 `json:"team_id" binding:"required"`
}

type VenueSideResponse struct {
	GroupID string            `json:"group_id"`
	Side    *domain.GroupSide `json:"side"`
	TeamID  *int64            `json:"team_id"`
}

func (h *VenueSideHandler) RegisterUserRoutes(group gin.IRoutes) {
	group.POST("/matches/:id/venue-sides/claim", h.Claim)
	group.POST("/matches/:id/venue-sides/:group_id/withdraw", h.Withdraw)
	group.POST("/matches/:id/venue-sides/:group_id/remove", h.Remove)
}

func (h *VenueSideHandler) Claim(c *gin.Context) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛不存在"))
		return
	}
	var request ClaimVenueSideRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "请选择球队"))
		return
	}
	group, err := h.service.Claim(c.Request.Context(), actor, matchID, request.TeamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, VenueSideResponse{GroupID: group.ID.String(), Side: group.Side, TeamID: group.TeamID})
}

func (h *VenueSideHandler) Withdraw(c *gin.Context) {
	h.release(c, h.service.Withdraw)
}

func (h *VenueSideHandler) Remove(c *gin.Context) {
	h.release(c, h.service.Remove)
}

func (h *VenueSideHandler) release(c *gin.Context, operation func(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) error) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return
	}
	matchID, matchErr := uuid.Parse(c.Param("id"))
	groupID, groupErr := uuid.Parse(c.Param("group_id"))
	if matchErr != nil || groupErr != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛或报名组无效"))
		return
	}
	if err := operation(c.Request.Context(), actor, matchID, groupID); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"released": true})
}
