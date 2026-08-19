package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func fixedClock() ports.Clock {
	return fixedTime{time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)}
}

type fixedTime struct{ now time.Time }

func (f fixedTime) Now() time.Time { return f.now }

func newService(repository *fakeRepository) *Service {
	return NewService(repository, repository, repository, fixedClock(), nil)
}

func newServiceWithControl(repository *fakeRepository, allowedUserIDs ...int64) *Service {
	allowed := make(map[int64]struct{}, len(allowedUserIDs))
	for _, id := range allowedUserIDs {
		allowed[id] = struct{}{}
	}
	return NewService(repository, repository, repository, fixedClock(), allowed)
}

func TestAllocateIncrementsApprovedLatest(t *testing.T) {
	repository := &fakeRepository{latest: reviewing("1.34.23", false)}
	service := newService(repository)

	status, err := service.Allocate(context.Background(), AllocateCommand{
		ProjectCode: "registration_system_mini", CurrentVersion: "1.34.23",
	})
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if status.Version != "1.34.24" || !status.IsReviewing {
		t.Fatalf("expected new reviewing 1.34.24, got %+v", status)
	}
	if repository.created == nil || repository.created.Version != "1.34.24" {
		t.Fatalf("expected 1.34.24 persisted, got %+v", repository.created)
	}
}

func TestAllocateReusesReviewingLatestWithoutWrite(t *testing.T) {
	repository := &fakeRepository{latest: reviewing("1.34.24", true)}
	service := newService(repository)

	status, err := service.Allocate(context.Background(), AllocateCommand{
		ProjectCode: "registration_system_mini", CurrentVersion: "1.34.23",
	})
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if status.Version != "1.34.24" || repository.created != nil || repository.updated != nil {
		t.Fatalf("expected read-only reuse, got %+v created=%v updated=%v", status, repository.created, repository.updated)
	}
}

func TestAllocateSeedsFromManifestWhenHistoryEmpty(t *testing.T) {
	service := newService(&fakeRepository{})

	status, err := service.Allocate(context.Background(), AllocateCommand{
		ProjectCode: "registration_system_mini", CurrentVersion: "1.0.38",
	})
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if status.Version != "1.0.39" || !status.IsReviewing {
		t.Fatalf("expected seeded 1.0.39 reviewing, got %+v", status)
	}
}

func TestAllocateExplicitVersionReopensApprovedRecord(t *testing.T) {
	repository := &fakeRepository{byVersion: map[string]*domain.MiniReviewStatus{
		"1.0.38": reviewing("1.0.38", false),
	}}
	service := newService(repository)

	status, err := service.Allocate(context.Background(), AllocateCommand{
		ProjectCode: "registration_system_mini", ExplicitVersion: "1.0.38",
	})
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if !status.IsReviewing || status.Version != "1.0.38" {
		t.Fatalf("expected 1.0.38 reopened for review, got %+v", status)
	}
	if repository.created != nil {
		t.Fatalf("explicit existing version must not create a record: %+v", repository.created)
	}
}

func TestAllocateConflictFallsBackToRacingRecord(t *testing.T) {
	raced := reviewing("1.0.39", true)
	repository := &fakeRepository{createErr: ports.ErrVersionConflict, byVersion: map[string]*domain.MiniReviewStatus{"1.0.39": raced}}
	service := newService(repository)

	status, err := service.Allocate(context.Background(), AllocateCommand{
		ProjectCode: "registration_system_mini", CurrentVersion: "1.0.38",
	})
	if err != nil {
		t.Fatalf("allocate: %v", err)
	}
	if status.Version != "1.0.39" || !status.IsReviewing {
		t.Fatalf("expected to fall back to racing 1.0.39, got %+v", status)
	}
}

func TestGetReviewStatusDefaultsUnknownVersionToNotReviewing(t *testing.T) {
	service := newService(&fakeRepository{})

	status, err := service.GetReviewStatus(context.Background(), "registration_system_mini", "1.0.38")
	if err != nil {
		t.Fatalf("get review status: %v", err)
	}
	if status.IsReviewing {
		t.Fatalf("unregistered version must not be reviewing: %+v", status)
	}

	if _, err := service.GetReviewStatus(context.Background(), "registration_system_mini", "1.0"); err == nil {
		t.Fatal("malformed version must be rejected")
	}
}

func TestSetStatusRequiresAdminAndPersists(t *testing.T) {
	repository := &fakeRepository{byID: map[int64]*domain.MiniReviewStatus{7: reviewing("1.0.39", true)}}
	service := newService(repository)

	if _, err := service.SetStatus(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser}, SetStatusCommand{ID: 7}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	updated, err := service.SetStatus(context.Background(), adminActor(), SetStatusCommand{ID: 7, IsReviewing: false, StatusText: "审核通过"})
	if err != nil {
		t.Fatalf("set status: %v", err)
	}
	if updated.IsReviewing || updated.StatusText != "审核通过" || repository.updated.Version != "1.0.39" {
		t.Fatalf("unexpected update: %+v persisted=%+v", updated, repository.updated)
	}
}

func TestListRejectsUser(t *testing.T) {
	service := newService(&fakeRepository{})
	if _, err := service.List(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser}, StatusListQuery{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestSetStatusByProjectVersionRejectsUserOutsideAllowlist(t *testing.T) {
	repository := &fakeRepository{byVersion: map[string]*domain.MiniReviewStatus{"1.0.43": reviewing("1.0.43", true)}}
	service := newServiceWithControl(repository, 4)
	command := SetByProjectVersionCommand{ProjectCode: "registration_system_mini", Version: "1.0.43", IsReviewing: false}

	if _, err := service.SetStatusByProjectVersion(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 5}, command); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for non-allowlisted user, got %v", err)
	}
	if _, err := service.SetStatusByProjectVersion(context.Background(), adminActor(), command); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for admin actor, got %v", err)
	}
	if repository.updated != nil {
		t.Fatalf("rejected call must not persist: %+v", repository.updated)
	}
}

func TestSetStatusByProjectVersionDisabledWithoutAllowlist(t *testing.T) {
	repository := &fakeRepository{byVersion: map[string]*domain.MiniReviewStatus{"1.0.43": reviewing("1.0.43", true)}}
	service := newService(repository)

	if _, err := service.SetStatusByProjectVersion(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 4}, SetByProjectVersionCommand{ProjectCode: "registration_system_mini", Version: "1.0.43", IsReviewing: false}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden when allowlist unconfigured, got %v", err)
	}
}

func TestSetStatusByProjectVersionTogglesRegisteredVersion(t *testing.T) {
	repository := &fakeRepository{byVersion: map[string]*domain.MiniReviewStatus{"1.0.43": reviewing("1.0.43", true)}}
	service := newServiceWithControl(repository, 4)

	updated, err := service.SetStatusByProjectVersion(
		context.Background(),
		sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 4},
		SetByProjectVersionCommand{ProjectCode: "registration_system_mini", Version: "1.0.43", IsReviewing: false},
	)
	if err != nil {
		t.Fatalf("set by project version: %v", err)
	}
	if updated.IsReviewing || updated.Version != "1.0.43" || repository.updated == nil || repository.updated.IsReviewing {
		t.Fatalf("unexpected update: %+v persisted=%+v", updated, repository.updated)
	}
	if updated.StatusText != "已过审（小程序端切换）" {
		t.Fatalf("expected generated status text, got %q", updated.StatusText)
	}

	reopened, err := service.SetStatusByProjectVersion(
		context.Background(),
		sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 4},
		SetByProjectVersionCommand{ProjectCode: "registration_system_mini", Version: "1.0.43", IsReviewing: true},
	)
	if err != nil {
		t.Fatalf("reopen by project version: %v", err)
	}
	if !reopened.IsReviewing || reopened.StatusText != "审核中（小程序端切换）" {
		t.Fatalf("unexpected reopen: %+v", reopened)
	}
}

func TestSetStatusByProjectVersionRejectsUnregisteredVersion(t *testing.T) {
	service := newServiceWithControl(&fakeRepository{}, 4)

	_, err := service.SetStatusByProjectVersion(
		context.Background(),
		sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 4},
		SetByProjectVersionCommand{ProjectCode: "registration_system_mini", Version: "9.9.9", IsReviewing: false},
	)
	if !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected not found for unregistered version, got %v", err)
	}
}

func adminActor() sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 3, IsSuperAdmin: true}
}

func reviewing(version string, isReviewing bool) *domain.MiniReviewStatus {
	parsed, _ := domain.ParseVersion(version)
	return &domain.MiniReviewStatus{
		ID: 7, ProjectCode: "registration_system_mini",
		Version: version, VersionCode: parsed.Code(),
		IsReviewing: isReviewing, StatusText: "正在审核",
	}
}

type fakeRepository struct {
	latest    *domain.MiniReviewStatus
	created   *domain.MiniReviewStatus
	updated   *domain.MiniReviewStatus
	createErr error
	byVersion map[string]*domain.MiniReviewStatus
	byID      map[int64]*domain.MiniReviewStatus
}

func (f *fakeRepository) FindLatest(_ context.Context, _ string) (*domain.MiniReviewStatus, error) {
	return f.latest, nil
}

func (f *fakeRepository) FindByProjectAndVersion(_ context.Context, _, version string) (*domain.MiniReviewStatus, error) {
	return f.byVersion[version], nil
}

func (f *fakeRepository) Create(_ context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error) {
	if f.createErr != nil {
		return domain.MiniReviewStatus{}, f.createErr
	}
	status.ID = 8
	f.created = &status
	return status, nil
}

func (f *fakeRepository) UpdateStatus(_ context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error) {
	f.updated = &status
	return status, nil
}

func (f *fakeRepository) List(_ context.Context, _ ports.StatusFilter) ([]domain.MiniReviewStatus, int64, error) {
	return nil, 0, nil
}

func (f *fakeRepository) FindByID(_ context.Context, id int64) (*domain.MiniReviewStatus, error) {
	return f.byID[id], nil
}
