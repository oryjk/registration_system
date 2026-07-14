package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type Repository interface {
	FindByOpenID(context.Context, string) (domain.User, bool, error)
	FindByID(context.Context, int64) (domain.User, bool, error)
	Create(context.Context, domain.User) (domain.User, error)
}
