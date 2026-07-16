package postgres

import (
	"context"
	"testing"

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
