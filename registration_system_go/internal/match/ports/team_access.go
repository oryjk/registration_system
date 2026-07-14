package ports

import "context"

type TeamAccess interface {
	EnsureManager(context.Context, int64, int64) error
}
