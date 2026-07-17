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
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
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

func (r *Repository) CreateRegistration(ctx context.Context, registration domain.Registration) error {
	return r.queries.CreateRegistration(ctx, createRegistrationParams(registration))
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

func (r *Repository) FindForAdmin(ctx context.Context, matchID uuid.UUID) (ports.AdminMatchItem, []domain.RegistrationGroup, bool, error) {
	row, err := r.queries.GetMatchForAdmin(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.AdminMatchItem{}, nil, false, nil
	}
	if err != nil {
		return ports.AdminMatchItem{}, nil, false, err
	}
	groupRows, err := r.queries.ListRegistrationGroupsByMatchID(ctx, pgUUID(matchID))
	if err != nil {
		return ports.AdminMatchItem{}, nil, false, err
	}
	groups := make([]domain.RegistrationGroup, 0, len(groupRows))
	for _, groupRow := range groupRows {
		groups = append(groups, mapGroup(groupRow))
	}
	return ports.AdminMatchItem{
		Match: mapAdminDetailMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
	}, groups, true, nil
}

func (r *Repository) ListForAdmin(ctx context.Context, filter ports.AdminMatchFilter) ([]ports.AdminMatchItem, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	rows, err := r.queries.ListMatchesForAdmin(ctx, matchsqlc.ListMatchesForAdminParams{
		Status: status, Search: filter.Search, LimitCount: int32(filter.Limit), OffsetCount: int32(filter.Offset),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.AdminMatchItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.AdminMatchItem{
			Match: mapAdminListMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
		})
	}
	return items, nil
}

func (r *Repository) CountForAdmin(ctx context.Context, filter ports.AdminMatchFilter) (int64, error) {
	var status *string
	if filter.Status != nil {
		value := string(*filter.Status)
		status = &value
	}
	return r.queries.CountMatchesForAdmin(ctx, matchsqlc.CountMatchesForAdminParams{Status: status, Search: filter.Search})
}

func (r *Repository) UpdateDetails(ctx context.Context, match domain.Match) error {
	_, err := r.queries.UpdateMatchDetails(ctx, matchsqlc.UpdateMatchDetailsParams{
		ID: pgUUID(match.ID), Name: match.Name, StartTime: pgTimestamp(match.StartTime), EndTime: pgTimestamp(match.EndTime),
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description,
	})
	return err
}

func (r *Repository) UpdateStatus(ctx context.Context, match domain.Match) error {
	_, err := r.queries.UpdateMatchStatus(ctx, matchsqlc.UpdateMatchStatusParams{ID: pgUUID(match.ID), Status: string(match.Status)})
	return err
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) (bool, error) {
	rowsAffected, err := r.queries.DeleteMatch(ctx, pgUUID(id))
	return rowsAffected > 0, err
}

func (r *Repository) ListRosterForGroup(ctx context.Context, group domain.RegistrationGroup) ([]ports.AdminRosterEntry, error) {
	switch group.Kind {
	case domain.GroupHostTeam, domain.GroupGuestTeam:
		if group.TeamID == nil {
			return nil, nil
		}
		rows, err := r.queries.ListTeamGroupRoster(ctx, matchsqlc.ListTeamGroupRosterParams{
			GroupID: pgUUID(group.ID), TeamID: *group.TeamID,
		})
		if err != nil {
			return nil, err
		}
		entries := make([]ports.AdminRosterEntry, 0, len(rows))
		for _, row := range rows {
			role := row.MemberRole
			entries = append(entries, ports.AdminRosterEntry{
				UserID: row.UserID, Nickname: row.Nickname, RealName: row.RealName, AvatarURL: row.AvatarUrl,
				MemberRole: &role, Status: registrationStatusPointer(row.RegistrationStatus),
			})
		}
		return entries, nil
	case domain.GroupIndividualOpponent:
		rows, err := r.queries.ListIndividualGroupRegistrations(ctx, pgUUID(group.ID))
		if err != nil {
			return nil, err
		}
		entries := make([]ports.AdminRosterEntry, 0, len(rows))
		for _, row := range rows {
			status := domain.RegistrationStatus(row.RegistrationStatus)
			entries = append(entries, ports.AdminRosterEntry{
				UserID: row.UserID, Nickname: row.Nickname, RealName: row.RealName, AvatarURL: row.AvatarUrl,
				Status: &status,
			})
		}
		return entries, nil
	default:
		return nil, nil
	}
}

func registrationStatusPointer(value *string) *domain.RegistrationStatus {
	if value == nil {
		return nil
	}
	status := domain.RegistrationStatus(*value)
	return &status
}

func createMatchParams(match domain.Match) matchsqlc.CreateMatchParams {
	return matchsqlc.CreateMatchParams{
		ID:                pgUUID(match.ID),
		Name:              match.Name,
		PublicationMode:   string(match.PublicationMode),
		OpponentState:     string(match.OpponentState),
		Status:            string(match.Status),
		HostTeamID:        match.HostTeamID,
		AwayTeamID:        match.AwayTeamID,
		OpponentName:      match.OpponentName,
		PlayersPerTeam:    int32(match.PlayersPerTeam),
		StartTime:         pgTimestamp(match.StartTime),
		EndTime:           pgTimestamp(match.EndTime),
		Location:          match.Location,
		LocationLatitude:  match.LocationLatitude,
		LocationLongitude: match.LocationLongitude,
		Description:       match.Description,
		CreatedByUserID:   match.CreatedByUserID,
		CreatedByAdminID:  match.CreatedByAdminID,
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

func createRegistrationParams(registration domain.Registration) matchsqlc.CreateRegistrationParams {
	return matchsqlc.CreateRegistrationParams{
		ID:                pgUUID(registration.ID),
		GroupID:           pgUUID(registration.GroupID),
		UserID:            registration.UserID,
		Status:            string(registration.Status),
		RegistrationCount: int32(registration.RegistrationCount),
		CreatedAt:         pgTimestamp(registration.CreatedAt),
		UpdatedAt:         pgTimestamp(registration.UpdatedAt),
	}
}

func mapMatch(row matchsqlc.Match) domain.Match {
	return domain.Match{
		ID:                uuid.UUID(row.ID.Bytes),
		Name:              row.Name,
		PublicationMode:   domain.PublicationMode(row.PublicationMode),
		OpponentState:     domain.OpponentState(row.OpponentState),
		Status:            domain.MatchStatus(row.Status),
		HostTeamID:        row.HostTeamID,
		AwayTeamID:        row.AwayTeamID,
		OpponentName:      row.OpponentName,
		PlayersPerTeam:    int(row.PlayersPerTeam),
		StartTime:         row.StartTime.Time,
		EndTime:           row.EndTime.Time,
		Location:          row.Location,
		LocationLatitude:  row.LocationLatitude,
		LocationLongitude: row.LocationLongitude,
		Description:       row.Description,
		CreatedByUserID:   row.CreatedByUserID,
		CreatedByAdminID:  row.CreatedByAdminID,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

func mapAdminDetailMatch(row matchsqlc.GetMatchForAdminRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}

func mapAdminListMatch(row matchsqlc.ListMatchesForAdminRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
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
