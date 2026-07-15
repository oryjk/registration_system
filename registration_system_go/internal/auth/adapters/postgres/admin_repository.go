package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	authsqlc "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type AdminRepository struct {
	queries *authsqlc.Queries
}

func NewAdminRepository(database authsqlc.DBTX) *AdminRepository {
	return &AdminRepository{queries: authsqlc.New(database)}
}

func (r *AdminRepository) FindByUsername(ctx context.Context, username string) (domain.Admin, bool, error) {
	row, err := r.queries.GetAdminByUsername(ctx, username)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Admin{}, false, nil
	}
	if err != nil {
		return domain.Admin{}, false, err
	}
	return mapAdmin(row), true, nil
}

func (r *AdminRepository) FindByID(ctx context.Context, id int64) (domain.Admin, bool, error) {
	row, err := r.queries.GetAdminByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Admin{}, false, nil
	}
	if err != nil {
		return domain.Admin{}, false, err
	}
	return mapAdmin(row), true, nil
}

func (r *AdminRepository) Count(ctx context.Context) (int64, error) {
	return r.queries.CountAdmins(ctx)
}

func (r *AdminRepository) List(ctx context.Context) ([]domain.Admin, error) {
	rows, err := r.queries.ListAdmins(ctx)
	if err != nil {
		return nil, err
	}
	admins := make([]domain.Admin, 0, len(rows))
	for _, row := range rows {
		admins = append(admins, mapAdmin(row))
	}
	return admins, nil
}

func (r *AdminRepository) Create(ctx context.Context, admin domain.Admin) (domain.Admin, error) {
	row, err := r.queries.CreateAdmin(ctx, authsqlc.CreateAdminParams{
		Username: admin.Username, PasswordHash: admin.PasswordHash, Role: string(admin.Role), Status: string(admin.Status),
	})
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23505" {
			return domain.Admin{}, sharederror.ErrConflict
		}
		return domain.Admin{}, err
	}
	return mapAdmin(row), nil
}

func mapAdmin(row authsqlc.AdminUser) domain.Admin {
	return domain.Admin{
		ID: row.ID, Username: row.Username, PasswordHash: row.PasswordHash,
		Role: domain.AdminRole(row.Role), Status: domain.AdminStatus(row.Status),
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}
