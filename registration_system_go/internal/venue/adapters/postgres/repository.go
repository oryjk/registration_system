package venuepostgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	sqlc "github.com/oryjk/registration_system/registration_system_go/internal/venue/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
)

type Repository struct {
	queries *sqlc.Queries
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{queries: sqlc.New(pool)}
}

func (r *Repository) ListSuggestions(ctx context.Context, limit int32) ([]domain.Venue, error) {
	rows, err := r.queries.ListVenueSuggestions(ctx, limit)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Venue, 0, len(rows))
	for _, row := range rows {
		latitude, longitude := row.Latitude, row.Longitude
		items = append(items, domain.Venue{
			Name: row.Name, Latitude: &latitude, Longitude: &longitude,
			UseCount: row.UseCount, LastUsedAt: row.LastUsedAt.Time, ImageURL: row.ImageUrl,
		})
	}
	return items, nil
}

func (r *Repository) ListMap(ctx context.Context) ([]domain.Venue, error) {
	rows, err := r.queries.ListVenueMap(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Venue, 0, len(rows))
	for _, row := range rows {
		latitude, longitude := row.Latitude, row.Longitude
		items = append(items, domain.Venue{
			Name: row.Name, Latitude: &latitude, Longitude: &longitude,
			UseCount: row.UseCount, LastUsedAt: row.LastUsedAt.Time, ImageURL: row.ImageUrl,
		})
	}
	return items, nil
}

func (r *Repository) SetImage(ctx context.Context, name, imageURL string) error {
	return r.queries.SetVenueImage(ctx, sqlc.SetVenueImageParams{Name: name, ImageUrl: imageURL})
}
