package application

import (
	"context"
	"errors"
	"strings"

	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type AdminService struct {
	admins    ports.AdminRepository
	passwords ports.PasswordService
	tokens    ports.TokenService
}

type AdminLoginResult struct {
	Token string
	Admin domain.Admin
}

const minimumAdminPasswordLength = 6

func NewAdminService(admins ports.AdminRepository, passwords ports.PasswordService, tokens ports.TokenService) AdminService {
	return AdminService{admins: admins, passwords: passwords, tokens: tokens}
}

func (s AdminService) Login(ctx context.Context, username, password string) (AdminLoginResult, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return AdminLoginResult{}, sharederror.New(sharederror.KindValidation, "账号和密码不能为空")
	}
	admin, found, err := s.admins.FindByUsername(ctx, username)
	if err != nil {
		return AdminLoginResult{}, sharederror.Wrap(sharederror.KindInternal, "查询管理员失败", err)
	}
	if !found || s.passwords.Compare(admin.PasswordHash, password) != nil {
		return AdminLoginResult{}, sharederror.New(sharederror.KindUnauthorized, "账号或密码错误")
	}
	if !admin.IsActive() {
		return AdminLoginResult{}, sharederror.New(sharederror.KindForbidden, "管理员已冻结")
	}
	token, err := s.tokens.IssueAdmin(ctx, admin.ID, admin.IsSuper())
	if err != nil {
		return AdminLoginResult{}, sharederror.Wrap(sharederror.KindInternal, "签发管理员凭证失败", err)
	}
	return AdminLoginResult{Token: token, Admin: admin}, nil
}

func (s AdminService) Current(ctx context.Context, actor sharedauth.Actor) (domain.Admin, error) {
	if !actor.IsAdmin() {
		return domain.Admin{}, sharederror.ErrForbidden
	}
	admin, found, err := s.admins.FindByID(ctx, actor.ID)
	if err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "查询管理员失败", err)
	}
	if !found || !admin.IsActive() {
		return domain.Admin{}, sharederror.ErrUnauthorized
	}
	return admin, nil
}

func (s AdminService) CreateAdmin(ctx context.Context, actor sharedauth.Actor, username, password string) (domain.Admin, error) {
	if _, err := s.requireSuperAdmin(ctx, actor); err != nil {
		return domain.Admin{}, err
	}
	username = strings.TrimSpace(username)
	if username == "" || len(username) > 64 {
		return domain.Admin{}, sharederror.New(sharederror.KindValidation, "管理员账号不能为空且不能超过 64 个字符")
	}
	if len(password) < minimumAdminPasswordLength {
		return domain.Admin{}, sharederror.New(sharederror.KindValidation, "管理员密码至少需要 6 个字符")
	}
	if _, found, err := s.admins.FindByUsername(ctx, username); err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "检查管理员账号失败", err)
	} else if found {
		return domain.Admin{}, sharederror.New(sharederror.KindConflict, "管理员账号已存在")
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "加密管理员密码失败", err)
	}
	admin, err := domain.NewAdmin(username, hash, domain.AdminRoleAdmin)
	if err != nil {
		return domain.Admin{}, err
	}
	created, err := s.admins.Create(ctx, admin)
	if err != nil {
		if errors.Is(err, sharederror.ErrConflict) {
			return domain.Admin{}, sharederror.New(sharederror.KindConflict, "管理员账号已存在")
		}
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "创建管理员失败", err)
	}
	return created, nil
}

func (s AdminService) ListAdmins(ctx context.Context, actor sharedauth.Actor) ([]domain.Admin, error) {
	if _, err := s.requireSuperAdmin(ctx, actor); err != nil {
		return nil, err
	}
	admins, err := s.admins.List(ctx)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询管理员列表失败", err)
	}
	return admins, nil
}

func (s AdminService) EnsureSuperAdmin(ctx context.Context, actor sharedauth.Actor) error {
	_, err := s.requireSuperAdmin(ctx, actor)
	return err
}

func (s AdminService) requireSuperAdmin(ctx context.Context, actor sharedauth.Actor) (domain.Admin, error) {
	admin, err := s.Current(ctx, actor)
	if err != nil {
		return domain.Admin{}, err
	}
	if !admin.IsSuper() {
		return domain.Admin{}, sharederror.ErrForbidden
	}
	return admin, nil
}

func (s AdminService) CreateInitial(ctx context.Context, username, password string, role domain.AdminRole) (domain.Admin, error) {
	count, err := s.admins.Count(ctx)
	if err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "统计管理员失败", err)
	}
	if count > 0 {
		return domain.Admin{}, sharederror.New(sharederror.KindConflict, "初始管理员已存在")
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "加密管理员密码失败", err)
	}
	admin, err := domain.NewAdmin(username, hash, role)
	if err != nil {
		return domain.Admin{}, err
	}
	created, err := s.admins.Create(ctx, admin)
	if err != nil {
		return domain.Admin{}, sharederror.Wrap(sharederror.KindInternal, "创建初始管理员失败", err)
	}
	return created, nil
}
