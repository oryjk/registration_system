package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type AppRepository interface {
	FindByID(context.Context, int64) (domain.User, bool, error)
	UpdateAppProfile(context.Context, domain.User) (domain.User, error)
}

type TestLoginTeam struct {
	ID   int64
	Name string
	Role string
}

type TestLoginUser struct {
	User  domain.User
	Teams []TestLoginTeam
}

type TestLoginRepository interface {
	FindByID(context.Context, int64) (domain.User, bool, error)
	ListActiveTestLoginUsers(context.Context) ([]TestLoginUser, error)
}

// AdminUserFilter 管理端微信用户搜索条件。
type AdminUserFilter struct {
	Search         string
	MatchAdminOnly bool
	Limit          int
	Offset         int
}

// AdminRepository 管理端用户管理仓储。
type AdminRepository interface {
	ListForAdmin(context.Context, AdminUserFilter) ([]domain.User, error)
	CountForAdmin(context.Context, AdminUserFilter) (int64, error)
	// UpdateMatchAdmin 设置/取消比赛管理员标记；返回 found 表示用户是否存在。
	UpdateMatchAdmin(context.Context, int64, bool) (domain.User, bool, error)
}
