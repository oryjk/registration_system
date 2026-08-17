package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	minireviewsqlc "github.com/oryjk/registration_system/registration_system_go/internal/minireview/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/ports"
)

type Repository struct {
	queries *minireviewsqlc.Queries
}

var _ ports.Repository = (*Repository)(nil)
var _ ports.ListerRepository = (*Repository)(nil)
var _ ports.FinderRepository = (*Repository)(nil)

func NewRepository(database minireviewsqlc.DBTX) *Repository {
	return &Repository{queries: minireviewsqlc.New(database)}
}

func (r *Repository) FindLatest(ctx context.Context, projectCode string) (*domain.MiniReviewStatus, error) {
	row, err := r.queries.GetLatestMiniReviewStatus(ctx, projectCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	status := mapStatus(row)
	return &status, nil
}

func (r *Repository) FindByProjectAndVersion(ctx context.Context, projectCode, version string) (*domain.MiniReviewStatus, error) {
	row, err := r.queries.GetMiniReviewStatusByProjectAndVersion(ctx, minireviewsqlc.GetMiniReviewStatusByProjectAndVersionParams{
		ProjectCode: projectCode, Version: version,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	status := mapStatus(row)
	return &status, nil
}

func (r *Repository) FindByID(ctx context.Context, id int64) (*domain.MiniReviewStatus, error) {
	row, err := r.queries.GetMiniReviewStatusByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	status := mapStatus(row)
	return &status, nil
}

func (r *Repository) Create(ctx context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error) {
	row, err := r.queries.CreateMiniReviewStatus(ctx, minireviewsqlc.CreateMiniReviewStatusParams{
		ProjectCode: status.ProjectCode, Version: status.Version, VersionCode: status.VersionCode,
		IsReviewing: status.IsReviewing, StatusText: status.StatusText,
	})
	if isUniqueViolation(err) {
		return domain.MiniReviewStatus{}, ports.ErrVersionConflict
	}
	if err != nil {
		return domain.MiniReviewStatus{}, err
	}
	return mapStatus(row), nil
}

func (r *Repository) UpdateStatus(ctx context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error) {
	row, err := r.queries.UpdateMiniReviewStatusState(ctx, minireviewsqlc.UpdateMiniReviewStatusStateParams{
		ID: status.ID, IsReviewing: status.IsReviewing, StatusText: status.StatusText,
		UpdatedAt: pgtype.Timestamptz{Time: status.UpdatedAt, Valid: true},
	})
	if err != nil {
		return domain.MiniReviewStatus{}, err
	}
	return mapStatus(row), nil
}

func (r *Repository) List(ctx context.Context, filter ports.StatusFilter) ([]domain.MiniReviewStatus, int64, error) {
	projectCode := optionalProjectCode(filter.ProjectCode)
	rows, err := r.queries.ListMiniReviewStatuses(ctx, minireviewsqlc.ListMiniReviewStatusesParams{
		ProjectCode: projectCode, LimitRows: int32(filter.Limit), OffsetRows: int32(filter.Offset),
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := r.queries.CountMiniReviewStatuses(ctx, projectCode)
	if err != nil {
		return nil, 0, err
	}
	items := make([]domain.MiniReviewStatus, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapStatus(row))
	}
	return items, total, nil
}

func optionalProjectCode(projectCode string) *string {
	if projectCode == "" {
		return nil
	}
	return &projectCode
}

func mapStatus(row minireviewsqlc.MiniReviewStatus) domain.MiniReviewStatus {
	return domain.MiniReviewStatus{
		ID: row.ID, ProjectCode: row.ProjectCode, Version: row.Version, VersionCode: row.VersionCode,
		IsReviewing: row.IsReviewing, StatusText: row.StatusText,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func isUniqueViolation(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505"
}
