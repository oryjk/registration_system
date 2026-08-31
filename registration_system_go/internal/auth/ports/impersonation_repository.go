package ports

import (
	"context"

	userdomain "github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	userports "github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

// ImpersonationUserRepository 身份切换（impersonate）所需的最小用户查询能力，
// 由 user 模块的 postgres Repository 实现（FindByID + ListForAdmin）。
type ImpersonationUserRepository interface {
	FindByID(context.Context, int64) (userdomain.User, bool, error)
	ListForAdmin(context.Context, userports.AdminUserFilter) ([]userdomain.User, error)
}
