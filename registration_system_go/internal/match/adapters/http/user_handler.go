package matchhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type UserMatchUseCase interface {
	List(context.Context, sharedauth.Actor, application.UserMatchListQuery) (application.UserMatchListResult, error)
	Get(context.Context, sharedauth.Actor, uuid.UUID) (application.UserMatchDetail, error)
}

type UserHandler struct {
	service UserMatchUseCase
}

func NewUserHandler(service UserMatchUseCase) *UserHandler {
	return &UserHandler{service: service}
}

type UserMatchResponse struct {
	ID                string                 `json:"id"`
	Name              string                 `json:"name"`
	PublicationMode   domain.PublicationMode `json:"publication_mode"`
	OpponentState     domain.OpponentState   `json:"opponent_state"`
	Status            domain.MatchStatus     `json:"status"`
	HostTeamID        int64                  `json:"host_team_id"`
	HostTeamName      string                 `json:"host_team_name"`
	AwayTeamID        *int64                 `json:"away_team_id"`
	AwayTeamName      *string                `json:"away_team_name"`
	OpponentName      *string                `json:"opponent_name"`
	PlayersPerTeam    int                    `json:"players_per_team"`
	StartTime         time.Time              `json:"start_time"`
	EndTime           time.Time              `json:"end_time"`
	Location          string                 `json:"location"`
	LocationLatitude  *float64               `json:"location_latitude"`
	LocationLongitude *float64               `json:"location_longitude"`
	Description       *string                `json:"description"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

type UserRegistrationResponse struct {
	Status            domain.RegistrationStatus `json:"status"`
	RegistrationCount int                       `json:"registration_count"`
}

type UserGroupResponse struct {
	ID             string                    `json:"id"`
	Kind           domain.GroupKind          `json:"kind"`
	TeamID         *int64                    `json:"team_id"`
	MinPlayers     *int                      `json:"min_players"`
	MaxPlayers     *int                      `json:"max_players"`
	Status         domain.GroupStatus        `json:"status"`
	AttendingCount int                       `json:"attending_count"`
	MyRegistration *UserRegistrationResponse `json:"my_registration"`
}

type UserMatchDetailResponse struct {
	Match  UserMatchResponse   `json:"match"`
	Groups []UserGroupResponse `json:"groups"`
}

type UserMatchListResponse struct {
	Items    []UserMatchResponse `json:"items"`
	Total    int64               `json:"total"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
}

func (h *UserHandler) List(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	query, err := parseUserListQuery(c)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	result, err := h.service.List(c.Request.Context(), actor, query)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]UserMatchResponse, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, mapUserMatch(item))
	}
	sharedhttpapi.WriteSuccess(c, UserMatchListResponse{
		Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize,
	})
}

func (h *UserHandler) Get(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapUserDetail(detail))
}

func (h *UserHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/matches", h.List)
	group.GET("/matches/:id", h.Get)
}

func parseUserListQuery(c *gin.Context) (application.UserMatchListQuery, error) {
	query := application.UserMatchListQuery{Search: c.Query("search")}
	if raw := c.Query("status"); raw != "" {
		status := domain.MatchStatus(raw)
		query.Status = &status
	}
	var err error
	if raw := c.Query("page"); raw != "" {
		query.Page, err = strconv.Atoi(raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "页码无效")
		}
	}
	if raw := c.Query("page_size"); raw != "" {
		query.PageSize, err = strconv.Atoi(raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "分页大小无效")
		}
	}
	return query, nil
}

func userActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok || !actor.IsUser() {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, false
	}
	return actor, true
}

func mapUserMatch(item ports.MatchItem) UserMatchResponse {
	match := item.Match
	return UserMatchResponse{
		ID: match.ID.String(), Name: match.Name, PublicationMode: match.PublicationMode,
		OpponentState: match.OpponentState, Status: match.Status,
		HostTeamID: match.HostTeamID, HostTeamName: item.HostTeamName,
		AwayTeamID: match.AwayTeamID, AwayTeamName: item.AwayTeamName, OpponentName: match.OpponentName,
		PlayersPerTeam: match.PlayersPerTeam, StartTime: match.StartTime, EndTime: match.EndTime,
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description, CreatedAt: match.CreatedAt, UpdatedAt: match.UpdatedAt,
	}
}

func mapUserDetail(detail application.UserMatchDetail) UserMatchDetailResponse {
	groups := make([]UserGroupResponse, 0, len(detail.Groups))
	for _, state := range detail.Groups {
		var registration *UserRegistrationResponse
		if state.MyRegistration != nil {
			registration = &UserRegistrationResponse{
				Status: state.MyRegistration.Status, RegistrationCount: state.MyRegistration.RegistrationCount,
			}
		}
		groups = append(groups, UserGroupResponse{
			ID: state.Group.ID.String(), Kind: state.Group.Kind, TeamID: state.Group.TeamID,
			MinPlayers: state.Group.MinPlayers, MaxPlayers: state.Group.MaxPlayers, Status: state.Group.Status,
			AttendingCount: state.AttendingCount, MyRegistration: registration,
		})
	}
	return UserMatchDetailResponse{Match: mapUserMatch(detail.Item), Groups: groups}
}
