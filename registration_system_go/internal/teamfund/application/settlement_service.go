package application

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfunddomain "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

const kindTeamFundDepleted = "teamfund_depleted"

// TeamAuthorizer 校验用户是否可管理该球队的比赛（队长/领队），由 team 模块实现。
type TeamAuthorizer interface {
	EnsureManager(ctx context.Context, teamID, userID int64) error
}

// NotificationSink 站内通知出口，由 notification 模块实现；发送失败不应影响结算。
type NotificationSink interface {
	Notify(ctx context.Context, message notificationapplication.SystemNotification) error
}

type SettlementRequest struct {
	MatchID     uuid.UUID
	Description string
	Items       map[int64]int64 // user_id -> amount_cents
}

type SettlementService struct {
	repository    teamfundports.Repository
	rosters       matchapplication.SettlementRosterSource
	authorizer    TeamAuthorizer
	notifications NotificationSink
}

func NewSettlementService(repository teamfundports.Repository, rosters matchapplication.SettlementRosterSource,
	authorizer TeamAuthorizer, notifications NotificationSink,
) *SettlementService {
	return &SettlementService{repository: repository, rosters: rosters, authorizer: authorizer, notifications: notifications}
}

// Settle 结算一场已结束比赛的队费扣款；已有生效批次时冲正重算。
// 扣款后余额 <=0 的队员发送站内通知（best-effort，失败仅记录日志）。
func (s *SettlementService) Settle(ctx context.Context, actor sharedauth.Actor, request SettlementRequest) (teamfundports.SettleOutcome, error) {
	roster, found, err := s.rosters.LoadSettlementRoster(ctx, request.MatchID)
	if err != nil {
		return teamfundports.SettleOutcome{}, err
	}
	if !found {
		return teamfundports.SettleOutcome{}, sharederror.ErrNotFound
	}
	if roster.Status != matchdomain.MatchEnded {
		return teamfundports.SettleOutcome{}, sharederror.New(sharederror.KindValidation, "比赛结束后才能结算")
	}
	if !actor.IsAdmin() {
		if roster.HostTeamID == nil {
			return teamfundports.SettleOutcome{}, sharederror.ErrForbidden
		}
		if err := s.authorizer.EnsureManager(ctx, *roster.HostTeamID, actor.ID); err != nil {
			return teamfundports.SettleOutcome{}, err
		}
	}
	charges, err := teamfunddomain.BuildCharges(rosterToDomainAttendees(roster.Attendees), request.Items)
	if err != nil {
		return teamfundports.SettleOutcome{}, err
	}
	description := request.Description
	if description == "" {
		description = "赛后队费扣款"
	}
	outcome, err := s.repository.SettleInTransaction(ctx, request.MatchID, actor.ID, description, chargesToPorts(charges))
	if err != nil {
		return outcome, err
	}
	rosterNames := attendeeNames(roster.Attendees)
	for index := range outcome.Items {
		outcome.Items[index].UserName = rosterNames[outcome.Items[index].UserID]
	}
	s.notifyDepleted(ctx, roster.MatchID, roster.MatchName, outcome.Items)
	return outcome, nil
}

// GetSummary 结算摘要；未结算时 items 返回可扣名单并预填人均费，供结算表单初始化。
func (s *SettlementService) GetSummary(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) (teamfundports.SettlementSummary, error) {
	roster, found, err := s.rosters.LoadSettlementRoster(ctx, matchID)
	if err != nil {
		return teamfundports.SettlementSummary{}, err
	}
	if !found {
		return teamfundports.SettlementSummary{}, sharederror.ErrNotFound
	}
	if !actor.IsAdmin() {
		if roster.HostTeamID == nil {
			return teamfundports.SettlementSummary{}, sharederror.ErrForbidden
		}
		if err := s.authorizer.EnsureManager(ctx, *roster.HostTeamID, actor.ID); err != nil {
			return teamfundports.SettlementSummary{}, err
		}
	}
	summary, err := s.repository.GetSummary(ctx, matchID)
	if err != nil {
		return summary, err
	}
	if !summary.Settled {
		for _, attendee := range roster.Attendees {
			if attendee.TeamID == 0 || attendee.Paid {
				continue
			}
			summary.Items = append(summary.Items, teamfundports.SettlementItem{
				TeamID: attendee.TeamID, UserID: attendee.UserID, UserName: attendee.Nickname,
				AmountCents: roster.FeePerPersonCents,
			})
		}
	} else {
		rosterNames := attendeeNames(roster.Attendees)
		for index := range summary.Items {
			summary.Items[index].UserName = rosterNames[summary.Items[index].UserID]
		}
	}
	return summary, nil
}

func attendeeNames(attendees []matchapplication.SettlementAttendee) map[int64]string {
	names := make(map[int64]string, len(attendees))
	for _, attendee := range attendees {
		names[attendee.UserID] = attendee.Nickname
	}
	return names
}

func (s *SettlementService) notifyDepleted(ctx context.Context, matchID uuid.UUID, matchName string, items []teamfundports.SettlementItem) {
	for _, item := range items {
		if item.AmountCents <= 0 || item.BalanceAfterCents > 0 {
			continue
		}
		message := notificationapplication.SystemNotification{
			UserID: item.UserID, Kind: kindTeamFundDepleted, Title: "队费余额不足",
			Content: fmt.Sprintf("「%s」已扣费 %s，当前队费余额 %s，请及时充值。",
				matchName, yuanLabel(item.AmountCents), balanceLabel(item.BalanceAfterCents)),
			RelatedType: "match", RelatedID: matchID.String(),
		}
		if err := s.notifications.Notify(ctx, message); err != nil {
			log.Printf("teamfund: 发送余额不足通知失败 user=%d: %v", item.UserID, err)
		}
	}
}

func rosterToDomainAttendees(attendees []matchapplication.SettlementAttendee) []teamfunddomain.Attendee {
	mapped := make([]teamfunddomain.Attendee, 0, len(attendees))
	for _, attendee := range attendees {
		mapped = append(mapped, teamfunddomain.Attendee{
			UserID: attendee.UserID, Nickname: attendee.Nickname, TeamID: attendee.TeamID, Paid: attendee.Paid,
		})
	}
	return mapped
}

func chargesToPorts(charges []teamfunddomain.Charge) []teamfundports.SettlementCharge {
	mapped := make([]teamfundports.SettlementCharge, 0, len(charges))
	for _, charge := range charges {
		mapped = append(mapped, teamfundports.SettlementCharge{
			TeamID: charge.TeamID, UserID: charge.UserID, AmountCents: charge.AmountCents,
		})
	}
	return mapped
}

func yuanLabel(cents int64) string {
	return fmt.Sprintf("¥%d.%02d", cents/100, cents%100)
}

func balanceLabel(cents int64) string {
	if cents < 0 {
		return fmt.Sprintf("欠款 ¥%d.%02d", -cents/100, -cents%100)
	}
	return yuanLabel(cents)
}
