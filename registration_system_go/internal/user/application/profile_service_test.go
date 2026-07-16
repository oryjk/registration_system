package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestProfileServiceUpdatesPlayerForAdmin(t *testing.T) {
	repository := &fakeProfileRepository{user: domain.User{ID: 7, OpenID: "openid-7", Status: domain.StatusActive}, found: true}
	service := NewProfileService(repository)

	updated, err := service.Update(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, 7, " 王小明 ", " 13800138000 ")
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.RealName == nil || *updated.RealName != "王小明" || repository.updated.ID != 7 {
		t.Fatalf("unexpected update: user=%+v persisted=%+v", updated, repository.updated)
	}
}

func TestProfileServiceRejectsUserActorAndMissingPlayer(t *testing.T) {
	service := NewProfileService(&fakeProfileRepository{})
	if _, err := service.Update(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 7}, 7, "王小明", ""); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := service.Update(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, 7, "王小明", ""); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestProfileServiceValidatesProfile(t *testing.T) {
	service := NewProfileService(&fakeProfileRepository{user: domain.User{ID: 7}, found: true})
	if _, err := service.Update(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin}, 7, strings.Repeat("名", 121), ""); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

type fakeProfileRepository struct {
	user    domain.User
	found   bool
	updated domain.User
}

func (f *fakeProfileRepository) FindByOpenID(context.Context, string) (domain.User, bool, error) {
	return domain.User{}, false, nil
}

func (f *fakeProfileRepository) FindByID(context.Context, int64) (domain.User, bool, error) {
	return f.user, f.found, nil
}

func (f *fakeProfileRepository) Create(_ context.Context, user domain.User) (domain.User, error) {
	return user, nil
}

func (f *fakeProfileRepository) UpdateProfile(_ context.Context, user domain.User) (domain.User, error) {
	f.updated = user
	return user, nil
}
