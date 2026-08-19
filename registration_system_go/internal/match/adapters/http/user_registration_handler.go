package matchhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type UserRegistrationUseCase interface {
	Put(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID, application.PutMyRegistrationCommand) (domain.Registration, error)
	Delete(context.Context, sharedauth.Actor, uuid.UUID, uuid.UUID) (domain.Registration, error)
}

type UserRegistrationHandler struct {
	service UserRegistrationUseCase
}

type MyRegistrationRequest struct {
	Status            domain.RegistrationStatus `json:"status" binding:"required"`
	RegistrationCount int                       `json:"registration_count" binding:"required"`
}

type MyRegistrationResponse struct {
	GroupID           string                    `json:"group_id"`
	UserID            int64                     `json:"user_id"`
	Status            domain.RegistrationStatus `json:"status"`
	RegistrationCount int                       `json:"registration_count"`
	Paid              bool                      `json:"paid"`
	UpdatedAt         time.Time                 `json:"updated_at"`
}

func NewUserRegistrationHandler(service UserRegistrationUseCase) *UserRegistrationHandler {
	return &UserRegistrationHandler{service: service}
}

func (h *UserRegistrationHandler) Put(c *gin.Context) {
	actor, matchID, groupID, ok := userRegistrationRouteContext(c)
	if !ok {
		return
	}
	var request MyRegistrationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "报名信息不完整"))
		return
	}
	registration, err := h.service.Put(c.Request.Context(), actor, matchID, groupID, application.PutMyRegistrationCommand{
		Status: request.Status, RegistrationCount: request.RegistrationCount,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMyRegistration(registration))
}

func (h *UserRegistrationHandler) Delete(c *gin.Context) {
	actor, matchID, groupID, ok := userRegistrationRouteContext(c)
	if !ok {
		return
	}
	registration, err := h.service.Delete(c.Request.Context(), actor, matchID, groupID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMyRegistration(registration))
}

func (h *UserRegistrationHandler) RegisterRoutes(group *gin.RouterGroup) {
	path := "/matches/:id/groups/:group_id/my-registration"
	group.PUT(path, h.Put)
	group.DELETE(path, h.Delete)
}

func userRegistrationRouteContext(c *gin.Context) (sharedauth.Actor, uuid.UUID, uuid.UUID, bool) {
	actor, ok := userActor(c)
	if !ok {
		return sharedauth.Actor{}, uuid.Nil, uuid.Nil, false
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, uuid.Nil, false
	}
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "报名组 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, uuid.Nil, false
	}
	return actor, matchID, groupID, true
}

func mapMyRegistration(registration domain.Registration) MyRegistrationResponse {
	return MyRegistrationResponse{
		GroupID: registration.GroupID.String(), UserID: registration.UserID, Status: registration.Status,
		RegistrationCount: registration.RegistrationCount, Paid: registration.Paid, UpdatedAt: registration.UpdatedAt,
	}
}
