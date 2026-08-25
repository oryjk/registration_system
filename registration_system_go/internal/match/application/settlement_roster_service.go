package application

import (
	"context"

	"github.com/google/uuid"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

// SettlementAttendee / SettlementRoster 面向队费结算的只读名单视图。
type SettlementAttendee struct {
	UserID   int64
	Nickname string
	TeamID   int64 // 0 = 散人（individual_opponent 组），不参与队费扣款
	Paid     bool  // 赛前报名费已付，结算跳过
}

type SettlementRoster struct {
	MatchID           uuid.UUID
	MatchName         string
	Status            matchdomain.MatchStatus
	PaymentMode       matchdomain.PaymentMode
	FeePerPersonCents int64
	HostTeamID        *int64
	AwayTeamID        *int64
	Attendees         []SettlementAttendee
}

// SettlementRosterSource 供 teamfund 模块加载结算名单（端口，由本服务实现）。
type SettlementRosterSource interface {
	LoadSettlementRoster(ctx context.Context, matchID uuid.UUID) (SettlementRoster, bool, error)
}

type settlementRosterRepository interface {
	FindByID(context.Context, uuid.UUID) (matchdomain.Match, []matchdomain.RegistrationGroup, bool, error)
	ListSettlementAttendees(context.Context, uuid.UUID) ([]matchdomain.SettlementAttendee, error)
}

type SettlementRosterService struct {
	repository settlementRosterRepository
}

func NewSettlementRosterService(repository settlementRosterRepository) *SettlementRosterService {
	return &SettlementRosterService{repository: repository}
}

func (s *SettlementRosterService) LoadSettlementRoster(ctx context.Context, matchID uuid.UUID) (SettlementRoster, bool, error) {
	match, _, found, err := s.repository.FindByID(ctx, matchID)
	if err != nil || !found {
		return SettlementRoster{}, false, err
	}
	rows, err := s.repository.ListSettlementAttendees(ctx, matchID)
	if err != nil {
		return SettlementRoster{}, false, err
	}
	attendees := make([]SettlementAttendee, 0, len(rows))
	for _, row := range rows {
		// TeamID 以出场名单 SQL join 出的值为准（单一数据源）；
		// 散人组 team_id 为 NULL 映射为 0，由结算规则过滤。
		attendees = append(attendees, SettlementAttendee{
			UserID:   row.UserID,
			Nickname: row.Nickname,
			TeamID:   row.TeamID,
			Paid:     row.Paid,
		})
	}
	return SettlementRoster{
		MatchID: match.ID, MatchName: match.Name, Status: match.Status,
		PaymentMode: match.PaymentMode, FeePerPersonCents: match.FeePerPersonCents,
		HostTeamID: match.HostTeamID, AwayTeamID: match.AwayTeamID, Attendees: attendees,
	}, true, nil
}
