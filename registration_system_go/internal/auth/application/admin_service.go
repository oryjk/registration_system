package application

import (
	"context"
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
