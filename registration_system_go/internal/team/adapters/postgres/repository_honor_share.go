package postgres

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamsqlc "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func (r *Repository) CreateHonorShare(ctx context.Context, teamID, userID int64, year int32) (uuid.UUID, error) {
	id, err := r.queries.CreateHonorShare(ctx, teamsqlc.CreateHonorShareParams{ID: pgtype.UUID{Bytes: uuid.New(), Valid: true}, TeamID: teamID, UserID: userID, ScoreYear: year})
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, sharederror.ErrForbidden
	}
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.UUID(id.Bytes), nil
}
func (r *Repository) FindHonorShare(ctx context.Context, id uuid.UUID) (domain.HonorShare, bool, error) {
	row, err := r.queries.FindHonorShare(ctx, pgtype.UUID{Bytes: id, Valid: true})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.HonorShare{}, false, nil
	}
	if err != nil {
		return domain.HonorShare{}, false, err
	}
	return domain.HonorShare{ID: uuid.UUID(row.ID.Bytes), TeamID: row.TeamID, UserID: row.UserID, ScoreYear: row.ScoreYear, TeamName: row.TeamName, TeamDescription: row.TeamDescription, TeamLogoURL: row.TeamLogoUrl, Nickname: row.Nickname, AvatarURL: row.AvatarUrl, IsPaidMember: row.IsPaidMember, RequiresPassword: row.RequiresPassword, ParticipationPoints: row.ParticipationPoints, ParticipationRank: row.ParticipationRank}, true, nil
}
