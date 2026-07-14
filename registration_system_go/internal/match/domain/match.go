package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type PublicationMode string

const (
	OfflineConfirmed PublicationMode = "offline_confirmed"
	OnlineTeam       PublicationMode = "online_team"
	OnlineIndividual PublicationMode = "online_individual"
)

type OpponentState string

const (
	OpponentNoRecruitment OpponentState = "no_recruitment"
	OpponentRecruiting    OpponentState = "recruiting"
	OpponentConfirmed     OpponentState = "confirmed"
)

type MatchStatus string

const (
	MatchRegistering MatchStatus = "registering"
	MatchOngoing     MatchStatus = "ongoing"
	MatchEnded       MatchStatus = "ended"
	MatchCancelled   MatchStatus = "cancelled"
)

type Match struct {
	ID                uuid.UUID
	Name              string
	PublicationMode   PublicationMode
	OpponentState     OpponentState
	Status            MatchStatus
	HostTeamID        int64
	AwayTeamID        *int64
	OpponentName      *string
	PlayersPerTeam    int
	StartTime         time.Time
	EndTime           time.Time
	Location          string
	LocationLatitude  *float64
	LocationLongitude *float64
	Description       *string
	CreatedByUserID   int64
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type NewMatchInput struct {
	Name              string
	PublicationMode   PublicationMode
	HostTeamID        int64
	CreatedByUserID   int64
	OpponentName      *string
	PlayersPerTeam    int
	HostCapacityLimit *int
	StartTime         time.Time
	EndTime           time.Time
	Location          string
	LocationLatitude  *float64
	LocationLongitude *float64
	Description       *string
	CreatedAt         time.Time
}

type IndividualLimits struct {
	MinPlayers int
	MaxPlayers int
}

func NewMatch(input NewMatchInput, individualLimits IndividualLimits) (Match, []RegistrationGroup, error) {
	if err := validateNewMatchInput(input); err != nil {
		return Match{}, nil, err
	}
	now := input.CreatedAt
	if now.IsZero() {
		now = time.Now().UTC()
	}
	matchID := uuid.New()
	opponentState := OpponentRecruiting
	if input.PublicationMode == OfflineConfirmed {
		opponentState = OpponentNoRecruitment
	}
	match := Match{
		ID:                matchID,
		Name:              strings.TrimSpace(input.Name),
		PublicationMode:   input.PublicationMode,
		OpponentState:     opponentState,
		Status:            MatchRegistering,
		HostTeamID:        input.HostTeamID,
		OpponentName:      trimOptional(input.OpponentName),
		PlayersPerTeam:    input.PlayersPerTeam,
		StartTime:         input.StartTime,
		EndTime:           input.EndTime,
		Location:          strings.TrimSpace(input.Location),
		LocationLatitude:  input.LocationLatitude,
		LocationLongitude: input.LocationLongitude,
		Description:       trimOptional(input.Description),
		CreatedByUserID:   input.CreatedByUserID,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	groups := []RegistrationGroup{NewTeamGroup(matchID, GroupHostTeam, input.HostTeamID, input.HostCapacityLimit, now)}
	if input.PublicationMode == OnlineIndividual {
		if err := individualLimits.Validate(); err != nil {
			return Match{}, nil, err
		}
		groups = append(groups, NewIndividualGroup(matchID, individualLimits, now))
	}
	return match, groups, nil
}

func ResolveIndividualLimits(playersPerTeam int, configured *IndividualLimits) (IndividualLimits, error) {
	if playersPerTeam <= 0 {
		return IndividualLimits{}, sharederror.New(sharederror.KindValidation, "每队人数必须大于 0")
	}
	if configured != nil {
		if err := configured.Validate(); err != nil {
			return IndividualLimits{}, err
		}
		return *configured, nil
	}
	return IndividualLimits{MinPlayers: playersPerTeam, MaxPlayers: playersPerTeam + 2}, nil
}

func (l IndividualLimits) Validate() error {
	if l.MinPlayers <= 0 || l.MaxPlayers <= 0 || l.MinPlayers > l.MaxPlayers {
		return sharederror.New(sharederror.KindValidation, "散人报名人数规则无效")
	}
	return nil
}

func (m *Match) ConfirmTeamOpponent(awayTeamID int64) error {
	if m.PublicationMode != OnlineTeam || m.OpponentState != OpponentRecruiting {
		return sharederror.New(sharederror.KindConflict, "当前比赛不能选择球队对手")
	}
	if awayTeamID <= 0 || awayTeamID == m.HostTeamID {
		return sharederror.New(sharederror.KindValidation, "对手球队无效")
	}
	m.AwayTeamID = &awayTeamID
	m.OpponentState = OpponentConfirmed
	return nil
}

func (m *Match) ReopenTeamRecruitment() error {
	if m.PublicationMode != OnlineTeam || m.AwayTeamID == nil {
		return sharederror.New(sharederror.KindConflict, "当前比赛没有可退出的球队对手")
	}
	m.AwayTeamID = nil
	m.OpponentState = OpponentRecruiting
	return nil
}

func (m *Match) RecalculateIndividualOpponent(activePlayers int) error {
	if m.PublicationMode != OnlineIndividual {
		return sharederror.New(sharederror.KindConflict, "当前比赛不是散人对手模式")
	}
	if activePlayers < 0 {
		return sharederror.New(sharederror.KindValidation, "报名人数不能为负数")
	}
	m.OpponentState = OpponentRecruiting
	return nil
}

func validateNewMatchInput(input NewMatchInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return sharederror.New(sharederror.KindValidation, "比赛名称不能为空")
	}
	if strings.TrimSpace(input.Location) == "" {
		return sharederror.New(sharederror.KindValidation, "比赛场地不能为空")
	}
	if input.HostTeamID <= 0 || input.CreatedByUserID <= 0 {
		return sharederror.New(sharederror.KindValidation, "发布球队或用户无效")
	}
	if input.PlayersPerTeam <= 0 {
		return sharederror.New(sharederror.KindValidation, "每队人数必须大于 0")
	}
	if input.EndTime.IsZero() || !input.EndTime.After(input.StartTime) {
		return sharederror.New(sharederror.KindValidation, "结束时间必须晚于开始时间")
	}
	if input.HostCapacityLimit != nil && *input.HostCapacityLimit <= 0 {
		return sharederror.New(sharederror.KindValidation, "本队报名上限必须大于 0")
	}
	if (input.LocationLatitude == nil) != (input.LocationLongitude == nil) {
		return sharederror.New(sharederror.KindValidation, "场地经纬度必须同时提供")
	}
	if input.LocationLatitude != nil && (*input.LocationLatitude < -90 || *input.LocationLatitude > 90 || *input.LocationLongitude < -180 || *input.LocationLongitude > 180) {
		return sharederror.New(sharederror.KindValidation, "场地经纬度超出范围")
	}
	opponentName := trimOptional(input.OpponentName)
	switch input.PublicationMode {
	case OfflineConfirmed:
		if opponentName == nil {
			return sharederror.New(sharederror.KindValidation, "线下已约比赛必须填写对手名称")
		}
	case OnlineTeam, OnlineIndividual:
		if opponentName != nil {
			return sharederror.New(sharederror.KindValidation, "线上约队不能填写手工对手名称")
		}
	default:
		return sharederror.New(sharederror.KindValidation, "比赛发布模式无效")
	}
	return nil
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
