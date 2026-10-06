package matchhttp

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type AdminRegistrationUseCase interface {
	Put(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID, int64, domain.RegistrationStatus) (domain.Registration, error)
}

type AdminRegistrationHandler struct{ service AdminRegistrationUseCase }

func NewAdminRegistrationHandler(service AdminRegistrationUseCase) *AdminRegistrationHandler {
	return &AdminRegistrationHandler{service: service}
}

func (h *AdminRegistrationHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.PATCH("/matches/:id/groups/:group_id/registrations/:user_id", h.Put)
}

func (h *AdminRegistrationHandler) Put(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "报名组 ID 无效"))
		return
	}
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "队员 ID 无效"))
		return
	}
	var request struct {
		Status domain.RegistrationStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "报名状态不完整"))
		return
	}
	registration, err := h.service.Put(c.Request.Context(), actor, matchID, groupID, userID, request.Status)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMyRegistration(registration))
}
