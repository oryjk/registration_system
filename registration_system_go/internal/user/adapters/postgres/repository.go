package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	authsqlc "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
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
	return mapUser(row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber, row.Status, row.CreatedAt.Time, row.UpdatedAt.Time), true, nil
}

func (r *Repository) FindByID(ctx context.Context, userID int64) (domain.User, bool, error) {
	row, err := r.queries.GetUserByID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, false, nil
	}
	if err != nil {
		return domain.User{}, false, err
	}
	return mapUser(row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber, row.Status, row.CreatedAt.Time, row.UpdatedAt.Time), true, nil
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
	return mapUser(row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber, row.Status, row.CreatedAt.Time, row.UpdatedAt.Time), nil
}

func (r *Repository) UpdateProfile(ctx context.Context, user domain.User) (domain.User, error) {
	row, err := r.queries.UpdateUserBasicProfile(ctx, authsqlc.UpdateUserBasicProfileParams{
		ID: user.ID, RealName: user.RealName, PhoneNumber: user.PhoneNumber,
	})
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber, row.Status, row.CreatedAt.Time, row.UpdatedAt.Time), nil
}

func (r *Repository) UpdateAppProfile(ctx context.Context, user domain.User) (domain.User, error) {
	row, err := r.queries.UpdateUserAppProfile(ctx, authsqlc.UpdateUserAppProfileParams{
		ID: user.ID, Nickname: user.Nickname, RealName: user.RealName,
	})
	if err != nil {
		return domain.User{}, err
	}
	return mapUser(row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber, row.Status, row.CreatedAt.Time, row.UpdatedAt.Time), nil
}

func (r *Repository) ListActiveTestLoginUsers(ctx context.Context) ([]ports.TestLoginUser, error) {
	rows, err := r.queries.ListActiveTestLoginUsers(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]ports.TestLoginUser, 0)
	indexByUserID := make(map[int64]int)
	for _, row := range rows {
		index, exists := indexByUserID[row.ID]
		if !exists {
			items = append(items, ports.TestLoginUser{User: mapUser(
				row.ID, row.Openid, row.Nickname, row.AvatarUrl, row.RealName, row.PhoneNumber,
				row.Status, row.CreatedAt.Time, row.UpdatedAt.Time,
			)})
			index = len(items) - 1
			indexByUserID[row.ID] = index
		}
		if row.TeamID != nil && row.TeamName != nil && row.TeamRole != nil {
			items[index].Teams = append(items[index].Teams, ports.TestLoginTeam{
				ID: *row.TeamID, Name: *row.TeamName, Role: *row.TeamRole,
			})
		}
	}
	return items, nil
}

func mapUser(id int64, openID, nickname string, avatarURL, realName, phoneNumber *string, status string, createdAt, updatedAt time.Time) domain.User {
	return domain.User{
		ID: id, OpenID: openID, Nickname: nickname, AvatarURL: avatarURL,
		RealName: realName, PhoneNumber: phoneNumber, Status: domain.Status(status),
		CreatedAt: createdAt, UpdatedAt: updatedAt,
	}
}
