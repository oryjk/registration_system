package application

import (
	"context"
	"strings"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

const (
	defaultAdminUserPageSize = 20
	maxAdminUserPageSize     = 100
)

// AdminUserService 管理端的微信用户管理：搜索用户、设置/取消比赛管理员。
type AdminUserService struct {
	repository ports.AdminRepository
}

type AdminUserListQuery struct {
	Search string
	// MatchAdminOnly 为 true 时只返回比赛管理员。
	MatchAdminOnly bool
	Page           int
	PageSize       int
}

type AdminUserListResult struct {
	Items    []domain.User
	Total    int64
	Page     int
	PageSize int
}

func NewAdminUserService(repository ports.AdminRepository) AdminUserService {
	return AdminUserService{repository: repository}
}

func (s AdminUserService) List(ctx context.Context, actor sharedauth.Actor, query AdminUserListQuery) (AdminUserListResult, error) {
	if !actor.IsAdmin() {
		return AdminUserListResult{}, sharederror.ErrForbidden
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = defaultAdminUserPageSize
	}
	if query.PageSize > maxAdminUserPageSize {
		query.PageSize = maxAdminUserPageSize
	}
	filter := ports.AdminUserFilter{
		Search: strings.TrimSpace(query.Search), MatchAdminOnly: query.MatchAdminOnly,
		Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize,
	}
	items, err := s.repository.ListForAdmin(ctx, filter)
	if err != nil {
		return AdminUserListResult{}, sharederror.Wrap(sharederror.KindInternal, "查询用户失败", err)
	}
	total, err := s.repository.CountForAdmin(ctx, filter)
	if err != nil {
		return AdminUserListResult{}, sharederror.Wrap(sharederror.KindInternal, "统计用户失败", err)
	}
	return AdminUserListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

// SetMatchAdmin 把任意微信用户设为/取消比赛管理员。
func (s AdminUserService) SetMatchAdmin(ctx context.Context, actor sharedauth.Actor, userID int64, enabled bool) (domain.User, error) {
	if !actor.IsAdmin() {
		return domain.User{}, sharederror.ErrForbidden
	}
	if userID <= 0 {
		return domain.User{}, sharederror.New(sharederror.KindValidation, "用户 ID 无效")
	}
	user, found, err := s.repository.UpdateMatchAdmin(ctx, userID, enabled)
	if err != nil {
		return domain.User{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛管理员失败", err)
	}
	if !found {
		return domain.User{}, sharederror.New(sharederror.KindNotFound, "用户不存在")
	}
	return user, nil
}
