package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestUserRegistrationTransitionsAndCancellation(t *testing.T) {
	createdAt := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	registration, err := NewRegistration(uuid.New(), 42, RegistrationAttending, 1, createdAt)
	if err != nil {
		t.Fatal(err)
	}
	if !registration.OccupiesCapacity() {
		t.Fatal("attending registration must occupy capacity")
	}
	if err := registration.ApplyUserStatus(RegistrationAttending, createdAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if !registration.UpdatedAt.Equal(createdAt) {
		t.Fatal("idempotent status must not change updated_at")
	}
	if err := registration.ApplyUserStatus(RegistrationLeave, createdAt.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if registration.Status != RegistrationLeave || registration.OccupiesCapacity() {
		t.Fatalf("leave transition failed: %+v", registration)
	}
	registration.Cancel(createdAt.Add(3 * time.Minute))
	if registration.Status != RegistrationCancelled || registration.CancelledAt == nil {
		t.Fatalf("cancel failed: %+v", registration)
	}
	if err := registration.ApplyUserStatus(RegistrationAbsent, createdAt.Add(4*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if registration.Status != RegistrationAbsent || registration.CancelledAt != nil {
		t.Fatalf("reactivation failed: %+v", registration)
	}
}

func TestUserRegistrationRejectsServerOnlyStatuses(t *testing.T) {
	registration, _ := NewRegistration(uuid.New(), 42, RegistrationAttending, 1, time.Now())
	for _, status := range []RegistrationStatus{RegistrationUnknown, RegistrationCancelled, "other"} {
		if err := registration.ApplyUserStatus(status, time.Now()); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("status %q: expected validation, got %v", status, err)
		}
	}
}

func TestIndividualCapacityAndOpponentRecalculate(t *testing.T) {
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	matchID := uuid.New()
	group := NewIndividualGroup(matchID, IndividualLimits{MinPlayers: 8, MaxPlayers: 10}, now)
	if err := group.RecalculateIndividualStatus(10, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if group.Status != GroupClosed || !group.UpdatedAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("group did not close: %+v", group)
	}
	if err := group.RecalculateIndividualStatus(9, now.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if group.Status != GroupOpen {
		t.Fatalf("group did not reopen: %+v", group)
	}

	match := Match{ID: matchID, PublicationMode: OnlineIndividual, OpponentState: OpponentRecruiting, UpdatedAt: now}
	if err := match.RecalculateIndividualOpponent(8, 8, now.Add(3*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if match.OpponentState != OpponentConfirmed || !match.UpdatedAt.Equal(now.Add(3*time.Minute)) {
		t.Fatalf("opponent did not confirm: %+v", match)
	}
	if err := match.RecalculateIndividualOpponent(7, 8, now.Add(4*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if match.OpponentState != OpponentRecruiting {
		t.Fatalf("opponent did not return to recruiting: %+v", match)
	}
}
