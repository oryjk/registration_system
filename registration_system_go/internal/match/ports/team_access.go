package ports

import "context"

type TeamAccess interface {
	EnsureManager(context.Context, int64, int64) error
	EnsureExists(context.Context, int64) error
	EnsureActive(context.Context, int64) error
}
