package domain

import (
	"testing"
	"time"
)

func TestMatchStatusTransitions(t *testing.T) {
	match := Match{Status: MatchRegistering}
	if err := match.ChangeStatus(MatchOngoing, time.Now()); err != nil {
		t.Fatalf("start match: %v", err)
	}
	if err := match.ChangeStatus(MatchEnded, time.Now()); err != nil {
		t.Fatalf("end match: %v", err)
	}
	if err := match.ChangeStatus(MatchRegistering, time.Now()); err == nil {
		t.Fatal("expected ended match to reject reopening")
	}
}

func TestMatchCanBeCancelledWhileActive(t *testing.T) {
	for _, status := range []MatchStatus{MatchRegistering, MatchOngoing} {
		match := Match{Status: status}
		if err := match.ChangeStatus(MatchCancelled, time.Now()); err != nil {
			t.Fatalf("cancel %s match: %v", status, err)
		}
	}
}

func TestMatchUpdatesEditableDetails(t *testing.T) {
	start := time.Date(2026, 7, 22, 19, 0, 0, 0, time.UTC)
	match, _, err := NewMatch(validInput(OnlineTeam), IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	err = match.UpdateDetails(UpdateMatchDetails{
		Name:      "周三训练赛",
		StartTime: start,
		EndTime:   start.Add(2 * time.Hour),
		Location:  "滨江球场",
	}, start.Add(-time.Hour))
	if err != nil {
		t.Fatalf("update details: %v", err)
	}
	if match.Name != "周三训练赛" || match.Location != "滨江球场" {
		t.Fatalf("unexpected updated match: %+v", match)
	}
}

func TestNewMatchAcceptsAdminCreator(t *testing.T) {
	input := validInput(OnlineTeam)
	input.CreatedByUserID = nil
	input.CreatedByAdminID = int64Pointer(9)

	match, _, err := NewMatch(input, IndividualLimits{})
	if err != nil {
		t.Fatalf("new admin match: %v", err)
	}
	if match.CreatedByAdminID == nil || *match.CreatedByAdminID != 9 || match.CreatedByUserID != nil {
		t.Fatalf("unexpected creator: %+v", match)
	}
}

func int64Pointer(value int64) *int64 { return &value }
