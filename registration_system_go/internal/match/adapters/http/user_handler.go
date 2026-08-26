package matchhttp

import (
	"context"
	"strconv"
	"strings"
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
	Home(context.Context, sharedauth.Actor) (application.UserMatchHomeResult, error)
}

type UserMatchUpdateUseCase interface {
	UpdateDetails(context.Context, sharedauth.Actor, uuid.UUID, application.UserUpdateMatchCommand) (domain.Match, error)
}

type FinishMatchUseCase interface {
	Execute(context.Context, sharedauth.Actor, uuid.UUID, application.FinishMatchCommand) (domain.Match, error)
}

type UserHandler struct {
	service UserMatchUseCase
	create  CreateMatchUseCase
	finish  FinishMatchUseCase
	update  UserMatchUpdateUseCase
}

func NewUserHandler(service UserMatchUseCase, create CreateMatchUseCase, finish FinishMatchUseCase, update UserMatchUpdateUseCase) *UserHandler {
	return &UserHandler{service: service, create: create, finish: finish, update: update}
}

type UserMatchResponse struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	PublicationMode domain.PublicationMode `json:"publication_mode"`
	OpponentState   domain.OpponentState   `json:"opponent_state"`
	Status          domain.MatchStatus     `json:"status"`
	HostTeamID      *int64                 `json:"host_team_id"`
	HostTeamName    string                 `json:"host_team_name"`
	AwayTeamID      *int64                 `json:"away_team_id"`
	AwayTeamName    *string                `json:"away_team_name"`
	OpponentName    *string                `json:"opponent_name"`
	// 发布者用户 ID：散人约球无主队，小程序靠它判定「我创建的比赛」以显示取消入口。
	CreatedByUserID     *int64             `json:"created_by_user_id"`
	PlayersPerTeam      int                `json:"players_per_team"`
	StartTime           time.Time          `json:"start_time"`
	EndTime             time.Time          `json:"end_time"`
	RegistrationStartAt *time.Time         `json:"registration_start_at"`
	RegistrationEndAt   *time.Time         `json:"registration_end_at"`
	Location            string             `json:"location"`
	LocationLatitude    *float64           `json:"location_latitude"`
	LocationLongitude   *float64           `json:"location_longitude"`
	Description         *string            `json:"description"`
	HostColor           *string            `json:"host_color"`
	AwayColor           *string            `json:"away_color"`
	IsFree              bool               `json:"is_free"`
	PaymentMode         domain.PaymentMode `json:"payment_mode"`
	FeePerPersonCents   int64              `json:"fee_per_person_cents"`
	// HostCaptain 主队队长资料（详情场景填充；无主队或未设置队长时为 null），
	// 供小程序「联系队长」留言入口使用。
	HostCaptain        *UserCaptainResponse           `json:"host_captain"`
	RegistrationGroups []UserRegistrationGroupSummary `json:"registration_groups"`
	CreatedAt          time.Time                      `json:"created_at"`
	UpdatedAt          time.Time                      `json:"updated_at"`
}

type UserCaptainResponse struct {
	UserID    int64   `json:"user_id"`
	Nickname  string  `json:"nickname"`
	AvatarURL *string `json:"avatar_url"`
}

type UserRegistrationGroupSummary struct {
	Kind           domain.GroupKind `json:"kind"`
	TeamID         *int64           `json:"team_id"`
	MinPlayers     *int             `json:"min_players"`
	MaxPlayers     *int             `json:"max_players"`
	AttendingCount int              `json:"attending_count"`
}

type UserRegistrationResponse struct {
	Status            domain.RegistrationStatus `json:"status"`
	RegistrationCount int                       `json:"registration_count"`
	Paid              bool                      `json:"paid"`
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
	Participants   []UserParticipantResponse `json:"participants"`
}

type UserParticipantResponse struct {
	UserID    int64                     `json:"user_id"`
	Nickname  string                    `json:"nickname"`
	AvatarURL *string                   `json:"avatar_url"`
	Status    domain.RegistrationStatus `json:"status"`
	// RegistrationCount 该成员报名占用的人数；散人约球一人代多人时大于 1，其余恒为 1。
	RegistrationCount int `json:"registration_count"`
	// RegisteredAt 是该成员本次报名的落库时间；为 nil 时（旧数据/未报名）调用方需自行兜底排序。
	RegisteredAt *time.Time `json:"registered_at"`
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

type UserHomeGroupResponse struct {
	ID                   string                     `json:"id"`
	Kind                 domain.GroupKind           `json:"kind"`
	Status               domain.GroupStatus         `json:"status"`
	MinPlayers           *int                       `json:"min_players"`
	MaxPlayers           *int                       `json:"max_players"`
	AttendingCount       int                        `json:"attending_count"`
	MyRegistrationStatus *domain.RegistrationStatus `json:"my_registration_status"`
	Participants         []UserParticipantResponse  `json:"participants"`
}

type UserHomeActionMatchResponse struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	PublicationMode domain.PublicationMode `json:"publication_mode"`
	Status          domain.MatchStatus     `json:"status"`
	HostTeamName    string                 `json:"host_team_name"`
	OpponentName    string                 `json:"opponent_name"`
	PlayersPerTeam  int                    `json:"players_per_team"`
	StartTime       time.Time              `json:"start_time"`
	EndTime         time.Time              `json:"end_time"`
	Location        string                 `json:"location"`
	Group           UserHomeGroupResponse  `json:"group"`
}

type UserHomeEndedMatchResponse struct {
	ID              string                    `json:"id"`
	Name            string                    `json:"name"`
	PublicationMode domain.PublicationMode    `json:"publication_mode"`
	Status          domain.MatchStatus        `json:"status"`
	HostTeamName    string                    `json:"host_team_name"`
	OpponentName    string                    `json:"opponent_name"`
	StartTime       time.Time                 `json:"start_time"`
	EndTime         time.Time                 `json:"end_time"`
	Location        string                    `json:"location"`
	Participants    []UserParticipantResponse `json:"participants"`
}

type UserMatchHomeResponse struct {
	ActionItems   []UserHomeActionMatchResponse `json:"action_items"`
	ActionHasMore bool                          `json:"action_has_more"`
	EndedItems    []UserHomeEndedMatchResponse  `json:"ended_items"`
	EndedHasMore  bool                          `json:"ended_has_more"`
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

func (h *UserHandler) Home(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	result, err := h.service.Home(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapUserHome(result))
}

func (h *UserHandler) Create(c *gin.Context) {
	actor, ok := userActor(c)
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
		Description: request.Description, IsFree: request.IsFree,
		HostColor: request.HostColor, AwayColor: request.AwayColor,
		PaymentMode: request.PaymentMode, FeePerPersonCents: request.FeePerPersonCents,
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
	sharedhttpapi.WriteSuccess(c, mapUserDetail(detail))
}

type UserUpdateMatchRequest struct {
	// OpponentName 手工对手名称；null=不改，空串=清除。
	OpponentName *string `json:"opponent_name"`
	// MaxPlayers 主队报名组人数上限；null=不改。
	MaxPlayers *int `json:"max_players"`
}

// UpdateDetails PATCH /matches/:id：主队管理者编辑比赛（当前仅对手名称与报名人数上限）。
func (h *UserHandler) UpdateDetails(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	var request UserUpdateMatchRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛修改内容无效"))
		return
	}
	if _, err := h.update.UpdateDetails(c.Request.Context(), actor, id, application.UserUpdateMatchCommand{
		OpponentName: request.OpponentName, HostCapacityLimit: request.MaxPlayers,
	}); err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	detail, err := h.service.Get(c.Request.Context(), actor, id)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, mapUserDetail(detail))
}

func (h *UserHandler) ChangeStatus(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	var request UpdateMatchStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛状态不完整"))
		return
	}
	if _, err := h.finish.Execute(c.Request.Context(), actor, id, application.FinishMatchCommand{Status: request.Status}); err != nil {
		sharedhttpapi.WriteError(c, err)
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
	group.GET("/matches/home", h.Home)
	group.POST("/matches", h.Create)
	group.GET("/matches/:id", h.Get)
	group.PATCH("/matches/:id", h.UpdateDetails)
	group.PATCH("/matches/:id/status", h.ChangeStatus)
}

func parseUserListQuery(c *gin.Context) (application.UserMatchListQuery, error) {
	query := application.UserMatchListQuery{Scope: application.MatchScope(c.Query("scope")), Search: c.Query("search")}
	if query.Scope != "" && query.Scope != application.MatchScopeAll && query.Scope != application.MatchScopeMine && query.Scope != application.MatchScopeOthers {
		return query, sharederror.New(sharederror.KindValidation, "比赛范围筛选无效")
	}
	if raw := c.Query("publication_modes"); raw != "" {
		for _, part := range strings.Split(raw, ",") {
			query.PublicationModes = append(query.PublicationModes, domain.PublicationMode(strings.TrimSpace(part)))
		}
	}
	if raw := c.Query("date_start"); raw != "" {
		dateStart, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "比赛日期筛选无效")
		}
		query.DateStart = &dateStart
	}
	if raw := c.Query("status"); raw != "" {
		status := domain.MatchStatus(raw)
		query.Status = &status
	}
	if raw := c.Query("starts_after"); raw != "" {
		startsAfter, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "开始时间筛选无效")
		}
		query.StartsAfter = &startsAfter
	}
	if raw := c.Query("ends_after"); raw != "" {
		endsAfter, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "结束时间筛选无效")
		}
		query.EndsAfter = &endsAfter
	}
	if raw := c.Query("host_team_only"); raw != "" {
		hostTeamOnly, err := strconv.ParseBool(raw)
		if err != nil {
			return query, sharederror.New(sharederror.KindValidation, "主队筛选无效")
		}
		query.HostTeamOnly = &hostTeamOnly
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
	groups := make([]UserRegistrationGroupSummary, 0, len(item.RegistrationGroups))
	for _, group := range item.RegistrationGroups {
		groups = append(groups, UserRegistrationGroupSummary{
			Kind: group.Kind, TeamID: group.TeamID,
			MinPlayers: group.MinPlayers, MaxPlayers: group.MaxPlayers,
			AttendingCount: group.AttendingCount,
		})
	}
	return UserMatchResponse{
		ID: match.ID.String(), Name: match.Name, PublicationMode: match.PublicationMode,
		OpponentState: match.OpponentState, Status: match.Status,
		HostTeamID: match.HostTeamID, HostTeamName: item.HostTeamName, CreatedByUserID: match.CreatedByUserID,
		AwayTeamID: match.AwayTeamID, AwayTeamName: item.AwayTeamName, OpponentName: match.OpponentName,
		PlayersPerTeam: match.PlayersPerTeam, StartTime: match.StartTime, EndTime: match.EndTime,
		RegistrationStartAt: match.RegistrationStartAt, RegistrationEndAt: match.RegistrationEndAt,
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description, RegistrationGroups: groups, CreatedAt: match.CreatedAt, UpdatedAt: match.UpdatedAt,
		IsFree: match.IsFree, PaymentMode: match.PaymentMode, FeePerPersonCents: match.FeePerPersonCents,
		HostColor: jerseyColorResponse(match.HostColor), AwayColor: jerseyColorResponse(match.AwayColor),
		HostCaptain: mapUserCaptainResponse(item.HostCaptain),
	}
}

func mapUserCaptainResponse(captain *ports.CaptainProfile) *UserCaptainResponse {
	if captain == nil {
		return nil
	}
	return &UserCaptainResponse{UserID: captain.UserID, Nickname: captain.Nickname, AvatarURL: captain.AvatarURL}
}

func mapUserDetail(detail application.UserMatchDetail) UserMatchDetailResponse {
	groups := make([]UserGroupResponse, 0, len(detail.Groups))
	for _, state := range detail.Groups {
		var registration *UserRegistrationResponse
		if state.MyRegistration != nil {
			registration = &UserRegistrationResponse{
				Status: state.MyRegistration.Status, RegistrationCount: state.MyRegistration.RegistrationCount,
				Paid: state.MyRegistration.Paid,
			}
		}
		groups = append(groups, UserGroupResponse{
			ID: state.Group.ID.String(), Kind: state.Group.Kind, TeamID: state.Group.TeamID,
			MinPlayers: state.Group.MinPlayers, MaxPlayers: state.Group.MaxPlayers, Status: state.Group.Status,
			AttendingCount: state.AttendingCount, MyRegistration: registration,
			Participants: mapUserParticipantResponses(state.Participants),
		})
	}
	return UserMatchDetailResponse{Match: mapUserMatch(detail.Item), Groups: groups}
}

func mapUserParticipantResponses(participants []ports.UserParticipant) []UserParticipantResponse {
	responses := make([]UserParticipantResponse, 0, len(participants))
	for _, participant := range participants {
		responses = append(responses, UserParticipantResponse{
			UserID: participant.UserID, Nickname: participant.Nickname,
			AvatarURL: participant.AvatarURL, Status: participant.Status,
			RegistrationCount: participant.RegistrationCount, RegisteredAt: participant.RegisteredAt,
		})
	}
	return responses
}

func mapUserHome(result application.UserMatchHomeResult) UserMatchHomeResponse {
	actions := make([]UserHomeActionMatchResponse, 0, len(result.ActionItems))
	for _, item := range result.ActionItems {
		var registrationStatus *domain.RegistrationStatus
		if item.Group.MyRegistration != nil {
			status := item.Group.MyRegistration.Status
			registrationStatus = &status
		}
		match := item.Item.Match
		actions = append(actions, UserHomeActionMatchResponse{
			ID: match.ID.String(), Name: match.Name, PublicationMode: match.PublicationMode, Status: match.Status,
			HostTeamName: item.Item.HostTeamName, OpponentName: userOpponentName(item.Item),
			PlayersPerTeam: match.PlayersPerTeam, StartTime: match.StartTime, EndTime: match.EndTime,
			Location: match.Location,
			Group: UserHomeGroupResponse{
				ID: item.Group.Group.ID.String(), Kind: item.Group.Group.Kind, Status: item.Group.Group.Status,
				MinPlayers: item.Group.Group.MinPlayers, MaxPlayers: item.Group.Group.MaxPlayers,
				AttendingCount: item.Group.AttendingCount, MyRegistrationStatus: registrationStatus,
				Participants: mapUserParticipantResponses(item.Group.Participants),
			},
		})
	}
	ended := make([]UserHomeEndedMatchResponse, 0, len(result.EndedItems))
	for _, item := range result.EndedItems {
		match := item.Match
		ended = append(ended, UserHomeEndedMatchResponse{
			ID: match.ID.String(), Name: match.Name, PublicationMode: match.PublicationMode, Status: match.Status,
			HostTeamName: item.HostTeamName, OpponentName: userOpponentName(item),
			StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location,
			Participants: mapUserParticipantResponses(item.Participants),
		})
	}
	return UserMatchHomeResponse{
		ActionItems: actions, ActionHasMore: result.ActionHasMore,
		EndedItems: ended, EndedHasMore: result.EndedHasMore,
	}
}

func userOpponentName(item ports.MatchItem) string {
	if item.AwayTeamName != nil {
		return *item.AwayTeamName
	}
	if item.Match.OpponentName != nil {
		return *item.Match.OpponentName
	}
	return ""
}

// jerseyColorResponse 把领域层颜色（空串=未设置）映射为可空 JSON 字段。
func jerseyColorResponse(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
