package application

import (
	"context"
	"errors"
	"testing"

	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestAdminLoginIssuesAdminToken(t *testing.T) {
	admin := authdomain.Admin{
		ID:           7,
		Username:     "operator",
		PasswordHash: "hash",
		Role:         authdomain.AdminRoleSuper,
		Status:       authdomain.AdminStatusActive,
	}
	admins := &fakeAdminRepository{byUsername: map[string]authdomain.Admin{"operator": admin}}
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
	admin := authdomain.Admin{
		ID: 7, Username: "operator", PasswordHash: "hash", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusActive,
	}
	admins := &fakeAdminRepository{byUsername: map[string]authdomain.Admin{"operator": admin}}
	passwords := &fakePasswordService{compareErr: errors.New("mismatch")}
	service := NewAdminService(admins, passwords, &fakeTokenService{token: "unused"})

	if _, err := service.Login(context.Background(), "operator", "wrong"); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestAdminLoginRejectsFrozenAdmin(t *testing.T) {
	admin := authdomain.Admin{
		ID: 7, Username: "operator", PasswordHash: "hash", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusFrozen,
	}
	admins := &fakeAdminRepository{byUsername: map[string]authdomain.Admin{"operator": admin}}
	service := NewAdminService(admins, &fakePasswordService{}, &fakeTokenService{token: "unused"})

	if _, err := service.Login(context.Background(), "operator", "secret"); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestSuperAdminCreatesVenueAdmin(t *testing.T) {
	super := authdomain.Admin{ID: 7, Username: "root", Role: authdomain.AdminRoleSuper, Status: authdomain.AdminStatusActive}
	admins := &fakeAdminRepository{byID: map[int64]authdomain.Admin{7: super}}
	passwords := &fakePasswordService{}
	service := NewAdminService(admins, passwords, nil)

	created, err := service.CreateAdmin(context.Background(), adminActor(7, true), " venue-east ", "123456")
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if created.Username != "venue-east" || created.Role != authdomain.AdminRoleAdmin || created.Status != authdomain.AdminStatusActive {
		t.Fatalf("unexpected created admin: %+v", created)
	}
	if admins.created.PasswordHash != "hash" || passwords.hashedPassword != "123456" {
		t.Fatalf("password was not hashed: %+v", admins.created)
	}
}

func TestCreateAdminRejectsPasswordShorterThanSixCharacters(t *testing.T) {
	super := authdomain.Admin{ID: 7, Username: "root", Role: authdomain.AdminRoleSuper, Status: authdomain.AdminStatusActive}
	admins := &fakeAdminRepository{byID: map[int64]authdomain.Admin{7: super}}
	service := NewAdminService(admins, &fakePasswordService{}, nil)

	_, err := service.CreateAdmin(context.Background(), adminActor(7, true), "venue-east", "12345")
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestVenueAdminCannotCreateAdmin(t *testing.T) {
	venue := authdomain.Admin{ID: 8, Username: "venue", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusActive}
	service := NewAdminService(&fakeAdminRepository{byID: map[int64]authdomain.Admin{8: venue}}, &fakePasswordService{}, nil)

	_, err := service.CreateAdmin(context.Background(), adminActor(8, false), "another-venue", "venue-pass-123")
	if !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestCreateAdminRejectsDuplicateUsername(t *testing.T) {
	super := authdomain.Admin{ID: 7, Username: "root", Role: authdomain.AdminRoleSuper, Status: authdomain.AdminStatusActive}
	existing := authdomain.Admin{ID: 9, Username: "venue-east", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusActive}
	admins := &fakeAdminRepository{
		byID:       map[int64]authdomain.Admin{7: super},
		byUsername: map[string]authdomain.Admin{"venue-east": existing},
	}
	service := NewAdminService(admins, &fakePasswordService{}, nil)

	_, err := service.CreateAdmin(context.Background(), adminActor(7, true), "venue-east", "venue-pass-123")
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func TestSuperAdminListsAdmins(t *testing.T) {
	super := authdomain.Admin{ID: 7, Username: "root", Role: authdomain.AdminRoleSuper, Status: authdomain.AdminStatusActive}
	venue := authdomain.Admin{ID: 8, Username: "venue", Role: authdomain.AdminRoleAdmin, Status: authdomain.AdminStatusActive}
	service := NewAdminService(&fakeAdminRepository{byID: map[int64]authdomain.Admin{7: super}, admins: []authdomain.Admin{super, venue}}, &fakePasswordService{}, nil)

	result, err := service.ListAdmins(context.Background(), adminActor(7, true))
	if err != nil {
		t.Fatalf("list admins: %v", err)
	}
	if len(result) != 2 || result[1].Username != "venue" {
		t.Fatalf("unexpected admins: %+v", result)
	}
}

func adminActor(id int64, super bool) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: id, IsSuperAdmin: super}
}

type fakeAdminRepository struct {
	byUsername map[string]authdomain.Admin
	byID       map[int64]authdomain.Admin
	admins     []authdomain.Admin
	created    authdomain.Admin
}

func (f *fakeAdminRepository) FindByUsername(_ context.Context, username string) (authdomain.Admin, bool, error) {
	admin, found := f.byUsername[username]
	return admin, found, nil
}

func (f *fakeAdminRepository) FindByID(_ context.Context, id int64) (authdomain.Admin, bool, error) {
	admin, found := f.byID[id]
	return admin, found, nil
}

func (f *fakeAdminRepository) List(context.Context) ([]authdomain.Admin, error) { return f.admins, nil }

func (f *fakeAdminRepository) Count(context.Context) (int64, error) { return 0, nil }

func (f *fakeAdminRepository) Create(_ context.Context, admin authdomain.Admin) (authdomain.Admin, error) {
	f.created = admin
	admin.ID = 1
	return admin, nil
}

type fakePasswordService struct {
	compareErr     error
	hashedPassword string
}

func (f *fakePasswordService) Compare(string, string) error { return f.compareErr }
func (f *fakePasswordService) Hash(password string) (string, error) {
	f.hashedPassword = password
	return "hash", nil
}
