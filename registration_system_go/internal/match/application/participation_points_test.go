package application

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

func TestUserParticipationConfirmationAndAdminCorrection(t *testing.T) {
	now := time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC)
	repo := adminRegistrationFixture(now)
	repo.match.CreatedAt = now.Add(-30 * time.Minute)
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	user := NewUserRegistrationService(repo, fakeClock{now: now})
	put := func(s UserRegistrationService, status domain.RegistrationStatus) domain.Registration {
		t.Helper()
		r, err := s.Put(context.Background(), actor, repo.match.ID, repo.group.ID, PutMyRegistrationCommand{Status: status, RegistrationCount: 1})
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	first := put(user, domain.RegistrationAttending)
	if first.ParticipationConfirmedAt == nil || first.EarlyRegistrationBonus != 30 {
		t.Fatalf("missing self confirmation: %+v", first)
	}
	repeated := put(NewUserRegistrationService(repo, fakeClock{now: now.Add(time.Hour)}), domain.RegistrationAttending)
	if !repeated.ParticipationConfirmedAt.Equal(*first.ParticipationConfirmedAt) {
		t.Fatal("repeat refreshed time")
	}
	admin := NewAdminRegistrationService(repo, fakeClock{now: now.Add(2 * time.Hour)})
	for _, status := range []domain.RegistrationStatus{domain.RegistrationAbsent, domain.RegistrationAttending} {
		r, err := admin.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repo.match.ID, repo.group.ID, 42, status)
		if err != nil || r.EarlyRegistrationBonus != 30 || r.ParticipationConfirmedAt == nil {
			t.Fatalf("admin changed reward %+v err=%v", r, err)
		}
	}
	put(user, domain.RegistrationLeave)
	later := put(NewUserRegistrationService(repo, fakeClock{now: now.Add(7 * time.Hour)}), domain.RegistrationAttending)
	if later.EarlyRegistrationBonus != 15 || !later.ParticipationConfirmedAt.Equal(now.Add(7*time.Hour)) {
		t.Fatalf("bad re-entry %+v", later)
	}
}

func TestRepeatedHistoricalAttendingDoesNotInventBonus(t *testing.T) {
	now := time.Now().UTC()
	repo := adminRegistrationFixture(now)
	old, _ := domain.NewRegistration(repo.group.ID, 42, domain.RegistrationAttending, 1, now.Add(-time.Hour))
	repo.registrations[repo.group.ID] = []domain.Registration{old}
	r, err := NewUserRegistrationService(repo, fakeClock{now: now}).Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, repo.match.ID, repo.group.ID, PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1})
	if err != nil || r.ParticipationConfirmedAt != nil || r.EarlyRegistrationBonus != 0 {
		t.Fatalf("invented reward %+v err=%v", r, err)
	}
}

func TestUserAcknowledgesAdminAbsentClearsOldReward(t *testing.T) {
	now := time.Now().UTC()
	repo := adminRegistrationFixture(now)
	old, _ := domain.NewRegistration(repo.group.ID, 42, domain.RegistrationAttending, 1, now)
	old.ConfirmParticipation(now, now)
	if err := old.ApplyAdminStatus(domain.RegistrationAbsent, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	old.Paid = true // An identical paid request must retain the existing success contract.
	repo.registrations[repo.group.ID] = []domain.Registration{old}
	r, err := NewUserRegistrationService(repo, fakeClock{now: now.Add(2 * time.Minute)}).Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, repo.match.ID, repo.group.ID, PutMyRegistrationCommand{Status: domain.RegistrationAbsent, RegistrationCount: 1})
	if err != nil || r.ParticipationConfirmedAt != nil || r.EarlyRegistrationBonus != 0 || !r.Paid {
		t.Fatalf("user non-attending confirmation kept reward %+v err=%v", r, err)
	}
}
