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
