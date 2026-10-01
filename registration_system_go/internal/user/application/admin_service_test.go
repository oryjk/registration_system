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

func TestAdminUserServiceDefaultsAndValidatesListControls(t *testing.T) {
	repository := &fakeAdminUserRepository{}
	service := NewAdminUserService(repository)
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	// 默认值：不过滤身份/状态，排序与历史行为一致（最近活跃倒序）。
	if _, err := service.List(context.Background(), actor, AdminUserListQuery{}); err != nil {
		t.Fatalf("List() default error=%v", err)
	}
	if repository.filter.Sort != "last_active_desc" || repository.filter.Identity != "all" || repository.filter.StatusFilter != "all" {
		t.Fatalf("default filter=%+v, want sort=last_active_desc identity=all status=all", repository.filter)
	}

	// 旧参数 match_admin_only=true 等价于 identity=match_admin。
	if _, err := service.List(context.Background(), actor, AdminUserListQuery{MatchAdminOnly: true}); err != nil {
		t.Fatalf("List() legacy match_admin_only error=%v", err)
	}
	if repository.filter.Identity != "match_admin" {
		t.Fatalf("legacy filter identity=%q, want match_admin", repository.filter.Identity)
	}

	// 显式 identity 优先于旧参数。
	if _, err := service.List(context.Background(), actor, AdminUserListQuery{MatchAdminOnly: true, Identity: "normal"}); err != nil {
		t.Fatalf("List() identity override error=%v", err)
	}
	if repository.filter.Identity != "normal" {
		t.Fatalf("filter identity=%q, want normal", repository.filter.Identity)
	}

	// 合法值原样透传。
	if _, err := service.List(context.Background(), actor, AdminUserListQuery{
		Identity: "match_admin", StatusFilter: "frozen", Sort: "created_asc",
	}); err != nil {
		t.Fatalf("List() valid values error=%v", err)
	}
	if repository.filter.Identity != "match_admin" || repository.filter.StatusFilter != "frozen" || repository.filter.Sort != "created_asc" {
		t.Fatalf("filter=%+v, want identity=match_admin status=frozen sort=created_asc", repository.filter)
	}

	for name, query := range map[string]AdminUserListQuery{
		"identity": {Identity: "superuser"},
		"status":   {StatusFilter: "banned"},
		"sort":     {Sort: "nickname_asc"},
	} {
		if _, err := service.List(context.Background(), actor, query); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("List() %s error=%v, want validation", name, err)
		}
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
