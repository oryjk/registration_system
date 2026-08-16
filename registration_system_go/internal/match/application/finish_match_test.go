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

// fakeTeamAccessByTeam 按 userID 在指定球队集合内放行 manager 校验，用于区分主/客队身份。
type fakeTeamAccessByTeam struct {
	managerTeamIDs map[int64]bool
}

func (f fakeTeamAccessByTeam) EnsureManager(_ context.Context, teamID, _ int64) error {
	if f.managerTeamIDs[teamID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func (f fakeTeamAccessByTeam) EnsureExists(context.Context, int64) error              { return nil }
func (f fakeTeamAccessByTeam) EnsureActive(context.Context, int64) error              { return nil }
func (f fakeTeamAccessByTeam) EnsureActiveMember(context.Context, int64, int64) error { return nil }
func (f fakeTeamAccessByTeam) IsActiveMember(context.Context, int64, int64) (bool, error) {
	return false, nil
}

func TestFinishMatchAllowsAwayManagerForConfirmedOnlineTeamMatch(t *testing.T) {
	match := endedMatch(domain.MatchOngoing)
	match.PublicationMode = domain.OnlineTeam
	awayTeamID := int64(9)
	match.AwayTeamID = &awayTeamID
	repository := &fakeFinishMatchRepository{match: match, found: true}
	// 用户只在客队 9 拥有管理身份。
	useCase := NewFinishMatch(repository, fakeTeamAccessByTeam{managerTeamIDs: map[int64]bool{9: true}}, fixedClock())

	updated, err := useCase.Execute(context.Background(), userActor(77), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded})
	if err != nil {
		t.Fatalf("finish match as away manager: %v", err)
	}
	if updated.Status != domain.MatchEnded || repository.updated.Status != domain.MatchEnded {
		t.Fatalf("expected ended status, got %s / %s", updated.Status, repository.updated.Status)
	}
}

func TestFinishMatchRejectsAwayManagerWhenOpponentNotConfirmed(t *testing.T) {
	match := endedMatch(domain.MatchOngoing)
	match.PublicationMode = domain.OnlineTeam
	match.AwayTeamID = nil
	repository := &fakeFinishMatchRepository{match: match, found: true}
	useCase := NewFinishMatch(repository, fakeTeamAccessByTeam{managerTeamIDs: map[int64]bool{9: true}}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(77), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden before opponent is confirmed, got %v", err)
	}
}

func TestFinishMatchRejectsNonHostManagerForOfflineMatch(t *testing.T) {
	match := endedMatch(domain.MatchOngoing)
	match.PublicationMode = domain.OfflineConfirmed
	opponent := "河西周四 FC"
	match.OpponentName = &opponent
	repository := &fakeFinishMatchRepository{match: match, found: true}
	useCase := NewFinishMatch(repository, fakeTeamAccessByTeam{managerTeamIDs: map[int64]bool{9: true}}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(77), repository.match.ID, FinishMatchCommand{Status: domain.MatchEnded}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for unrelated team manager, got %v", err)
	}
}
