package ports

import (
	"context"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

type AdminAccess interface {
	EnsureSuperAdmin(context.Context, sharedauth.Actor) error
}
