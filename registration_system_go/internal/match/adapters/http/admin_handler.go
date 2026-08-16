package matchhttp

import (
	"context"
	"encoding/json"
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

type AdminMatchUseCase interface {
	List(context.Context, sharedauth.Actor, application.AdminMatchListQuery) (application.AdminMatchListResult, error)
	Get(context.Context, sharedauth.Actor, uuid.UUID) (application.AdminMatchDetail, error)
	UpdateDetails(context.Context, sharedauth.Actor, uuid.UUID, application.UpdateMatchCommand) (domain.Match, error)
	ChangeStatus(context.Context, sharedauth.Actor, uuid.UUID, domain.MatchStatus) (domain.Match, error)
	Delete(context.Context, sharedauth.Actor, uuid.UUID) error
}

type CreateMatchUseCase interface {
	Execute(context.Context, sharedauth.Actor, application.CreateMatchCommand) (application.CreateMatchResult, error)
}

type AdminHandler struct {
	service AdminMatchUseCase
	create  CreateMatchUseCase
}

func NewAdminHandler(service AdminMatchUseCase, create CreateMatchUseCase) *AdminHandler {
	return &AdminHandler{service: service, create: create}
}

type CreateMatchRequest struct {
	Name                string                 `json:"name" binding:"required"`
	PublicationMode     domain.PublicationMode `json:"publication_mode" binding:"required"`
	HostTeamID          int64                  `json:"host_team_id" binding:"required"`
	OpponentName        *string                `json:"opponent_name"`
	PlayersPerTeam      int                    `json:"players_per_team" binding:"required"`
	HostCapacityLimit   *int                   `json:"host_capacity_limit"`
	StartTime           time.Time              `json:"start_time" binding:"required"`
	EndTime             time.Time              `json:"end_time" binding:"required"`
	RegistrationStartAt *time.Time             `json:"registration_start_at"`
	RegistrationEndAt   *time.Time             `json:"registration_end_at"`
	Location            string                 `json:"location" binding:"required"`
	LocationLatitude    *float64               `json:"location_latitude"`
	LocationLongitude   *float64               `json:"location_longitude"`
	Description         *string                `json:"description"`
}

type UpdateMatchRequest struct {
	Name                string                   `json:"name" binding:"required"`
	StartTime           time.Time                `json:"start_time" binding:"required"`
	EndTime             time.Time                `json:"end_time" binding:"required"`
	RegistrationStartAt optionalTimestampRequest `json:"registration_start_at"`
	RegistrationEndAt   optionalTimestampRequest `json:"registration_end_at"`
	Location            string                   `json:"location" binding:"required"`
	LocationLatitude    *float64                 `json:"location_latitude"`
	LocationLongitude   *float64                 `json:"location_longitude"`
	Description         *string                  `json:"description"`
}

type optionalTimestampRequest struct {
	set   bool
	value *time.Time
}

func (r *optionalTimestampRequest) UnmarshalJSON(data []byte) error {
	r.set = true
	return json.Unmarshal(data, &r.value)
}

func (r optionalTimestampRequest) commandValue() application.OptionalTimestamp {
	return application.OptionalTimestamp{Set: r.set, Value: r.value}
}

type UpdateMatchStatusRequest struct {
	Status domain.MatchStatus `json:"status" binding:"required"`
}

type MatchResponse struct {
	ID                  string                 `json:"id"`
	Name                string                 `json:"name"`
	PublicationMode     domain.PublicationMode `json:"publication_mode"`
	OpponentState       domain.OpponentState   `json:"opponent_state"`
	Status              domain.MatchStatus     `json:"status"`
	HostTeamID          int64                  `json:"host_team_id"`
	HostTeamName        string                 `json:"host_team_name"`
	AwayTeamID          *int64                 `json:"away_team_id"`
	AwayTeamName        *string                `json:"away_team_name"`
	OpponentName        *string                `json:"opponent_name"`
	PlayersPerTeam      int                    `json:"players_per_team"`
	StartTime           time.Time              `json:"start_time"`
	EndTime             time.Time              `json:"end_time"`
	RegistrationStartAt *time.Time             `json:"registration_start_at"`
	RegistrationEndAt   *time.Time             `json:"registration_end_at"`
	Location            string                 `json:"location"`
	LocationLatitude    *float64               `json:"location_latitude"`
	LocationLongitude   *float64               `json:"location_longitude"`
	Description         *string                `json:"description"`
	CreatedByUserID     *int64                 `json:"created_by_user_id"`
	CreatedByAdminID    *int64                 `json:"created_by_admin_id"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

type GroupResponse struct {
	ID            string                      `json:"id"`
	Kind          domain.GroupKind            `json:"kind"`
	TeamID        *int64                      `json:"team_id"`
	MinPlayers    *int                        `json:"min_players"`
	MaxPlayers    *int                        `json:"max_players"`
	Status        domain.GroupStatus          `json:"status"`
	Registrations []RegistrationEntryResponse `json:"registrations"`
}

// RegistrationEntryResponse 是报名组花名册中的一名队员；
// Status 为 unregistered 表示该成员还没有报名记录。
type RegistrationEntryResponse struct {
	UserID     int64   `json:"user_id"`
	Nickname   string  `json:"nickname"`
	RealName   *string `json:"real_name"`
	AvatarURL  *string `json:"avatar_url"`
	MemberRole *string `json:"member_role"`
	Status     string  `json:"status"`
}

type MatchDetailResponse struct {
	Match  MatchResponse   `json:"match"`
	Groups []GroupResponse `json:"groups"`
}

type MatchListResponse struct {
	Items    []MatchResponse `json:"items"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

func (h *AdminHandler) List(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	query, err := parseListQuery(c)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	result, err := h.service.List(c.Request.Context(), actor, query)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]MatchResponse, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, mapMatch(item))
	}
	sharedhttpapi.WriteSuccess(c, MatchListResponse{Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize})
}

func (h *AdminHandler) Get(c *gin.Context) {
	actor, id, ok := actorAndMatchID(c)
	if !ok {
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapDetail(detail))
}

func (h *AdminHandler) Create(c *gin.Context) {
	actor, ok := adminActor(c)
	if !ok {
		return
	}
	var request CreateMatchRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛信息不完整"))
		return
	}
	result, err := h.create.Execute(c.Request.Context(), actor, application.CreateMatchCommand{
		Name: request.Name, PublicationMode: request.PublicationMode, HostTeamID: request.HostTeamID,
		OpponentName: request.OpponentName, PlayersPerTeam: request.PlayersPerTeam,
		HostCapacityLimit: request.HostCapacityLimit, StartTime: request.StartTime, EndTime: request.EndTime,
		RegistrationStartAt: request.RegistrationStartAt, RegistrationEndAt: request.RegistrationEndAt,
		Location: request.Location, LocationLatitude: request.LocationLatitude, LocationLongitude: request.LocationLongitude,
		Description: request.Description,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, result.Match.ID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapDetail(detail))
}

func (h *AdminHandler) Update(c *gin.Context) {
	actor, id, ok := actorAndMatchID(c)
	if !ok {
		return
	}
	var request UpdateMatchRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛信息不完整"))
		return
	}
	_, err := h.service.UpdateDetails(c.Request.Context(), actor, id, application.UpdateMatchCommand{
		Name: request.Name, StartTime: request.StartTime, EndTime: request.EndTime,
		RegistrationStartAt: request.RegistrationStartAt.commandValue(), RegistrationEndAt: request.RegistrationEndAt.commandValue(), Location: request.Location,
		LocationLatitude: request.LocationLatitude, LocationLongitude: request.LocationLongitude, Description: request.Description,
	})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapDetail(detail))
}

func (h *AdminHandler) ChangeStatus(c *gin.Context) {
	actor, id, ok := actorAndMatchID(c)
	if !ok {
		return
	}
	var request UpdateMatchStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛状态不能为空"))
		return
	}
	if _, err := h.service.ChangeStatus(c.Request.Context(), actor, id, request.Status); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapDetail(detail))
}

func (h *AdminHandler) Delete(c *gin.Context) {
	actor, id, ok := actorAndMatchID(c)
	if !ok {
		return
	}
	if err := h.service.Delete(c.Request.Context(), actor, id); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"id": id.String()})
}

func (h *AdminHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/matches", h.List)
	group.POST("/matches", h.Create)
	group.GET("/matches/:id", h.Get)
	group.PATCH("/matches/:id", h.Update)
	group.PATCH("/matches/:id/status", h.ChangeStatus)
	group.DELETE("/matches/:id", h.Delete)
}

func parseListQuery(c *gin.Context) (application.AdminMatchListQuery, error) {
	query := application.AdminMatchListQuery{Search: c.Query("search")}
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

func adminActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok || !actor.IsAdmin() {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, false
	}
	return actor, true
}

func actorAndMatchID(c *gin.Context) (sharedauth.Actor, uuid.UUID, bool) {
	actor, ok := adminActor(c)
	if !ok {
		return sharedauth.Actor{}, uuid.Nil, false
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return sharedauth.Actor{}, uuid.Nil, false
	}
	return actor, id, true
}

func mapMatch(item ports.AdminMatchItem) MatchResponse {
	match := item.Match
	return MatchResponse{
		ID: match.ID.String(), Name: match.Name, PublicationMode: match.PublicationMode, OpponentState: match.OpponentState,
		Status: match.Status, HostTeamID: match.HostTeamID, HostTeamName: item.HostTeamName,
		AwayTeamID: match.AwayTeamID, AwayTeamName: item.AwayTeamName, OpponentName: match.OpponentName,
		PlayersPerTeam: match.PlayersPerTeam, StartTime: match.StartTime, EndTime: match.EndTime,
		RegistrationStartAt: match.RegistrationStartAt, RegistrationEndAt: match.RegistrationEndAt,
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description, CreatedByUserID: match.CreatedByUserID, CreatedByAdminID: match.CreatedByAdminID,
		CreatedAt: match.CreatedAt, UpdatedAt: match.UpdatedAt,
	}
}

func mapDetail(detail application.AdminMatchDetail) MatchDetailResponse {
	rostersByGroup := make(map[uuid.UUID][]ports.AdminRosterEntry, len(detail.Rosters))
	for _, roster := range detail.Rosters {
		rostersByGroup[roster.GroupID] = roster.Entries
	}
	groups := make([]GroupResponse, 0, len(detail.Groups))
	for _, group := range detail.Groups {
		groups = append(groups, GroupResponse{
			ID: group.ID.String(), Kind: group.Kind, TeamID: group.TeamID,
			MinPlayers: group.MinPlayers, MaxPlayers: group.MaxPlayers, Status: group.Status,
			Registrations: mapRegistrations(rostersByGroup[group.ID]),
		})
	}
	return MatchDetailResponse{Match: mapMatch(detail.Item), Groups: groups}
}

func mapRegistrations(entries []ports.AdminRosterEntry) []RegistrationEntryResponse {
	registrations := make([]RegistrationEntryResponse, 0, len(entries))
	for _, entry := range entries {
		status := "unregistered"
		if entry.Status != nil {
			status = string(*entry.Status)
		}
		registrations = append(registrations, RegistrationEntryResponse{
			UserID: entry.UserID, Nickname: entry.Nickname, RealName: entry.RealName,
			AvatarURL: entry.AvatarURL, MemberRole: entry.MemberRole, Status: status,
		})
	}
	return registrations
}
