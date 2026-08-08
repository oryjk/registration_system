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
