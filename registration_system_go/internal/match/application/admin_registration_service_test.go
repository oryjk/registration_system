package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func adminRegistrationFixture(now time.Time) *fakeUserRegistrationRepository {
	repository := newFakeUserRegistrationRepository(teamRegistrationFixture(now, domain.GroupHostTeam, 7))
	repository.members = map[int64]map[int64]bool{7: {42: true, 43: true}}
	return repository
}

func TestAdminRegistrationCreatesTeamMemberRecordAfterDeadline(t *testing.T) {
	now := time.Date(2026, 10, 6, 8, 0, 0, 0, time.UTC)
	for _, matchStatus := range []domain.MatchStatus{domain.MatchRegistering, domain.MatchOngoing, domain.MatchEnded} {
		for _, status := range []domain.RegistrationStatus{domain.RegistrationUnknown, domain.RegistrationAttending, domain.RegistrationLeave, domain.RegistrationAbsent} {
			t.Run(string(matchStatus)+"/"+string(status), func(t *testing.T) {
				repository := adminRegistrationFixture(now)
				repository.match.Status = matchStatus
				deadline := now.Add(-time.Hour)
				repository.match.RegistrationEndAt = &deadline
				service := NewAdminRegistrationService(repository, fakeClock{now: now})
				result, err := service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, status)
				if err != nil {
					t.Fatal(err)
				}
				stored := repository.registrations[repository.group.ID]
				if len(stored) != 1 || stored[0].UserID != 42 || stored[0].Status != status || result.ID == uuid.Nil || stored[0].RegistrationCount != 1 {
					t.Fatalf("incorrect persisted registration: %+v", stored)
				}
				if repository.transactions != 1 || repository.outsideTransactionWrite {
					t.Fatal("registration must be written atomically")
				}
			})
		}
	}
}

func TestAdminRegistrationGuestTeamAndExistingRecord(t *testing.T) {
	now := time.Now().UTC()
	repository := newFakeUserRegistrationRepository(teamRegistrationFixture(now, domain.GroupGuestTeam, 8))
	repository.match.AwayTeamID = int64Pointer(8)
	repository.match.OpponentState = domain.OpponentConfirmed
	repository.members = map[int64]map[int64]bool{8: {42: true}}
	old, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 2, now.Add(-time.Hour))
	old.Paid = true
	repository.registrations[repository.group.ID] = []domain.Registration{old}
	service := NewAdminRegistrationService(repository, fakeClock{now: now})
	result, err := service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, domain.RegistrationUnknown)
	if err != nil {
		t.Fatal(err)
	}
	if result.ID != old.ID || result.RegistrationCount != 2 || !result.Paid || result.Status != domain.RegistrationUnknown || result.CreatedAt != old.CreatedAt {
		t.Fatalf("existing record metadata changed: %+v", result)
	}
	_, err = service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, domain.RegistrationUnknown)
	if err != nil || len(repository.registrations[repository.group.ID]) != 1 {
		t.Fatalf("repeated update created duplicate: %v", err)
	}
}

func TestAdminRegistrationRejectsInvalidActorGroupAndStatus(t *testing.T) {
	for _, name := range []string{"user actor", "invalid user", "invalid status", "cancelled match", "cancelled group", "individual group", "not member", "wrong team", "missing match", "wrong group"} {
		t.Run(name, func(t *testing.T) {
			now := time.Now().UTC()
			repository := adminRegistrationFixture(now)
			actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
			userID := int64(42)
			status := domain.RegistrationAttending
			groupID := repository.group.ID
			matchID := repository.match.ID
			switch name {
			case "user actor":
				actor = userActor(42)
			case "invalid user":
				userID = 0
			case "invalid status":
				status = domain.RegistrationCancelled
			case "cancelled match":
				repository.match.Status = domain.MatchCancelled
			case "cancelled group":
				repository.group.Status = domain.GroupCancelled
			case "individual group":
				repository.group.Kind = domain.GroupIndividualOpponent
			case "not member":
				userID = 99
			case "wrong team":
				repository.group.TeamID = int64Pointer(99)
			case "missing match":
				repository.match.ID = uuid.Nil
			case "wrong group":
				groupID = uuid.New()
			}
			_, err := NewAdminRegistrationService(repository, fakeClock{now: now}).Put(context.Background(), actor, matchID, groupID, userID, status)
			if err == nil {
				t.Fatal("invalid update accepted")
			}
			if len(repository.registrations[repository.group.ID]) != 0 {
				t.Fatal("invalid request wrote a registration")
			}
		})
	}
}

func TestAdminRegistrationCapacityAndCrossGroupConflict(t *testing.T) {
	now := time.Now().UTC()
	repository := adminRegistrationFixture(now)
	repository.group.MaxPlayers = intPointer(1)
	other, _ := domain.NewRegistration(repository.group.ID, 43, domain.RegistrationAttending, 1, now)
	repository.registrations[repository.group.ID] = []domain.Registration{other}
	service := NewAdminRegistrationService(repository, fakeClock{now: now})
	_, err := service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, domain.RegistrationAttending)
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("full group should reject attending: %v", err)
	}
	_, err = service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, domain.RegistrationLeave)
	if err != nil {
		t.Fatalf("non-attending must not occupy capacity: %v", err)
	}
	otherGroup := uuid.New()
	conflict, _ := domain.NewRegistration(otherGroup, 42, domain.RegistrationAttending, 1, now)
	repository.registrations[otherGroup] = []domain.Registration{conflict}
	_, err = service.Put(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, repository.match.ID, repository.group.ID, 42, domain.RegistrationAttending)
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("cross-group registration should fail: %v", err)
	}
}
