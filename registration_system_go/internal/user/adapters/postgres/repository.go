package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	authsqlc "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

type Repository struct {
	queries *authsqlc.Queries
}

func NewRepository(database authsqlc.DBTX) *Repository {
	return &Repository{queries: authsqlc.New(database)}
}

func (r *Repository) FindByOpenID(ctx context.Context, openID string) (domain.User, bool, error) {
	row, err := r.queries.GetUserByOpenID(ctx, openID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, false, nil
	}
	if err != nil {
		return domain.User{}, false, err
	}
	return mapUser(row), true, nil
}

func (r *Repository) FindByID(ctx context.Context, userID int64) (domain.User, bool, error) {
	row, err := r.queries.GetUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, false, nil
	}
	if err != nil {
		return domain.User{}, false, err
	}
	return mapUser(row), true, nil
}

func (r *Repository) Create(ctx context.Context, user domain.User) (domain.User, error) {
	row, err := r.queries.CreateUser(ctx, authsqlc.CreateUserParams{
		Openid:    user.OpenID,
		Nickname:  user.Nickname,
		AvatarUrl: user.AvatarURL,
	})
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row), nil
}

func mapUser(row authsqlc.User) domain.User {
	return domain.User{
		ID:        row.ID,
		OpenID:    row.Openid,
		Nickname:  row.Nickname,
		AvatarURL: row.AvatarUrl,
		Status:    domain.Status(row.Status),
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}
}
