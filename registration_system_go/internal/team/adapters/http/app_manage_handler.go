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
	// UpdateJoinPassword 更新入队口令：join_password 非空=设置/替换，空串=清除（开放加入）。
	UpdateJoinPassword(context.Context, sharedauth.Actor, int64, string) error
	AddMember(context.Context, sharedauth.Actor, int64, int64, domain.Role) error
	UpdateMember(context.Context, sharedauth.Actor, int64, int64, *domain.Role, *domain.MemberStatus) error
	RemoveMember(context.Context, sharedauth.Actor, int64, int64) error
	// DeleteTeam 解散球队：仅队长本人可操作。
	DeleteTeam(context.Context, sharedauth.Actor, int64) error
	// DissolveBlockers 查询阻止球队解散的进行中引用，供小程序展示处理入口。
	DissolveBlockers(context.Context, sharedauth.Actor, int64) (domain.DissolveBlockers, error)
}

type AppManageHandler struct {
	manage AppTeamManageCommands
}

func NewAppManageHandler(manage AppTeamManageCommands) *AppManageHandler {
	return &AppManageHandler{manage: manage}
}

func (h *AppManageHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.PATCH("/teams/:id", h.UpdateTeam)
	group.PUT("/teams/:id/join-password", h.UpdateJoinPassword)
	group.POST("/teams/:id/members", h.AddMember)
	group.PATCH("/teams/:id/members/:user_id", h.UpdateMember)
	group.DELETE("/teams/:id/members/:user_id", h.RemoveMember)
	group.GET("/teams/:id/dissolve-blockers", h.DissolveBlockers)
	group.DELETE("/teams/:id", h.DeleteTeam)
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

// AppUpdateJoinPasswordRequest 的 join_password 非空=设置/替换；空串=清除（开放加入）。
type AppUpdateJoinPasswordRequest struct {
	JoinPassword string `json:"join_password"`
}

func (h *AppManageHandler) UpdateJoinPassword(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	var request AppUpdateJoinPasswordRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "入队密码请求无效"))
		return
	}
	if err := h.manage.UpdateJoinPassword(c.Request.Context(), actor, teamID, request.JoinPassword); err != nil {
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

// DeleteTeam 解散球队（仅队长）；球队仍有进行中的比赛或约队申请时返回 409。
func (h *AppManageHandler) DeleteTeam(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	if err := h.manage.DeleteTeam(c.Request.Context(), actor, teamID); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{})
}

// DissolveBlockersResponse 解散球队前的引用校验结果：空列表表示可以解散。
type DissolveBlockersResponse struct {
	Matches      []DissolveBlockerMatchResponse   `json:"matches"`
	Applications []DissolveBlockerApplicationItem `json:"applications"`
}

type DissolveBlockerMatchResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
	// IsHost 本队是否为发起方（主队）；只有主队能在比赛详情页收尾/取消比赛。
	IsHost bool `json:"is_host"`
}

type DissolveBlockerApplicationItem struct {
	ID        string `json:"id"`
	MatchID   string `json:"match_id"`
	MatchName string `json:"match_name"`
	Status    string `json:"status"`
}

// DissolveBlockers 查询阻止解散的进行中引用（仅队长可查）。
func (h *AppManageHandler) DissolveBlockers(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	blockers, err := h.manage.DissolveBlockers(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := DissolveBlockersResponse{
		Matches:      make([]DissolveBlockerMatchResponse, 0, len(blockers.Matches)),
		Applications: make([]DissolveBlockerApplicationItem, 0, len(blockers.Applications)),
	}
	for _, match := range blockers.Matches {
		response.Matches = append(response.Matches, DissolveBlockerMatchResponse{
			ID:     match.ID.String(),
			Name:   match.Name,
			Status: match.Status,
			IsHost: match.IsHost,
		})
	}
	for _, application := range blockers.Applications {
		response.Applications = append(response.Applications, DissolveBlockerApplicationItem{
			ID:        application.ID.String(),
			MatchID:   application.MatchID.String(),
			MatchName: application.MatchName,
			Status:    application.Status,
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
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
