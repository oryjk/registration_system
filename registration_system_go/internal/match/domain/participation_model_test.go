package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestIndividualOpponentStateFollowsMinimumPlayers(t *testing.T) {
	match := Match{PublicationMode: OnlineIndividual, OpponentState: OpponentRecruiting}

	if err := match.RecalculateIndividualOpponent(7, 8, time.Now()); err != nil {
		t.Fatalf("recalculate below minimum: %v", err)
	}
	if match.OpponentState != OpponentRecruiting {
		t.Fatalf("below minimum should recruit, got %s", match.OpponentState)
	}

	if err := match.RecalculateIndividualOpponent(8, 8, time.Now()); err != nil {
		t.Fatalf("recalculate at minimum: %v", err)
	}
	if match.OpponentState != OpponentConfirmed {
		t.Fatalf("minimum reached should confirm, got %s", match.OpponentState)
	}

	if err := match.RecalculateIndividualOpponent(6, 8, time.Now()); err != nil {
		t.Fatalf("recalculate after cancellation: %v", err)
	}
	if match.OpponentState != OpponentRecruiting {
		t.Fatalf("dropping below minimum should reopen recruitment, got %s", match.OpponentState)
	}
}

func TestIndividualGroupClosesAtMaximumAndReopensBelowIt(t *testing.T) {
	group := NewIndividualGroup(uuid.New(), IndividualLimits{MinPlayers: 8, MaxPlayers: 10}, time.Now())

	if err := group.RecalculateIndividualStatus(10, time.Now()); err != nil {
		t.Fatalf("close full group: %v", err)
	}
	if group.Status != GroupClosed {
		t.Fatalf("full group should close, got %s", group.Status)
	}

	if err := group.RecalculateIndividualStatus(9, time.Now()); err != nil {
		t.Fatalf("reopen group: %v", err)
	}
	if group.Status != GroupOpen {
		t.Fatalf("group below maximum should reopen, got %s", group.Status)
	}
}

func TestTeamApplicationStateTransitions(t *testing.T) {
	now := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)
	application, err := NewTeamApplication(uuid.New(), 7, 42, "周末可以参赛", now)
	if err != nil {
		t.Fatalf("new application: %v", err)
	}

	selectedAt := now.Add(time.Hour)
	if err := application.Select(selectedAt); err != nil {
		t.Fatalf("select application: %v", err)
	}
	if application.Status != ApplicationSelected || application.SelectedAt == nil || !application.SelectedAt.Equal(selectedAt) {
		t.Fatalf("unexpected selected application: %+v", application)
	}
	if err := application.Reject(selectedAt); err == nil {
		t.Fatal("selected application must not become rejected")
	}

	withdrawnAt := selectedAt.Add(time.Hour)
	if err := application.Withdraw(withdrawnAt); err != nil {
		t.Fatalf("withdraw selected application: %v", err)
	}
	if application.Status != ApplicationWithdrawn || application.WithdrawnAt == nil || !application.WithdrawnAt.Equal(withdrawnAt) {
		t.Fatalf("unexpected withdrawn application: %+v", application)
	}
	if err := application.Select(withdrawnAt); err == nil {
		t.Fatal("withdrawn application must not be selected again")
	}
}

func TestPendingTeamApplicationCanBeRejectedOrWithdrawn(t *testing.T) {
	now := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)

	rejected, _ := NewTeamApplication(uuid.New(), 7, 42, "申请一", now)
	if err := rejected.Reject(now.Add(time.Minute)); err != nil {
		t.Fatalf("reject pending application: %v", err)
	}
	if rejected.Status != ApplicationRejected || rejected.SelectedAt != nil || rejected.WithdrawnAt != nil {
		t.Fatalf("unexpected rejected application: %+v", rejected)
	}

	withdrawn, _ := NewTeamApplication(uuid.New(), 8, 43, "申请二", now)
	if err := withdrawn.Withdraw(now.Add(time.Minute)); err != nil {
		t.Fatalf("withdraw pending application: %v", err)
	}
	if withdrawn.Status != ApplicationWithdrawn || withdrawn.WithdrawnAt == nil {
		t.Fatalf("unexpected withdrawn application: %+v", withdrawn)
	}
}
