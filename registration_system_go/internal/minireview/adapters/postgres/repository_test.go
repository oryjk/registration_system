package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryAllocatesAndReusesReviewStatus(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)
	now := time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)

	if latest, err := repository.FindLatest(ctx, "registration_system_mini"); err != nil || latest != nil {
		t.Fatalf("expected empty project, got %+v err=%v", latest, err)
	}

	first, err := repository.Create(ctx, domain.NewReviewingStatus("registration_system_mini", version(t, "1.0.39"), now))
	if err != nil {
		t.Fatalf("create first status: %v", err)
	}

	if _, err := repository.Create(ctx, domain.NewReviewingStatus("registration_system_mini", version(t, "1.0.39"), now)); err != ports.ErrVersionConflict {
		t.Fatalf("duplicate create must map to conflict, got %v", err)
	}

	latest, err := repository.FindLatest(ctx, "registration_system_mini")
	if err != nil || latest == nil || latest.Version != "1.0.39" {
		t.Fatalf("unexpected latest: %+v err=%v", latest, err)
	}

	latest.IsReviewing = false
	latest.StatusText = "审核通过"
	updated, err := repository.UpdateStatus(ctx, *latest)
	if err != nil || updated.IsReviewing || first.ID != updated.ID {
		t.Fatalf("unexpected update: %+v err=%v", updated, err)
	}

	found, err := repository.FindByProjectAndVersion(ctx, "registration_system_mini", "1.0.39")
	if err != nil || found == nil || found.StatusText != "审核通过" {
		t.Fatalf("unexpected find by version: %+v err=%v", found, err)
	}

	byID, err := repository.FindByID(ctx, updated.ID)
	if err != nil || byID == nil || byID.Version != "1.0.39" {
		t.Fatalf("unexpected find by id: %+v err=%v", byID, err)
	}
}

func TestRepositoryListFiltersByProjectCode(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)
	now := time.Date(2026, 8, 18, 10, 0, 0, 0, time.UTC)

	for _, item := range []struct{ project, version string }{
		{"registration_system_mini", "1.0.39"},
		{"registration_system_admin_app", "1.0.3"},
	} {
		if _, err := repository.Create(ctx, domain.NewReviewingStatus(item.project, version(t, item.version), now)); err != nil {
			t.Fatalf("create %s %s: %v", item.project, item.version, err)
		}
	}

	items, total, err := repository.List(ctx, ports.StatusFilter{ProjectCode: "registration_system_mini", Limit: 10, Offset: 0})
	if err != nil || total != 1 || len(items) != 1 || items[0].ProjectCode != "registration_system_mini" {
		t.Fatalf("unexpected filtered list: total=%d items=%+v err=%v", total, items, err)
	}

	all, total, err := repository.List(ctx, ports.StatusFilter{Limit: 10, Offset: 0})
	if err != nil || total != 2 || len(all) != 2 {
		t.Fatalf("unexpected unfiltered list: total=%d items=%d err=%v", total, len(all), err)
	}
}

func version(t *testing.T, raw string) domain.Version {
	t.Helper()
	parsed, err := domain.ParseVersion(raw)
	if err != nil {
		t.Fatalf("parse %s: %v", raw, err)
	}
	return parsed
}
