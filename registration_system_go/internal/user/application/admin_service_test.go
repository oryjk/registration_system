package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

func TestAdminUserServiceMapsActivityFilter(t *testing.T) {
	for _, activity := range []string{"all", "active_7d", "inactive_30d", "never"} {
		t.Run(activity, func(t *testing.T) {
			repository := &fakeAdminUserRepository{}
			service := NewAdminUserService(repository)
			_, err := service.List(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, AdminUserListQuery{Activity: activity})
			if err != nil {
				t.Fatalf("List() error=%v", err)
			}
			if repository.filter.Activity != activity {
				t.Fatalf("filter activity=%q, want %q", repository.filter.Activity, activity)
			}
		})
	}
}

func TestAdminUserServiceDefaultsAndValidatesActivityFilter(t *testing.T) {
	repository := &fakeAdminUserRepository{}
	service := NewAdminUserService(repository)
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	if _, err := service.List(context.Background(), actor, AdminUserListQuery{}); err != nil {
		t.Fatalf("List() default activity error=%v", err)
	}
	if repository.filter.Activity != "all" {
		t.Fatalf("default filter activity=%q, want all", repository.filter.Activity)
	}

	if _, err := service.List(context.Background(), actor, AdminUserListQuery{Activity: "yesterday"}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("List() error=%v, want validation", err)
	}
}

type fakeAdminUserRepository struct {
	filter ports.AdminUserFilter
}

func (f *fakeAdminUserRepository) ListForAdmin(_ context.Context, filter ports.AdminUserFilter) ([]domain.User, error) {
	f.filter = filter
	return nil, nil
}

func (f *fakeAdminUserRepository) CountForAdmin(_ context.Context, filter ports.AdminUserFilter) (int64, error) {
	f.filter = filter
	return 0, nil
}

func (f *fakeAdminUserRepository) UpdateMatchAdmin(context.Context, int64, bool) (domain.User, bool, error) {
	return domain.User{}, false, nil
}
