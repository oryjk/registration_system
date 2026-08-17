package teamhttp

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

// AppTeamManageCommands 是小程序侧队长/领队的球队管理写操作，与 /api/admin 严格分开。
type AppTeamManageCommands interface {
	UpdateProfile(context.Context, sharedauth.Actor, int64, *string, *string, *string) error
	AddMember(context.Context, sharedauth.Actor, int64, int64, domain.Role) error
	UpdateMember(context.Context, sharedauth.Actor, int64, int64, *domain.Role, *domain.MemberStatus) error
	RemoveMember(context.Context, sharedauth.Actor, int64, int64) error
}

type AppManageHandler struct {
	manage AppTeamManageCommands
}

func NewAppManageHandler(manage AppTeamManageCommands) *AppManageHandler {
	return &AppManageHandler{manage: manage}
}

func (h *AppManageHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.PATCH("/teams/:id", h.UpdateTeam)
	group.POST("/teams/:id/members", h.AddMember)
	group.PATCH("/teams/:id/members/:user_id", h.UpdateMember)
	group.DELETE("/teams/:id/members/:user_id", h.RemoveMember)
}

// AppUpdateTeamProfileRequest 的 description/logo_url 传空串或 null 视为清除；
// name 传 null 保持不变。小程序多传的 jersey_number/is_member 等字段直接忽略。
type AppUpdateTeamProfileRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	LogoURL     *string `json:"logo_url"`
}

func (h *AppManageHandler) UpdateTeam(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	var request AppUpdateTeamProfileRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队资料无效"))
		return
	}
	if err := h.manage.UpdateProfile(c.Request.Context(), actor, teamID, request.Name, request.Description, request.LogoURL); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{})
}

type AppAddMemberRequest struct {
	UserID int64       `json:"user_id"`
	Role   domain.Role `json:"role"`
}

func (h *AppManageHandler) AddMember(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	var request AppAddMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "成员用户不能为空"))
		return
	}
	if request.Role == "" {
		request.Role = domain.RoleMember
	}
	if err := h.manage.AddMember(c.Request.Context(), actor, teamID, request.UserID, request.Role); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{})
}

// AppUpdateMemberRequest 的 role/status 至少传一个。
type AppUpdateMemberRequest struct {
	Role   *domain.Role         `json:"role"`
	Status *domain.MemberStatus `json:"status"`
}

func (h *AppManageHandler) UpdateMember(c *gin.Context) {
	actor, teamID, userID, ok := appActorTeamAndUserID(c)
	if !ok {
		return
	}
	var request AppUpdateMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "成员信息无效"))
		return
	}
	if err := h.manage.UpdateMember(c.Request.Context(), actor, teamID, userID, request.Role, request.Status); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{})
}

func (h *AppManageHandler) RemoveMember(c *gin.Context) {
	actor, teamID, userID, ok := appActorTeamAndUserID(c)
	if !ok {
		return
	}
	if err := h.manage.RemoveMember(c.Request.Context(), actor, teamID, userID); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{})
}

func appActorTeamAndUserID(c *gin.Context) (sharedauth.Actor, int64, int64, bool) {
	actor, teamID, ok := appActorAndTeamID(c)
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
