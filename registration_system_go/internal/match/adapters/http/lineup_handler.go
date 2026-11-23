package matchhttp

import (
	"context"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// LineupUseCase 定义比赛排阵型 HTTP 适配器依赖的应用层能力。
type LineupUseCase interface {
	Get(context.Context, uuid.UUID) (application.LineupView, bool, error)
	Save(context.Context, sharedauth.Actor, uuid.UUID, string, []domain.LineupSlot) (application.LineupView, error)
	GenerateMiniCode(context.Context, sharedauth.Actor, uuid.UUID, string) (string, error)
}

type LineupHandler struct {
	service LineupUseCase
}

func NewLineupHandler(service LineupUseCase) *LineupHandler {
	return &LineupHandler{service: service}
}

type LineupSlotDTO struct {
	Slot         int     `json:"slot"`
	PlayerID     *int64  `json:"player_id"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	SubPlayerIDs []int64 `json:"sub_player_ids"`
}

type LineupPlayerResponse struct {
	UserID    int64   `json:"user_id"`
	Nickname  string  `json:"nickname"`
	AvatarURL *string `json:"avatar_url"`
}

type MatchLineupResponse struct {
	MatchID         string                 `json:"match_id"`
	PlayersPerTeam  int                    `json:"players_per_team"`
	Formation       string                 `json:"formation"`
	Slots           []LineupSlotDTO        `json:"slots"`
	Players         []LineupPlayerResponse `json:"players"`
	UpdatedByUserID *int64                 `json:"updated_by_user_id"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type LineupMatchSummaryResponse struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Status          domain.MatchStatus     `json:"status"`
	PublicationMode domain.PublicationMode `json:"publication_mode"`
	HostTeamID      *int64                 `json:"host_team_id"`
	AwayTeamID      *int64                 `json:"away_team_id"`
	HostTeamName    string                 `json:"host_team_name,omitempty"`
	AwayTeamName    string                 `json:"away_team_name,omitempty"`
	OpponentName    *string                `json:"opponent_name"`
	PlayersPerTeam  int                    `json:"players_per_team"`
	StartTime       time.Time              `json:"start_time"`
	EndTime         time.Time              `json:"end_time"`
	Location        string                 `json:"location"`
	ShareBgImageURL string                 `json:"share_bg_image_url"`
	ShareBgUnlocked bool                   `json:"share_bg_unlocked"`
	CreatedByUserID *int64                 `json:"created_by_user_id"`
}

type MatchLineupEnvelope struct {
	Lineup *MatchLineupResponse        `json:"lineup"`
	Match  *LineupMatchSummaryResponse `json:"match,omitempty"`
}

type SaveLineupRequest struct {
	Formation string          `json:"formation"`
	Slots     []LineupSlotDTO `json:"slots"`
}

type LineupMiniCodeResponse struct {
	ImageURL string `json:"image_url"`
}

// Get GET /matches/:id/lineup：公开获取比赛已保存阵型与基础比赛摘要；尚未保存时返回 {"lineup": null, "match": ...}。
func (h *LineupHandler) Get(c *gin.Context) {
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	view, found, err := h.service.Get(c.Request.Context(), matchID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	matchResp := mapLineupMatchSummaryResponse(view)
	if !found {
		sharedhttpapi.WriteSuccess(c, MatchLineupEnvelope{Lineup: nil, Match: matchResp})
		return
	}
	resp := mapMatchLineupResponse(view)
	sharedhttpapi.WriteSuccess(c, MatchLineupEnvelope{Lineup: &resp, Match: matchResp})
}

// Save PUT /matches/:id/lineup：保存比赛排阵。
func (h *LineupHandler) Save(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	var request SaveLineupRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "阵型数据无效"))
		return
	}
	slots := make([]domain.LineupSlot, 0, len(request.Slots))
	for _, s := range request.Slots {
		slots = append(slots, domain.LineupSlot{
			Slot:         s.Slot,
			PlayerID:     s.PlayerID,
			X:            s.X,
			Y:            s.Y,
			SubPlayerIDs: s.SubPlayerIDs,
		})
	}
	view, err := h.service.Save(c.Request.Context(), actor, matchID, request.Formation, slots)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	resp := mapMatchLineupResponse(view)
	sharedhttpapi.WriteSuccess(c, MatchLineupEnvelope{Lineup: &resp, Match: mapLineupMatchSummaryResponse(view)})
}

// MiniCode GET /matches/:id/lineup/mini-code?env=release|trial|develop：生成排阵分享小程序码。
func (h *LineupHandler) MiniCode(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	env := strings.TrimSpace(c.Query("env"))
	if env == "" {
		env = "release"
	}
	if env != "release" && env != "trial" && env != "develop" {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "小程序版本无效"))
		return
	}
	imageURL, err := h.service.GenerateMiniCode(c.Request.Context(), actor, matchID, env)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, LineupMiniCodeResponse{ImageURL: imageURL})
}

func (h *LineupHandler) RegisterPublicRoutes(group *gin.RouterGroup) {
	group.GET("/matches/:id/lineup", h.Get)
}

func (h *LineupHandler) RegisterUserRoutes(group *gin.RouterGroup) {
	group.PUT("/matches/:id/lineup", h.Save)
	group.GET("/matches/:id/lineup/mini-code", h.MiniCode)
}

func (h *LineupHandler) RegisterRoutes(group *gin.RouterGroup) {
	h.RegisterPublicRoutes(group)
	h.RegisterUserRoutes(group)
}

func mapLineupMatchSummaryResponse(view application.LineupView) *LineupMatchSummaryResponse {
	if view.Match.ID == uuid.Nil {
		return nil
	}
	return &LineupMatchSummaryResponse{
		ID:              view.Match.ID.String(),
		Name:            view.Match.Name,
		Status:          view.Match.Status,
		PublicationMode: view.Match.PublicationMode,
		HostTeamID:      view.Match.HostTeamID,
		AwayTeamID:      view.Match.AwayTeamID,
		HostTeamName:    view.HostTeamName,
		AwayTeamName:    view.AwayTeamName,
		OpponentName:    view.Match.OpponentName,
		PlayersPerTeam:  view.Match.PlayersPerTeam,
		StartTime:       view.Match.StartTime,
		EndTime:         view.Match.EndTime,
		Location:        view.Match.Location,
		ShareBgImageURL: view.Match.ShareBgImageURL,
		ShareBgUnlocked: view.Match.ShareBgUnlocked,
		CreatedByUserID: view.Match.CreatedByUserID,
	}
}

func mapMatchLineupResponse(view application.LineupView) MatchLineupResponse {
	slots := make([]LineupSlotDTO, 0, len(view.Lineup.Slots))
	for _, s := range view.Lineup.Slots {
		subs := s.SubPlayerIDs
		if subs == nil {
			subs = []int64{}
		}
		slots = append(slots, LineupSlotDTO{
			Slot:         s.Slot,
			PlayerID:     s.PlayerID,
			X:            s.X,
			Y:            s.Y,
			SubPlayerIDs: subs,
		})
	}
	players := make([]LineupPlayerResponse, 0, len(view.Players))
	for _, p := range view.Players {
		players = append(players, LineupPlayerResponse{
			UserID:    p.UserID,
			Nickname:  p.Nickname,
			AvatarURL: p.AvatarURL,
		})
	}
	return MatchLineupResponse{
		MatchID:         view.Lineup.MatchID.String(),
		PlayersPerTeam:  view.Lineup.PlayersPerTeam,
		Formation:       view.Lineup.Formation,
		Slots:           slots,
		Players:         players,
		UpdatedByUserID: view.Lineup.UpdatedByUserID,
		UpdatedAt:       view.Lineup.UpdatedAt,
	}
}
