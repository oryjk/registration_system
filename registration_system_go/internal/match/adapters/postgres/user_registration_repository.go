package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

func (r *Repository) WithinUserRegistrationTransaction(ctx context.Context, operation func(ports.UserRegistrationTransaction) error) error {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	transaction := userRegistrationTransaction{queries: r.queries.WithTx(tx)}
	if err := operation(transaction); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type userRegistrationTransaction struct {
	queries *matchsqlc.Queries
}

func (t userRegistrationTransaction) FindMatchForUpdate(ctx context.Context, matchID uuid.UUID) (domain.Match, bool, error) {
	row, err := t.queries.GetMatchByIDForUpdate(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Match{}, false, nil
	}
	if err != nil {
		return domain.Match{}, false, err
	}
	return mapMatch(row), true, nil
}

func (t userRegistrationTransaction) FindGroupForUpdate(ctx context.Context, matchID, groupID uuid.UUID) (domain.RegistrationGroup, bool, error) {
	row, err := t.queries.GetRegistrationGroupForUpdate(ctx, matchsqlc.GetRegistrationGroupForUpdateParams{
		MatchID: pgUUID(matchID), GroupID: pgUUID(groupID),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RegistrationGroup{}, false, nil
	}
	if err != nil {
		return domain.RegistrationGroup{}, false, err
	}
	return mapGroup(row), true, nil
}

func (t userRegistrationTransaction) FindUserRegistrationForUpdate(ctx context.Context, groupID uuid.UUID, userID int64) (domain.Registration, bool, error) {
	row, err := t.queries.GetUserRegistrationForUpdate(ctx, matchsqlc.GetUserRegistrationForUpdateParams{
		GroupID: pgUUID(groupID), UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Registration{}, false, nil
	}
	if err != nil {
		return domain.Registration{}, false, err
	}
	return mapRegistration(row), true, nil
}

func (t userRegistrationTransaction) FindActiveUserRegistrationInMatchForUpdate(ctx context.Context, matchID uuid.UUID, userID int64) (domain.Registration, bool, error) {
	row, err := t.queries.GetActiveUserRegistrationInMatchForUpdate(ctx, matchsqlc.GetActiveUserRegistrationInMatchForUpdateParams{
		MatchID: pgUUID(matchID), UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Registration{}, false, nil
	}
	if err != nil {
		return domain.Registration{}, false, err
	}
	return mapRegistration(row), true, nil
}

func (t userRegistrationTransaction) CountAttendingForGroup(ctx context.Context, groupID uuid.UUID) (int, error) {
	count, err := t.queries.CountAttendingRegistrationsForGroup(ctx, pgUUID(groupID))
	return int(count), err
}

func (t userRegistrationTransaction) SaveRegistration(ctx context.Context, registration domain.Registration) error {
	err := t.queries.SaveUserRegistration(ctx, matchsqlc.SaveUserRegistrationParams{
		ID: pgUUID(registration.ID), GroupID: pgUUID(registration.GroupID), UserID: registration.UserID,
		Status: string(registration.Status), RegistrationCount: int32(registration.RegistrationCount),
		CreatedAt: pgTimestamp(registration.CreatedAt), UpdatedAt: pgTimestamp(registration.UpdatedAt),
		CancelledAt: pgOptionalTimestamp(registration.CancelledAt),
	})
	var postgresError *pgconn.PgError
	if !errors.As(err, &postgresError) {
		return err
	}
	switch postgresError.Code {
	case "23505":
		return ports.ErrUserRegistrationConflict
	case "23502", "23514":
		return ports.ErrUserRegistrationValidation
	default:
		return err
	}
}

func (t userRegistrationTransaction) UpdateGroup(ctx context.Context, group domain.RegistrationGroup) error {
	return t.queries.UpdateRegistrationGroupState(ctx, matchsqlc.UpdateRegistrationGroupStateParams{
		ID: pgUUID(group.ID), Status: string(group.Status), CancelledAt: pgOptionalTimestamp(group.CancelledAt), UpdatedAt: pgTimestamp(group.UpdatedAt),
	})
}

func (t userRegistrationTransaction) UpdateMatchOpponent(ctx context.Context, match domain.Match) error {
	return t.queries.UpdateMatchOpponent(ctx, matchsqlc.UpdateMatchOpponentParams{
		ID: pgUUID(match.ID), AwayTeamID: match.AwayTeamID, OpponentState: string(match.OpponentState), UpdatedAt: pgTimestamp(match.UpdatedAt),
	})
}

func mapRegistration(row matchsqlc.MatchRegistration) domain.Registration {
	return domain.Registration{
		ID: uuid.UUID(row.ID.Bytes), GroupID: uuid.UUID(row.GroupID.Bytes), UserID: row.UserID,
		Status: domain.RegistrationStatus(row.Status), RegistrationCount: int(row.RegistrationCount),
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time, CancelledAt: timestampPointer(row.CancelledAt),
	}
}

var _ ports.UserRegistrationRepository = (*Repository)(nil)
var _ ports.UserRegistrationTransaction = userRegistrationTransaction{}
