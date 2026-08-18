package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestAppServiceGetsAndUpdatesCurrentUser(t *testing.T) {
	repository := &fakeAppRepository{user: domain.User{ID: 37, Nickname: "旧昵称", Status: domain.StatusActive}, found: true}
	service := NewAppService(repository)
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}

	got, err := service.GetMe(context.Background(), actor)
	if err != nil || got.ID != 37 {
		t.Fatalf("GetMe() user=%+v error=%v", got, err)
	}
	nickname, realName := " 新昵称 ", " 王睿 "
	avatarURL := "https://example.test/avatar.png"
	updated, err := service.UpdateMe(context.Background(), actor, UpdateMeCommand{Nickname: &nickname, RealName: &realName, AvatarURL: &avatarURL})
	if err != nil {
		t.Fatalf("UpdateMe() error=%v", err)
	}
	if updated.Nickname != "新昵称" || updated.RealName == nil || *updated.RealName != "王睿" ||
		updated.AvatarURL == nil || *updated.AvatarURL != avatarURL || repository.saved.ID != 37 {
		t.Fatalf("unexpected update user=%+v saved=%+v", updated, repository.saved)
	}
}

func TestAppServiceRejectsInvalidActorAndEmptyPatch(t *testing.T) {
	service := NewAppService(&fakeAppRepository{user: domain.User{ID: 37, Status: domain.StatusActive}, found: true})
	if _, err := service.GetMe(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 37}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("GetMe() error=%v, want forbidden", err)
	}
	if _, err := service.UpdateMe(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}, UpdateMeCommand{}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("UpdateMe() error=%v, want validation", err)
	}
}

func TestAppServiceTreatsMissingOrFrozenUserAsUnauthorized(t *testing.T) {
	for name, repository := range map[string]*fakeAppRepository{
		"missing": {},
		"frozen":  {user: domain.User{ID: 37, Status: domain.StatusFrozen}, found: true},
	} {
		t.Run(name, func(t *testing.T) {
			service := NewAppService(repository)
			if err := service.EnsureActive(context.Background(), 37); !errors.Is(err, sharederror.ErrUnauthorized) {
				t.Fatalf("EnsureActive() error=%v, want unauthorized", err)
			}
		})
	}
}

type fakeAppRepository struct {
	user  domain.User
	found bool
	saved domain.User
	err   error
}

func (f *fakeAppRepository) FindByID(context.Context, int64) (domain.User, bool, error) {
	return f.user, f.found, f.err
}

func (f *fakeAppRepository) UpdateAppProfile(_ context.Context, user domain.User) (domain.User, error) {
	f.saved = user
	return user, f.err
}
