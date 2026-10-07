package postgres

import (
	"context"
	teamsqlc "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

func (r *Repository) ListAnnualParticipationPoints(ctx context.Context, teamID, userID int64) ([]ports.AnnualParticipationPoints, error) {
	rows, err := r.queries.ListAnnualParticipationPoints(ctx, teamsqlc.ListAnnualParticipationPointsParams{TeamID: &teamID, UserID: userID})
	if err != nil {
		return nil, err
	}
	items := make([]ports.AnnualParticipationPoints, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.AnnualParticipationPoints{ScoreYear: row.ScoreYear, ParticipationPoints: row.ParticipationPoints})
	}
	return items, nil
}
