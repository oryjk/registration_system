package application

import (
	"context"
	"errors"
	"testing"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	userports "github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

func errorKind(err error) sharederror.Kind {
	var sharedErr *sharederror.Error
	if errors.As(err, &sharedErr) {
		return sharedErr.Kind
	}
	return ""
}

type fakeImpersonationUsers struct {
	byID       map[int64]userdomain.User
	listResult []userdomain.User
	lastFilter userports.AdminUserFilter
}

func (f *fakeImpersonationUsers) FindByID(_ context.Context, id int64) (userdomain.User, bool, error) {
	user, ok := f.byID[id]
	return user, ok, nil
}

func (f *fakeImpersonationUsers) ListForAdmin(_ context.Context, filter userports.AdminUserFilter) ([]userdomain.User, error) {
	f.lastFilter = filter
	return f.listResult, nil
}

func allowedUserIDs(ids ...int64) map[int64]struct{} {
	allowed := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		allowed[id] = struct{}{}
	}
	return allowed
}

func activeUser(id int64) userdomain.User {
	return userdomain.User{ID: id, OpenID: "openid", Nickname: "目标用户", Status: userdomain.StatusActive}
}

func TestImpersonateIssuesTokenForTargetUser(t *testing.T) {
	users := &fakeImpersonationUsers{byID: map[int64]userdomain.User{9: activeUser(9)}}
	service := NewImpersonationService(users, &fakeTokenService{token: "impersonated-token"}, allowedUserIDs(4))

	result, err := service.Impersonate(context.Background(), 4, 9)
	if err != nil {
		t.Fatalf("impersonate: %v", err)
	}
	if result.Token != "impersonated-token" || result.User.ID != 9 {
		t.Fatalf("expected token for user 9, got %+v", result)
	}
}

func TestImpersonateRejectsActorOutsideAllowlist(t *testing.T) {
	users := &fakeImpersonationUsers{byID: map[int64]userdomain.User{9: activeUser(9)}}
	service := NewImpersonationService(users, &fakeTokenService{}, allowedUserIDs(4))

	_, err := service.Impersonate(context.Background(), 8, 9)
	if kind := errorKind(err); kind != sharederror.KindForbidden {
		t.Fatalf("expected forbidden, got %v (%v)", kind, err)
	}
}

func TestImpersonateRejectsEmptyAllowlist(t *testing.T) {
	users := &fakeImpersonationUsers{byID: map[int64]userdomain.User{9: activeUser(9)}}
	service := NewImpersonationService(users, &fakeTokenService{}, nil)

	_, err := service.Impersonate(context.Background(), 4, 9)
	if kind := errorKind(err); kind != sharederror.KindForbidden {
		t.Fatalf("expected forbidden, got %v (%v)", kind, err)
	}
}

func TestImpersonateReturnsNotFoundForMissingTarget(t *testing.T) {
	service := NewImpersonationService(&fakeImpersonationUsers{}, &fakeTokenService{}, allowedUserIDs(4))

	_, err := service.Impersonate(context.Background(), 4, 404)
	if kind := errorKind(err); kind != sharederror.KindNotFound {
		t.Fatalf("expected not_found, got %v (%v)", kind, err)
	}
}

func TestImpersonateRejectsFrozenTarget(t *testing.T) {
	frozen := activeUser(9)
	frozen.Status = userdomain.StatusFrozen
	users := &fakeImpersonationUsers{byID: map[int64]userdomain.User{9: frozen}}
	service := NewImpersonationService(users, &fakeTokenService{}, allowedUserIDs(4))

	_, err := service.Impersonate(context.Background(), 4, 9)
	if kind := errorKind(err); kind != sharederror.KindForbidden {
		t.Fatalf("expected forbidden, got %v (%v)", kind, err)
	}
}

func TestSearchTargetsRequiresAllowlistAndCapsLimit(t *testing.T) {
	users := &fakeImpersonationUsers{listResult: []userdomain.User{activeUser(9)}}
	service := NewImpersonationService(users, &fakeTokenService{}, allowedUserIDs(4))

	if _, err := service.SearchTargets(context.Background(), 8, "张"); errorKind(err) != sharederror.KindForbidden {
		t.Fatalf("expected forbidden for actor outside allowlist, got %v", err)
	}

	items, err := service.SearchTargets(context.Background(), 4, " 张 ")
	if err != nil {
		t.Fatalf("search targets: %v", err)
	}
	if len(items) != 1 || items[0].ID != 9 {
		t.Fatalf("unexpected items %+v", items)
	}
	if users.lastFilter.Search != "张" || users.lastFilter.Limit != 20 || users.lastFilter.Offset != 0 {
		t.Fatalf("unexpected filter %+v", users.lastFilter)
	}
}
