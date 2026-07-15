package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
)

type AdminRepository interface {
	FindByUsername(context.Context, string) (domain.Admin, bool, error)
	FindByID(context.Context, int64) (domain.Admin, bool, error)
	Count(context.Context) (int64, error)
	Create(context.Context, domain.Admin) (domain.Admin, error)
}
