package application

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeMatchAdminAccess struct {
	checkedUserID int64
	err           error
}

func (f *fakeMatchAdminAccess) EnsureMatchAdmin(_ context.Context, userID int64) error {
	f.checkedUserID = userID
	return f.err
}

func TestAdminRecordScoreUpdatesOngoingMatch(t *testing.T) {
	id := uuid.New()
	repository := &fakeAdminMatchRepository{match: domain.Match{ID: id, Status: domain.MatchOngoing}, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	match, err := service.RecordScore(context.Background(), adminActor(3), id, 3, 1)
	if err != nil {
		t.Fatalf("record score: %v", err)
	}
	if match.HostScore == nil || *match.HostScore != 3 || match.AwayScore == nil || *match.AwayScore != 1 {
		t.Fatalf("unexpected score: %+v", match)
	}
	if repository.updatedScore.HostScore == nil || *repository.updatedScore.HostScore != 3 {
		t.Fatalf("repository must persist the score: %+v", repository.updatedScore)
	}
}

func TestAdminRecordScoreRejectsUser(t *testing.T) {
	service := NewAdminMatchService(&fakeAdminMatchRepository{found: true}, fixedClock(), &fakeAdminAccess{})
	if _, err := service.RecordScore(context.Background(), userActor(2), uuid.New(), 1, 0); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestAdminRecordScoreRejectsRegisteringMatch(t *testing.T) {
	repository := &fakeAdminMatchRepository{match: domain.Match{Status: domain.MatchRegistering}, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	if _, err := service.RecordScore(context.Background(), adminActor(3), uuid.New(), 1, 0); err == nil {
		t.Fatal("报名期录入比分应被拒绝")
	}
	if repository.updatedScore.HostScore != nil {
		t.Fatalf("被拒绝时不应落库: %+v", repository.updatedScore)
	}
}

func TestRecordMatchScoreByMatchAdmin(t *testing.T) {
	id := uuid.New()
	repository := &fakeAdminMatchRepository{match: domain.Match{ID: id, Status: domain.MatchEnded}, found: true}
	access := &fakeMatchAdminAccess{}
	useCase := NewRecordMatchScore(repository, access, fixedClock())

	match, err := useCase.Execute(context.Background(), userActor(9), id, RecordMatchScoreCommand{HostScore: 0, AwayScore: 2})
	if err != nil {
		t.Fatalf("record score: %v", err)
	}
	if access.checkedUserID != 9 {
		t.Fatalf("必须校验比赛管理员身份，checked=%d", access.checkedUserID)
	}
	if match.HostScore == nil || *match.HostScore != 0 || match.AwayScore == nil || *match.AwayScore != 2 {
		t.Fatalf("unexpected score: %+v", match)
	}
}

func TestRecordMatchScoreRejectsNonMatchAdmin(t *testing.T) {
	useCase := NewRecordMatchScore(&fakeAdminMatchRepository{found: true}, &fakeMatchAdminAccess{err: sharederror.ErrForbidden}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(9), uuid.New(), RecordMatchScoreCommand{HostScore: 1, AwayScore: 1}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestRecordMatchScoreRejectsAdminActorAndMissingMatch(t *testing.T) {
	useCase := NewRecordMatchScore(&fakeAdminMatchRepository{found: true}, &fakeMatchAdminAccess{}, fixedClock())
	if _, err := useCase.Execute(context.Background(), adminActor(3), uuid.New(), RecordMatchScoreCommand{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("admin actor must be rejected, got %v", err)
	}

	missing := NewRecordMatchScore(&fakeAdminMatchRepository{found: false}, &fakeMatchAdminAccess{}, fixedClock())
	if _, err := missing.Execute(context.Background(), userActor(9), uuid.New(), RecordMatchScoreCommand{}); !errors.Is(err, sharederror.New(sharederror.KindNotFound, "")) {
		t.Fatalf("missing match must be not found, got %v", err)
	}
}
