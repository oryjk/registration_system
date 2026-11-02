package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
)

type Repository interface {
	ListSuggestions(context.Context, int32) ([]domain.Venue, error)
	ListMap(context.Context) ([]domain.Venue, error)
	SetImage(context.Context, string, string) error
}

type ImageStore interface {
	Save(context.Context, string, string, []byte) (string, error)
}
