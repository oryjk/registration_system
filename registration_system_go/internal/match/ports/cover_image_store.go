package ports

import "context"

// CoverImageStore stores cover bytes and returns a public URL; it does not update matches.
type CoverImageStore interface {
	Save(context.Context, string, string, []byte) (string, error)
}
