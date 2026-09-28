package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestRepositoryCreatesAndFindsUserByOpenID(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)

	created, err := repository.Create(context.Background(), domain.User{OpenID: "openid-1", Status: domain.StatusActive})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	found, ok, err := repository.FindByOpenID(context.Background(), "openid-1")
	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	if !ok || found.ID != created.ID || found.Status != domain.StatusActive {
		t.Fatalf("unexpected found user: %+v, ok=%v", found, ok)
	}
}

func TestRepositoryTouchLastActiveThrottlesWrites(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()
	created, err := repository.Create(ctx, domain.User{OpenID: "active-openid", Status: domain.StatusActive})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}

	first := time.Now().UTC().Add(-31 * time.Minute).Truncate(time.Microsecond)
	if err := repository.TouchLastActive(ctx, created.ID, first, first.Add(-30*time.Minute)); err != nil {
		t.Fatalf("first touch: %v", err)
	}
	second := first.Add(5 * time.Minute)
	if err := repository.TouchLastActive(ctx, created.ID, second, second.Add(-30*time.Minute)); err != nil {
		t.Fatalf("throttled touch: %v", err)
	}
	found, ok, err := repository.FindByID(ctx, created.ID)
	if err != nil || !ok || found.LastActiveAt == nil || !found.LastActiveAt.Equal(first) {
		t.Fatalf("throttled touch changed timestamp: user=%+v ok=%t err=%v", found, ok, err)
	}

	third := first.Add(31 * time.Minute)
	if err := repository.TouchLastActive(ctx, created.ID, third, third.Add(-30*time.Minute)); err != nil {
		t.Fatalf("expired throttle touch: %v", err)
	}
	found, ok, err = repository.FindByID(ctx, created.ID)
	if err != nil || !ok || found.LastActiveAt == nil || !found.LastActiveAt.Equal(third) {
		t.Fatalf("expired throttle was not refreshed: user=%+v ok=%t err=%v", found, ok, err)
	}
}

func TestRepositoryUpdatesUserProfile(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()
	created, err := repository.Create(ctx, domain.User{OpenID: "profile-openid", Status: domain.StatusActive})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	realName, phoneNumber := "王小明", "13800138000"
	created.RealName = &realName
	created.PhoneNumber = &phoneNumber

	updated, err := repository.UpdateProfile(ctx, created)
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.RealName == nil || *updated.RealName != realName || updated.PhoneNumber == nil || *updated.PhoneNumber != phoneNumber {
		t.Fatalf("unexpected updated profile: %+v", updated)
	}
	found, ok, err := repository.FindByID(ctx, created.ID)
	if err != nil || !ok || found.RealName == nil || *found.RealName != realName {
		t.Fatalf("find updated user: user=%+v ok=%t err=%v", found, ok, err)
	}
}
