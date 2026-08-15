package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

// 接约申请：列表查询与带行锁的申请选择事务。

func (r *Repository) ListApplications(ctx context.Context, matchID uuid.UUID) ([]ports.TeamApplicationItem, error) {
	rows, err := r.queries.ListTeamApplications(ctx, pgUUID(matchID))
	if err != nil {
		return nil, err
	}
	items := make([]ports.TeamApplicationItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.TeamApplicationItem{
			Application: mapTeamApplicationRow(
				row.ID, row.MatchID, row.ApplicantTeamID, row.Introduction, row.Status,
				row.CreatedByUserID, row.SelectedAt, row.WithdrawnAt, row.CreatedAt, row.UpdatedAt,
			),
			TeamName: row.ApplicantTeamName,
		})
	}
	return items, nil
}

func (r *Repository) ListApplicationsForManager(ctx context.Context, matchID uuid.UUID, userID int64) ([]ports.TeamApplicationItem, error) {
	rows, err := r.queries.ListTeamApplicationsForManager(ctx, matchsqlc.ListTeamApplicationsForManagerParams{
		UserID: userID, MatchID: pgUUID(matchID),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.TeamApplicationItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.TeamApplicationItem{
			Application: mapTeamApplicationRow(
				row.ID, row.MatchID, row.ApplicantTeamID, row.Introduction, row.Status,
				row.CreatedByUserID, row.SelectedAt, row.WithdrawnAt, row.CreatedAt, row.UpdatedAt,
			),
			TeamName: row.ApplicantTeamName,
		})
	}
	return items, nil
}

func (r *Repository) WithinTeamApplicationTransaction(ctx context.Context, operation func(ports.TeamApplicationTransaction) error) error {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	transaction := teamApplicationTransaction{queries: r.queries.WithTx(tx)}
	if err := operation(transaction); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type teamApplicationTransaction struct {
	queries *matchsqlc.Queries
}

func (t teamApplicationTransaction) FindMatch(ctx context.Context, matchID uuid.UUID) (domain.Match, bool, error) {
	row, err := t.queries.GetMatchByIDForUpdate(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Match{}, false, nil
	}
	if err != nil {
		return domain.Match{}, false, err
	}
	return mapMatch(row), true, nil
}

func (t teamApplicationTransaction) FindApplication(ctx context.Context, matchID, applicationID uuid.UUID) (domain.TeamApplication, bool, error) {
	row, err := t.queries.GetTeamApplicationByIDForUpdate(ctx, matchsqlc.GetTeamApplicationByIDForUpdateParams{
		MatchID: pgUUID(matchID), ID: pgUUID(applicationID),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.TeamApplication{}, false, nil
	}
	if err != nil {
		return domain.TeamApplication{}, false, err
	}
	return mapTeamApplication(row), true, nil
}

func (t teamApplicationTransaction) ListPendingApplications(ctx context.Context, matchID uuid.UUID) ([]domain.TeamApplication, error) {
	rows, err := t.queries.ListPendingTeamApplicationsForUpdate(ctx, pgUUID(matchID))
	if err != nil {
		return nil, err
	}
	items := make([]domain.TeamApplication, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapTeamApplication(row))
	}
	return items, nil
}

func (t teamApplicationTransaction) FindActiveGuestGroup(ctx context.Context, matchID uuid.UUID) (domain.RegistrationGroup, bool, error) {
	row, err := t.queries.GetActiveGuestGroupForUpdate(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RegistrationGroup{}, false, nil
	}
	if err != nil {
		return domain.RegistrationGroup{}, false, err
	}
	return mapGroup(row), true, nil
}

func (t teamApplicationTransaction) CreateApplication(ctx context.Context, application domain.TeamApplication) error {
	err := t.queries.CreateTeamApplication(ctx, matchsqlc.CreateTeamApplicationParams{
		ID: pgUUID(application.ID), MatchID: pgUUID(application.MatchID), ApplicantTeamID: application.ApplicantTeamID,
		Introduction: application.Introduction, Status: string(application.Status), CreatedByUserID: application.CreatedByUserID,
		SelectedAt: pgOptionalTimestamp(application.SelectedAt), WithdrawnAt: pgOptionalTimestamp(application.WithdrawnAt),
		CreatedAt: pgTimestamp(application.CreatedAt), UpdatedAt: pgTimestamp(application.UpdatedAt),
	})
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" {
		return ports.ErrActiveTeamApplication
	}
	return err
}

func (t teamApplicationTransaction) UpdateApplication(ctx context.Context, application domain.TeamApplication) error {
	return t.queries.UpdateTeamApplication(ctx, matchsqlc.UpdateTeamApplicationParams{
		ID: pgUUID(application.ID), Status: string(application.Status), SelectedAt: pgOptionalTimestamp(application.SelectedAt),
		WithdrawnAt: pgOptionalTimestamp(application.WithdrawnAt), UpdatedAt: pgTimestamp(application.UpdatedAt),
	})
}

func (t teamApplicationTransaction) CreateGroup(ctx context.Context, group domain.RegistrationGroup) error {
	_, err := t.queries.CreateRegistrationGroup(ctx, createGroupParams(group))
	return err
}

func (t teamApplicationTransaction) UpdateMatchOpponent(ctx context.Context, match domain.Match) error {
	return t.queries.UpdateMatchOpponent(ctx, matchsqlc.UpdateMatchOpponentParams{
		ID: pgUUID(match.ID), AwayTeamID: match.AwayTeamID, OpponentState: string(match.OpponentState), UpdatedAt: pgTimestamp(match.UpdatedAt),
	})
}

func (t teamApplicationTransaction) UpdateGroup(ctx context.Context, group domain.RegistrationGroup) error {
	return t.queries.UpdateRegistrationGroupState(ctx, matchsqlc.UpdateRegistrationGroupStateParams{
		ID: pgUUID(group.ID), Status: string(group.Status), CancelledAt: pgOptionalTimestamp(group.CancelledAt), UpdatedAt: pgTimestamp(group.UpdatedAt),
	})
}

func mapTeamApplication(row matchsqlc.MatchTeamApplication) domain.TeamApplication {
	return mapTeamApplicationRow(
		row.ID, row.MatchID, row.ApplicantTeamID, row.Introduction, row.Status,
		row.CreatedByUserID, row.SelectedAt, row.WithdrawnAt, row.CreatedAt, row.UpdatedAt,
	)
}

func mapTeamApplicationRow(
	id, matchID pgtype.UUID,
	applicantTeamID int64,
	introduction, status string,
	createdByUserID int64,
	selectedAt, withdrawnAt, createdAt, updatedAt pgtype.Timestamp,
) domain.TeamApplication {
	return domain.TeamApplication{
		ID: uuid.UUID(id.Bytes), MatchID: uuid.UUID(matchID.Bytes), ApplicantTeamID: applicantTeamID,
		Introduction: introduction, Status: domain.ApplicationStatus(status), CreatedByUserID: createdByUserID,
		SelectedAt: timestampPointer(selectedAt), WithdrawnAt: timestampPointer(withdrawnAt),
		CreatedAt: createdAt.Time, UpdatedAt: updatedAt.Time,
	}
}
