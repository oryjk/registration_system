package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type database interface {
	matchsqlc.DBTX
	Begin(context.Context) (pgx.Tx, error)
}

type Repository struct {
	database database
	queries  *matchsqlc.Queries
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: matchsqlc.New(database)}
}

func (r *Repository) CreateWithGroups(ctx context.Context, match domain.Match, groups []domain.RegistrationGroup) error {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	queries := r.queries.WithTx(tx)
	if _, err := queries.CreateMatch(ctx, createMatchParams(match)); err != nil {
		return err
	}
	for _, group := range groups {
		if _, err := queries.CreateRegistrationGroup(ctx, createGroupParams(group)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) FindMatch(ctx context.Context, matchID uuid.UUID) (domain.Match, bool, error) {
	row, err := r.queries.GetMatchByID(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Match{}, false, nil
	}
	if err != nil {
		return domain.Match{}, false, err
	}
	return mapMatch(row), true, nil
}

func (r *Repository) FindByID(ctx context.Context, matchID uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error) {
	row, err := r.queries.GetMatchByID(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Match{}, nil, false, nil
	}
	if err != nil {
		return domain.Match{}, nil, false, err
	}
	groupRows, err := r.queries.ListRegistrationGroupsByMatchID(ctx, pgUUID(matchID))
	if err != nil {
		return domain.Match{}, nil, false, err
	}
	groups := make([]domain.RegistrationGroup, 0, len(groupRows))
	for _, groupRow := range groupRows {
		groups = append(groups, mapGroup(groupRow))
	}
	return mapMatch(row), groups, true, nil
}

func (r *Repository) UpdateDetails(ctx context.Context, match domain.Match) error {
	_, err := r.queries.UpdateMatchDetails(ctx, matchsqlc.UpdateMatchDetailsParams{
		ID: pgUUID(match.ID), Name: match.Name, StartTime: pgTimestamp(match.StartTime), EndTime: pgTimestamp(match.EndTime),
		RegistrationStartAt: pgOptionalTimestamp(match.RegistrationStartAt), RegistrationEndAt: pgOptionalTimestamp(match.RegistrationEndAt),
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description,
	})
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, match domain.Match) error {
	_, err := r.queries.UpdateMatchStatus(ctx, matchsqlc.UpdateMatchStatusParams{ID: pgUUID(match.ID), Status: string(match.Status)})
	return err
}

// FinishUpdateStatus 条件更新：库内状态仍是非终态才写入，防止并发收尾互相覆盖。
func (r *Repository) FinishUpdateStatus(ctx context.Context, match domain.Match) (bool, error) {
	rows, err := r.queries.FinishMatchStatus(ctx, matchsqlc.FinishMatchStatusParams{ID: pgUUID(match.ID), Status: string(match.Status)})
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) (bool, error) {
	rowsAffected, err := r.queries.DeleteMatch(ctx, pgUUID(id))
	return rowsAffected > 0, err
}

func createMatchParams(match domain.Match) matchsqlc.CreateMatchParams {
	return matchsqlc.CreateMatchParams{
		ID:                  pgUUID(match.ID),
		Name:                match.Name,
		PublicationMode:     string(match.PublicationMode),
		OpponentState:       string(match.OpponentState),
		Status:              string(match.Status),
		HostTeamID:          match.HostTeamID,
		AwayTeamID:          match.AwayTeamID,
		OpponentName:        match.OpponentName,
		PlayersPerTeam:      int32(match.PlayersPerTeam),
		StartTime:           pgTimestamp(match.StartTime),
		EndTime:             pgTimestamp(match.EndTime),
		RegistrationStartAt: pgOptionalTimestamp(match.RegistrationStartAt),
		RegistrationEndAt:   pgOptionalTimestamp(match.RegistrationEndAt),
		Location:            match.Location,
		LocationLatitude:    match.LocationLatitude,
		LocationLongitude:   match.LocationLongitude,
		Description:         match.Description,
		CreatedByUserID:     match.CreatedByUserID,
		CreatedByAdminID:    match.CreatedByAdminID,
	}
}

func createGroupParams(group domain.RegistrationGroup) matchsqlc.CreateRegistrationGroupParams {
	return matchsqlc.CreateRegistrationGroupParams{
		ID:         pgUUID(group.ID),
		MatchID:    pgUUID(group.MatchID),
		Kind:       string(group.Kind),
		TeamID:     group.TeamID,
		MinPlayers: int32Pointer(group.MinPlayers),
		MaxPlayers: int32Pointer(group.MaxPlayers),
		Status:     string(group.Status),
	}
}

func mapMatch(row matchsqlc.Match) domain.Match {
	return domain.Match{
		ID:                  uuid.UUID(row.ID.Bytes),
		Name:                row.Name,
		PublicationMode:     domain.PublicationMode(row.PublicationMode),
		OpponentState:       domain.OpponentState(row.OpponentState),
		Status:              domain.MatchStatus(row.Status),
		HostTeamID:          row.HostTeamID,
		AwayTeamID:          row.AwayTeamID,
		OpponentName:        row.OpponentName,
		PlayersPerTeam:      int(row.PlayersPerTeam),
		StartTime:           row.StartTime.Time,
		EndTime:             row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt),
		RegistrationEndAt:   timestampPointer(row.RegistrationEndAt),
		Location:            row.Location,
		LocationLatitude:    row.LocationLatitude,
		LocationLongitude:   row.LocationLongitude,
		Description:         row.Description,
		IsFree:              row.IsFree,
		CreatedByUserID:     row.CreatedByUserID,
		CreatedByAdminID:    row.CreatedByAdminID,
		CreatedAt:           row.CreatedAt.Time,
		UpdatedAt:           row.UpdatedAt.Time,
	}
}

func mapGroup(row matchsqlc.MatchRegistrationGroup) domain.RegistrationGroup {
	return domain.RegistrationGroup{
		ID:          uuid.UUID(row.ID.Bytes),
		MatchID:     uuid.UUID(row.MatchID.Bytes),
		Kind:        domain.GroupKind(row.Kind),
		TeamID:      row.TeamID,
		MinPlayers:  intPointer(row.MinPlayers),
		MaxPlayers:  intPointer(row.MaxPlayers),
		Status:      domain.GroupStatus(row.Status),
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
		CancelledAt: timestampPointer(row.CancelledAt),
	}
}

func pgUUID(value uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: value, Valid: true}
}

func pgTimestamp(value time.Time) pgtype.Timestamp {
	return pgtype.Timestamp{Time: value, Valid: true}
}

func pgOptionalTimestamp(value *time.Time) pgtype.Timestamp {
	if value == nil {
		return pgtype.Timestamp{}
	}
	return pgTimestamp(*value)
}

func int32Pointer(value *int) *int32 {
	if value == nil {
		return nil
	}
	converted := int32(*value)
	return &converted
}

func intPointer(value *int32) *int {
	if value == nil {
		return nil
	}
	converted := int(*value)
	return &converted
}

func timestampPointer(value pgtype.Timestamp) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
