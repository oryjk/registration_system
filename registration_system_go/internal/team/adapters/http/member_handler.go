package teamhttp

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type TeamMembers interface {
	List(context.Context, sharedauth.Actor, int64) (application.MemberManagementResult, error)
	ListCandidates(context.Context, sharedauth.Actor, int64, string) ([]domain.MemberCandidate, error)
	Add(context.Context, sharedauth.Actor, int64, int64, domain.Role) (application.MemberManagementResult, error)
	Update(context.Context, sharedauth.Actor, int64, int64, domain.Role, domain.MemberStatus) (application.MemberManagementResult, error)
	Remove(context.Context, sharedauth.Actor, int64, int64) (application.MemberManagementResult, error)
	SetCaptain(context.Context, sharedauth.Actor, int64, *int64) (application.MemberManagementResult, error)
}

type MemberResponse struct {
	ID        int64               `json:"id"`
	UserID    int64               `json:"user_id"`
	Nickname  string              `json:"nickname"`
	AvatarURL *string             `json:"avatar_url"`
	Role      domain.Role         `json:"role"`
	Status    domain.MemberStatus `json:"status"`
	JoinedAt  time.Time           `json:"joined_at"`
}

type MemberManagementResponse struct {
	Team    TeamResponse     `json:"team"`
	Members []MemberResponse `json:"members"`
}

type MemberCandidateResponse struct {
	UserID    int64   `json:"user_id"`
	Nickname  string  `json:"nickname"`
	AvatarURL *string `json:"avatar_url"`
}

func (h *Handler) AdminMembers(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	result, err := h.members.List(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMemberManagement(result))
}

func (h *Handler) AdminMemberCandidates(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	items, err := h.members.ListCandidates(c.Request.Context(), actor, teamID, c.Query("search"))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]MemberCandidateResponse, 0, len(items))
	for _, item := range items {
		response = append(response, MemberCandidateResponse{UserID: item.UserID, Nickname: item.Nickname, AvatarURL: item.AvatarURL})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

type AddMemberRequest struct {
	UserID int64       `json:"user_id" binding:"required"`
	Role   domain.Role `json:"role"`
}

func (h *Handler) AdminAddMember(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	var request AddMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "成员用户不能为空"))
		return
	}
	if request.Role == "" {
		request.Role = domain.RoleMember
	}
	result, err := h.members.Add(c.Request.Context(), actor, teamID, request.UserID, request.Role)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMemberManagement(result))
}

type UpdateMemberRequest struct {
	Role   domain.Role         `json:"role" binding:"required"`
	Status domain.MemberStatus `json:"status" binding:"required"`
}

func (h *Handler) AdminUpdateMember(c *gin.Context) {
	actor, teamID, userID, ok := adminActorTeamAndUserID(c)
	if !ok {
		return
	}
	var request UpdateMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "成员角色和状态不能为空"))
		return
	}
	result, err := h.members.Update(c.Request.Context(), actor, teamID, userID, request.Role, request.Status)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMemberManagement(result))
}

func (h *Handler) AdminRemoveMember(c *gin.Context) {
	actor, teamID, userID, ok := adminActorTeamAndUserID(c)
	if !ok {
		return
	}
	result, err := h.members.Remove(c.Request.Context(), actor, teamID, userID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMemberManagement(result))
}

type SetCaptainRequest struct {
	UserID *int64 `json:"user_id"`
}

func (h *Handler) AdminSetCaptain(c *gin.Context) {
	actor, teamID, ok := adminActorAndTeamID(c)
	if !ok {
		return
	}
	var request SetCaptainRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "队长信息无效"))
		return
	}
	result, err := h.members.SetCaptain(c.Request.Context(), actor, teamID, request.UserID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapMemberManagement(result))
}

func (h *Handler) registerAdminMemberRoutes(group *gin.RouterGroup) {
	group.GET("/teams/:id/members", h.AdminMembers)
	group.GET("/teams/:id/member-candidates", h.AdminMemberCandidates)
	group.POST("/teams/:id/members", h.AdminAddMember)
	group.PATCH("/teams/:id/members/:user_id", h.AdminUpdateMember)
	group.DELETE("/teams/:id/members/:user_id", h.AdminRemoveMember)
	group.PATCH("/teams/:id/captain", h.AdminSetCaptain)
}

func mapMemberManagement(result application.MemberManagementResult) MemberManagementResponse {
	members := make([]MemberResponse, 0, len(result.Members))
	for _, item := range result.Members {
		members = append(members, MemberResponse{
			ID: item.ID, UserID: item.UserID, Nickname: item.Nickname, AvatarURL: item.AvatarURL,
			Role: item.Role, Status: item.Status, JoinedAt: item.JoinedAt,
		})
	}
	return MemberManagementResponse{Team: mapTeam(result.Team), Members: members}
}
