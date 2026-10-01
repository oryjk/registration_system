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
	// MatchAdminOnly 为 true 时只返回比赛管理员（旧参数，等价于 Identity=match_admin）。
	MatchAdminOnly bool
	// Identity: all / match_admin / normal。
	Identity string
	// StatusFilter: all / active / frozen。
	StatusFilter string
	// Activity: all / active_7d / inactive_30d / never。
	Activity string
	// Sort: last_active_desc / last_active_asc / created_desc / created_asc。
	Sort     string
	Page     int
	PageSize int
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
	activity, err := normalizeAdminUserActivity(query.Activity)
	if err != nil {
		return AdminUserListResult{}, err
	}
	identity, err := normalizeAdminUserIdentity(query.Identity)
	if err != nil {
		return AdminUserListResult{}, err
	}
	if identity == "all" && query.MatchAdminOnly {
		identity = "match_admin"
	}
	statusFilter, err := normalizeAdminUserStatus(query.StatusFilter)
	if err != nil {
		return AdminUserListResult{}, err
	}
	sort, err := normalizeAdminUserSort(query.Sort)
	if err != nil {
		return AdminUserListResult{}, err
	}
	filter := ports.AdminUserFilter{
		Search: strings.TrimSpace(query.Search), Identity: identity, StatusFilter: statusFilter, Activity: activity, Sort: sort,
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

func normalizeAdminUserActivity(value string) (string, error) {
	switch value = strings.TrimSpace(value); value {
	case "", "all":
		return "all", nil
	case "active_7d", "inactive_30d", "never":
		return value, nil
	default:
		return "", sharederror.New(sharederror.KindValidation, "用户活跃筛选条件无效")
	}
}

func normalizeAdminUserIdentity(value string) (string, error) {
	switch value = strings.TrimSpace(value); value {
	case "", "all":
		return "all", nil
	case "match_admin", "normal":
		return value, nil
	default:
		return "", sharederror.New(sharederror.KindValidation, "用户身份筛选条件无效")
	}
}

func normalizeAdminUserStatus(value string) (string, error) {
	switch value = strings.TrimSpace(value); value {
	case "", "all":
		return "all", nil
	case "active", "frozen":
		return value, nil
	default:
		return "", sharederror.New(sharederror.KindValidation, "用户账号状态筛选条件无效")
	}
}

// normalizeAdminUserSort 排序方向由 token 携带；默认与历史行为一致（最近活跃倒序）。
func normalizeAdminUserSort(value string) (string, error) {
	switch value = strings.TrimSpace(value); value {
	case "":
		return "last_active_desc", nil
	case "last_active_desc", "last_active_asc", "created_desc", "created_asc":
		return value, nil
	default:
		return "", sharederror.New(sharederror.KindValidation, "用户列表排序条件无效")
	}
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
