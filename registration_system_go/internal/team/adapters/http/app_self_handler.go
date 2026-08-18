package teamhttp

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

// AppTeamSelfCommands 小程序无球队用户的自服务接口，与 /api/admin 严格分开。
type AppTeamSelfCommands interface {
	CreateTeam(ctx context.Context, actor sharedauth.Actor, name string, description *string, joinPassword *string) (domain.Team, error)
	JoinTeam(ctx context.Context, actor sharedauth.Actor, teamID int64, password *string) error
	SearchTeams(ctx context.Context, keyword string) ([]ports.AppTeamSummary, error)
	RequiresJoinPassword(ctx context.Context, teamID int64) (bool, error)
}

type AppSelfHandler struct {
	self AppTeamSelfCommands
}

func NewAppSelfHandler(self AppTeamSelfCommands) *AppSelfHandler {
	return &AppSelfHandler{self: self}
}

func (h *AppSelfHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.POST("/teams", h.CreateTeam)
	group.POST("/teams/join", h.JoinTeam)
	group.GET("/teams/search", h.SearchTeams)
	group.GET("/teams/:id/password-info", h.PasswordInfo)
}

// AppCreateTeamRequest 的 join_password 传空串或 null 表示不设入队口令。
type AppCreateTeamRequest struct {
	Name         string  `json:"name"`
	Description  *string `json:"description"`
	JoinPassword *string `json:"join_password"`
}

func (h *AppSelfHandler) CreateTeam(c *gin.Context) {
	actor, ok := appActor(c)
	if !ok {
		return
	}
	var request AppCreateTeamRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "创建球队请求无效"))
		return
	}
	team, err := h.self.CreateTeam(c.Request.Context(), actor, request.Name, request.Description, request.JoinPassword)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapTeam(team))
}

type AppJoinTeamRequest struct {
	TeamID   int64   `json:"team_id"`
	Password *string `json:"password"`
}

func (h *AppSelfHandler) JoinTeam(c *gin.Context) {
	actor, ok := appActor(c)
	if !ok {
		return
	}
	var request AppJoinTeamRequest
	if err := c.ShouldBindJSON(&request); err != nil || request.TeamID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "加入球队请求无效"))
		return
	}
	if err := h.self.JoinTeam(c.Request.Context(), actor, request.TeamID, request.Password); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"message": "加入球队成功"})
}

func (h *AppSelfHandler) SearchTeams(c *gin.Context) {
	if _, ok := appActor(c); !ok {
		return
	}
	items, err := h.self.SearchTeams(c.Request.Context(), c.Query("keyword"))
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]AppTeamSummaryResponse, 0, len(items))
	for _, item := range items {
		response = append(response, AppTeamSummaryResponse{
			TeamResponse: mapTeam(item.Team),
			MemberCount:  item.MemberCount,
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func (h *AppSelfHandler) PasswordInfo(c *gin.Context) {
	if _, ok := appActor(c); !ok {
		return
	}
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队 ID 无效"))
		return
	}
	requires, err := h.self.RequiresJoinPassword(c.Request.Context(), teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, AppTeamPasswordInfoResponse{TeamID: teamID, RequiresPassword: requires})
}

type AppTeamSummaryResponse struct {
	TeamResponse
	MemberCount int64 `json:"member_count"`
}

type AppTeamPasswordInfoResponse struct {
	TeamID           int64 `json:"team_id"`
	RequiresPassword bool  `json:"requires_password"`
}

func appActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, false
	}
	return actor, true
}
