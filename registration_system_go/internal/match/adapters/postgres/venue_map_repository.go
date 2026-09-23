package postgres

import (
	"context"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

func (r *Repository) ListVenueMap(ctx context.Context) ([]ports.VenueSuggestion, error) {
	rows, err := r.queries.ListVenueMap(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]ports.VenueSuggestion, 0, len(rows))
	for _, row := range rows {
		latitude, longitude := row.Latitude, row.Longitude
		items = append(items, ports.VenueSuggestion{Location: row.Location, Latitude: &latitude, Longitude: &longitude, UseCount: row.UseCount, LastUsedAt: row.LastUsedAt.Time})
	}
	return items, nil
}
