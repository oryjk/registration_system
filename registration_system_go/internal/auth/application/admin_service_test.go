package application

import (
	"context"
	"errors"
	"testing"

	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestAdminLoginIssuesAdminToken(t *testing.T) {
	admins := &fakeAdminRepository{admin: authdomain.Admin{
		ID:           7,
		Username:     "operator",
		PasswordHash: "hash",
		Role:         authdomain.AdminRoleSuper,
		Status:       authdomain.AdminStatusActive,
	}}
	passwords := &fakePasswordService{}
	tokens := &fakeTokenService{token: "admin-jwt"}
	service := NewAdminService(admins, passwords, tokens)

	result, err := service.Login(context.Background(), "operator", "secret")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if result.Token != "admin-jwt" || !tokens.adminSuper {
		t.Fatalf("unexpected login result: %+v", result)
	}
}

func TestAdminLoginRejectsInvalidPassword(t *testing.T) {
	admins := &fakeAdminRepository{admin: authdomain.Admin{
		ID: 7, Username: "operator", PasswordHash: "hash", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusActive,
	}}
	passwords := &fakePasswordService{compareErr: errors.New("mismatch")}
	service := NewAdminService(admins, passwords, &fakeTokenService{token: "unused"})

	if _, err := service.Login(context.Background(), "operator", "wrong"); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestAdminLoginRejectsFrozenAdmin(t *testing.T) {
	admins := &fakeAdminRepository{admin: authdomain.Admin{
		ID: 7, Username: "operator", PasswordHash: "hash", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusFrozen,
	}}
	service := NewAdminService(admins, &fakePasswordService{}, &fakeTokenService{token: "unused"})

	if _, err := service.Login(context.Background(), "operator", "secret"); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

type fakeAdminRepository struct {
	admin authdomain.Admin
	found bool
}

func (f *fakeAdminRepository) FindByUsername(context.Context, string) (authdomain.Admin, bool, error) {
	return f.admin, f.admin.ID > 0 || f.found, nil
}

func (f *fakeAdminRepository) FindByID(context.Context, int64) (authdomain.Admin, bool, error) {
	return f.admin, f.admin.ID > 0 || f.found, nil
}

func (f *fakeAdminRepository) Count(context.Context) (int64, error) { return 0, nil }

func (f *fakeAdminRepository) Create(_ context.Context, admin authdomain.Admin) (authdomain.Admin, error) {
	admin.ID = 1
	return admin, nil
}

type fakePasswordService struct {
	compareErr error
}

func (f *fakePasswordService) Compare(string, string) error { return f.compareErr }
func (f *fakePasswordService) Hash(string) (string, error)  { return "hash", nil }
