package ports

import (
	"context"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

type TokenService interface {
	IssueUser(context.Context, int64) (string, error)
	IssueAdmin(context.Context, int64, bool) (string, error)
	Parse(context.Context, string) (sharedauth.Actor, error)
}
