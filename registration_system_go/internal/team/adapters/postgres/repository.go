package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	teamsqlc "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type Repository struct {
	queries *teamsqlc.Queries
}

func NewRepository(database teamsqlc.DBTX) *Repository {
	return &Repository{queries: teamsqlc.New(database)}
}

func (r *Repository) FindByID(ctx context.Context, teamID int64) (domain.Team, bool, error) {
	row, err := r.queries.GetTeamByID(ctx, teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Team{}, false, nil
	}
	if err != nil {
		return domain.Team{}, false, err
	}
	return mapTeam(row), true, nil
}

func (r *Repository) FindActiveMember(ctx context.Context, teamID, userID int64) (domain.Member, bool, error) {
	row, err := r.queries.GetActiveTeamMember(ctx, teamsqlc.GetActiveTeamMemberParams{TeamID: teamID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Member{}, false, nil
	}
	if err != nil {
		return domain.Member{}, false, err
	}
	return domain.Member{
		ID:       row.ID,
		TeamID:   row.TeamID,
		UserID:   row.UserID,
		Role:     domain.Role(row.Role),
		Status:   domain.MemberStatus(row.Status),
		JoinedAt: row.JoinedAt.Time,
	}, true, nil
}

func (r *Repository) ListByUser(ctx context.Context, userID int64) ([]domain.TeamMembership, error) {
	rows, err := r.queries.ListActiveUserTeams(ctx, userID)
	if err != nil {
		return nil, err
	}
	items := make([]domain.TeamMembership, 0, len(rows))
	for _, row := range rows {
		items = append(items, domain.TeamMembership{
			Team: domain.Team{
				ID:          row.ID,
				Name:        row.Name,
				Description: row.Description,
				LogoURL:     row.LogoUrl,
				CaptainID:   row.CaptainID,
				Status:      domain.TeamStatus(row.Status),
				CreatedAt:   row.CreatedAt.Time,
				UpdatedAt:   row.UpdatedAt.Time,
			},
			Member: domain.Member{
				TeamID:   row.ID,
				UserID:   userID,
				Role:     domain.Role(row.MemberRole),
				Status:   domain.MemberActive,
				JoinedAt: row.JoinedAt.Time,
			},
		})
	}
	return items, nil
}

func (r *Repository) ListActive(ctx context.Context) ([]domain.Team, error) {
	rows, err := r.queries.ListActiveTeams(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Team, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapTeam(row))
	}
	return items, nil
}

func (r *Repository) Create(ctx context.Context, team domain.Team) (domain.Team, error) {
	row, err := r.queries.CreateTeam(ctx, teamsqlc.CreateTeamParams{Name: team.Name, Description: team.Description})
	if err != nil {
		return domain.Team{}, err
	}
	return mapTeam(row), nil
}

func mapTeam(row teamsqlc.Team) domain.Team {
	return domain.Team{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		LogoURL:     row.LogoUrl,
		CaptainID:   row.CaptainID,
		Status:      domain.TeamStatus(row.Status),
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
}
