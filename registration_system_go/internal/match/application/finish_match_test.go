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

type fakeFinishMatchRepository struct {
	fakeMatchRepository
	match   domain.Match
	found   bool
	updated domain.Match
}

func (f *fakeFinishMatchRepository) FindByID(_ context.Context, _ uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error) {
	return f.match, nil, f.found, nil
}

func (f *fakeFinishMatchRepository) UpdateStatus(_ context.Context, match domain.Match) error {
	f.updated = match
	return nil
}

func endedMatch(status domain.MatchStatus) domain.Match {
	now := fixedClock().now // 2026-07-14 12:00 UTC
	return domain.Match{
		ID:         uuid.New(),
		Status:     status,
		HostTeamID: 7,
		StartTime:  now.Add(-3 * time.Hour),
		EndTime:    now.Add(-time.Hour),
	}
}

func TestFinishMatchEndsOngoingMatchForHostManager(t *testing.T) {
	repository := &fakeFinishMatchRepository{match: endedMatch(domain.MatchOngoing), found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())

	match, err := useCase.Execute(context.Background(), userActor(42), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded})
	if err != nil {
		t.Fatalf("finish match: %v", err)
	}
	if match.Status != domain.MatchEnded {
		t.Fatalf("status = %s, want ended", match.Status)
	}
	if repository.updated.Status != domain.MatchEnded {
		t.Fatalf("repository update status = %s, want ended", repository.updated.Status)
	}
}

func TestFinishMatchEndsRegisteringMatchAfterEndTime(t *testing.T) {
	repository := &fakeFinishMatchRepository{match: endedMatch(domain.MatchRegistering), found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(42), repository.match.ID, FinishMatchCommand{Status: domain.MatchCancelled}); err != nil {
		t.Fatalf("finish registering match: %v", err)
	}
	if repository.updated.Status != domain.MatchCancelled {
		t.Fatalf("repository update status = %s, want cancelled", repository.updated.Status)
	}
}

func TestFinishMatchRejectsNonHostMember(t *testing.T) {
	repository := &fakeFinishMatchRepository{match: endedMatch(domain.MatchOngoing), found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{err: sharederror.ErrForbidden}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(103), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if repository.updated.Status == domain.MatchEnded {
		t.Fatal("expected no repository write for rejected actor")
	}
}

func TestFinishMatchRejectsMatchNotYetEnded(t *testing.T) {
	match := endedMatch(domain.MatchOngoing)
	match.EndTime = fixedClock().now.Add(time.Hour)
	repository := &fakeFinishMatchRepository{match: match, found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(42), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded}); err == nil {
		t.Fatal("expected conflict when match has not reached end time")
	}
}

func TestFinishMatchRejectsInvalidStatus(t *testing.T) {
	repository := &fakeFinishMatchRepository{match: endedMatch(domain.MatchOngoing), found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(42), repository.match.ID, FinishMatchCommand{Status: domain.MatchRegistering}); err == nil {
		t.Fatal("expected validation error for invalid status")
	}
}

func TestFinishMatchRejectsMissingMatch(t *testing.T) {
	repository := &fakeFinishMatchRepository{found: false}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(42), uuid.New(), FinishMatchCommand{Status: domain.MatchEnded}); err == nil {
		t.Fatal("expected not found error")
	}
}

func TestFinishMatchRejectsAdminActor(t *testing.T) {
	repository := &fakeFinishMatchRepository{match: endedMatch(domain.MatchOngoing), found: true}
	useCase := NewFinishMatch(repository, &fakeTeamAccess{}, fixedClock())
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	if _, err := useCase.Execute(context.Background(), actor, repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}
