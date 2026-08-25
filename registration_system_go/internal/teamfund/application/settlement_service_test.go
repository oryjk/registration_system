package application

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
)

type fakeRosters struct {
	roster matchapplication.SettlementRoster
	found  bool
}

func (f *fakeRosters) LoadSettlementRoster(_ context.Context, _ uuid.UUID) (matchapplication.SettlementRoster, bool, error) {
	return f.roster, f.found, nil
}

type fakeAuthorizer struct {
	allowed map[int64]bool
}

func (f fakeAuthorizer) EnsureManager(_ context.Context, _, userID int64) error {
	if f.allowed[userID] {
		return nil
	}
	return sharederror.ErrForbidden
}

type fakeNotifications struct {
	messages []notificationapplication.SystemNotification
	err      error
}

func (f *fakeNotifications) Notify(_ context.Context, message notificationapplication.SystemNotification) error {
	f.messages = append(f.messages, message)
	return f.err
}

type fakeFundRepository struct {
	charges []teamfundports.SettlementCharge
}

func (f *fakeFundRepository) SettleInTransaction(_ context.Context, _ uuid.UUID, _ int64, description string, charges []teamfundports.SettlementCharge) (teamfundports.SettleOutcome, error) {
	f.charges = charges
	items := make([]teamfundports.SettlementItem, 0, len(charges))
	total := int64(0)
	for _, charge := range charges {
		total += charge.AmountCents
		items = append(items, teamfundports.SettlementItem{
			TeamID: charge.TeamID, UserID: charge.UserID, AmountCents: charge.AmountCents, BalanceAfterCents: charge.AmountCents - 5000,
		})
	}
	return teamfundports.SettleOutcome{BatchNo: 1, Description: description, TotalAmountCents: total, Items: items}, nil
}

func (f *fakeFundRepository) GetSummary(_ context.Context, _ uuid.UUID) (teamfundports.SettlementSummary, error) {
	return teamfundports.SettlementSummary{Items: []teamfundports.SettlementItem{}, History: []teamfundports.SettlementBatch{}}, nil
}

func (f *fakeFundRepository) ListBalances(_ context.Context, _ int64) ([]teamfundports.TeamFundBalance, error) {
	return nil, nil
}

func (f *fakeFundRepository) ListTransactions(_ context.Context, _ int64, _ int64, _ int) ([]teamfundports.TeamFundTransaction, error) {
	return nil, nil
}

func (f *fakeFundRepository) AdminCredit(_ context.Context, _ teamfundports.AdminCredit) (teamfundports.AdminCreditResult, error) {
	return teamfundports.AdminCreditResult{}, nil
}

func endedRoster() matchapplication.SettlementRoster {
	hostTeam := int64(10)
	return matchapplication.SettlementRoster{
		MatchID: uuid.New(), MatchName: "周末球局", Status: matchdomain.MatchEnded,
		FeePerPersonCents: 3000, HostTeamID: &hostTeam,
		Attendees: []matchapplication.SettlementAttendee{
			{UserID: 1, Nickname: "甲", TeamID: hostTeam},
			{UserID: 2, Nickname: "乙", TeamID: hostTeam},
			{UserID: 3, Nickname: "散人"},
			{UserID: 4, Nickname: "已预付", TeamID: hostTeam, Paid: true},
		},
	}
}

func TestSettleRejectsNotEndedMatch(t *testing.T) {
	roster := endedRoster()
	roster.Status = matchdomain.MatchOngoing
	service := NewSettlementService(&fakeFundRepository{}, &fakeRosters{roster: roster, found: true}, fakeAuthorizer{}, &fakeNotifications{})
	_, err := service.Settle(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin}, SettlementRequest{MatchID: roster.MatchID})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("未结束比赛应返回校验错误，得到 %v", err)
	}
}

func TestSettleRejectsNonManager(t *testing.T) {
	roster := endedRoster()
	service := NewSettlementService(&fakeFundRepository{}, &fakeRosters{roster: roster, found: true}, fakeAuthorizer{}, &fakeNotifications{})
	_, err := service.Settle(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, SettlementRequest{MatchID: roster.MatchID})
	if !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("非管理者应返回 Forbidden，得到 %v", err)
	}
}

func TestSettleNotifiesOnlyDepletedMembers(t *testing.T) {
	roster := endedRoster()
	repository := &fakeFundRepository{}
	notifications := &fakeNotifications{}
	service := NewSettlementService(repository, &fakeRosters{roster: roster, found: true},
		fakeAuthorizer{allowed: map[int64]bool{1: true, 2: true}}, notifications)

	outcome, err := service.Settle(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 1},
		SettlementRequest{MatchID: roster.MatchID, Items: map[int64]int64{1: 3000, 2: 2000}})
	if err != nil {
		t.Fatal(err)
	}
	if len(repository.charges) != 2 || repository.charges[0].UserID != 1 {
		t.Fatalf("应仅含有球队且未预付的成员: %+v", repository.charges)
	}
	// fake 仓储里 BalanceAfter = Amount - 5000：甲=-2000（应通知），乙=-3000（应通知）
	if len(notifications.messages) != 2 {
		t.Fatalf("两位余额<=0 的成员都应被通知: %+v", notifications.messages)
	}
	if notifications.messages[0].Kind != "teamfund_depleted" || notifications.messages[0].RelatedType != "match" {
		t.Fatalf("通知应携带 kind 与比赛关联: %+v", notifications.messages[0])
	}
	if outcome.Description != "赛后队费扣款" {
		t.Fatalf("空描述应使用默认文案: %+v", outcome)
	}
}

func TestSettleIgnoresNotificationFailure(t *testing.T) {
	roster := endedRoster()
	notifications := &fakeNotifications{err: errors.New("boom")}
	service := NewSettlementService(&fakeFundRepository{}, &fakeRosters{roster: roster, found: true},
		fakeAuthorizer{allowed: map[int64]bool{1: true}}, notifications)
	if _, err := service.Settle(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 1},
		SettlementRequest{MatchID: roster.MatchID, Items: map[int64]int64{1: 3000, 2: 2000}}); err != nil {
		t.Fatalf("通知失败不应影响结算: %v", err)
	}
}

func TestGetSummaryPrependsEligibleItemsWhenUnsettled(t *testing.T) {
	roster := endedRoster()
	service := NewSettlementService(&fakeFundRepository{}, &fakeRosters{roster: roster, found: true},
		fakeAuthorizer{allowed: map[int64]bool{1: true}}, &fakeNotifications{})
	summary, err := service.GetSummary(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 1}, roster.MatchID)
	if err != nil {
		t.Fatal(err)
	}
	if len(summary.Items) != 2 || summary.Items[0].AmountCents != 3000 {
		t.Fatalf("未结算时应返回可扣名单并预填人均费: %+v", summary.Items)
	}
}

func TestSettleReturnsNotFoundForMissingMatch(t *testing.T) {
	service := NewSettlementService(&fakeFundRepository{}, &fakeRosters{found: false}, fakeAuthorizer{}, &fakeNotifications{})
	if _, err := service.Settle(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin}, SettlementRequest{MatchID: uuid.New()}); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("不存在的比赛应返回 NotFound，得到 %v", err)
	}
}
