package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

func (r *Repository) FindForUser(ctx context.Context, matchID uuid.UUID, userID int64) (ports.MatchItem, []ports.UserGroupState, bool, error) {
	row, err := r.queries.GetMatchForAdmin(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.MatchItem{}, nil, false, nil
	}
	if err != nil {
		return ports.MatchItem{}, nil, false, err
	}
	groupRows, err := r.queries.ListRegistrationGroupStatesForUser(ctx, matchsqlc.ListRegistrationGroupStatesForUserParams{
		MatchID: pgUUID(matchID), UserID: userID,
	})
	if err != nil {
		return ports.MatchItem{}, nil, false, err
	}
	groups := make([]ports.UserGroupState, 0, len(groupRows))
	for _, groupRow := range groupRows {
		state := ports.UserGroupState{
			Group: domain.RegistrationGroup{
				ID: uuid.UUID(groupRow.ID.Bytes), MatchID: uuid.UUID(groupRow.MatchID.Bytes),
				Kind: domain.GroupKind(groupRow.Kind), TeamID: groupRow.TeamID,
				MinPlayers: intPointer(groupRow.MinPlayers), MaxPlayers: intPointer(groupRow.MaxPlayers),
				Status: domain.GroupStatus(groupRow.Status), CreatedAt: groupRow.CreatedAt.Time,
				UpdatedAt: groupRow.UpdatedAt.Time, CancelledAt: timestampPointer(groupRow.CancelledAt),
			},
			AttendingCount: int(groupRow.AttendingCount),
		}
		if groupRow.MyRegistrationID.Valid && groupRow.MyRegistrationStatus != nil && groupRow.MyRegistrationCount != nil {
			state.MyRegistration = &domain.Registration{
				ID: uuid.UUID(groupRow.MyRegistrationID.Bytes), GroupID: uuid.UUID(groupRow.ID.Bytes), UserID: userID,
				Status: domain.RegistrationStatus(*groupRow.MyRegistrationStatus), RegistrationCount: int(*groupRow.MyRegistrationCount),
				CreatedAt: groupRow.MyRegistrationCreatedAt.Time, UpdatedAt: groupRow.MyRegistrationUpdatedAt.Time,
				CancelledAt: timestampPointer(groupRow.MyRegistrationCancelledAt),
			}
		}
		groups = append(groups, state)
	}
	return ports.MatchItem{
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

func (r *Repository) ListForUser(ctx context.Context, filter ports.MatchListFilter) ([]ports.MatchItem, error) {
	return r.ListForAdmin(ctx, filter)
}

func (r *Repository) CountForUser(ctx context.Context, filter ports.MatchListFilter) (int64, error) {
	return r.CountForAdmin(ctx, filter)
}

func (r *Repository) ListHomeActionItems(ctx context.Context, userID int64, limit int) ([]ports.HomeMatchItem, error) {
	rows, err := r.queries.ListHomeActionMatchesForUser(ctx, matchsqlc.ListHomeActionMatchesForUserParams{
		UserID: userID, LimitCount: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.HomeMatchItem, 0, len(rows))
	for _, row := range rows {
		group := ports.UserGroupState{
			Group: domain.RegistrationGroup{
				ID: uuid.UUID(row.GroupID.Bytes), MatchID: uuid.UUID(row.ID.Bytes),
				Kind: domain.GroupKind(row.GroupKind), TeamID: row.GroupTeamID,
				MinPlayers: intPointer(row.GroupMinPlayers), MaxPlayers: intPointer(row.GroupMaxPlayers),
				Status: domain.GroupStatus(row.GroupStatus), CreatedAt: row.GroupCreatedAt.Time,
				UpdatedAt: row.GroupUpdatedAt.Time, CancelledAt: timestampPointer(row.GroupCancelledAt),
			},
			AttendingCount: int(row.AttendingCount),
		}
		if row.MyRegistrationID.Valid && row.MyRegistrationStatus != nil && row.MyRegistrationCount != nil {
			group.MyRegistration = &domain.Registration{
				ID: uuid.UUID(row.MyRegistrationID.Bytes), GroupID: uuid.UUID(row.GroupID.Bytes), UserID: userID,
				Status: domain.RegistrationStatus(*row.MyRegistrationStatus), RegistrationCount: int(*row.MyRegistrationCount),
				CreatedAt: row.MyRegistrationCreatedAt.Time, UpdatedAt: row.MyRegistrationUpdatedAt.Time,
				CancelledAt: timestampPointer(row.MyRegistrationCancelledAt),
			}
		}
		items = append(items, ports.HomeMatchItem{
			Item: ports.MatchItem{
				Match: mapHomeActionMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
			},
			Group: group,
		})
	}
	return items, nil
}

func (r *Repository) ListHomeEndedItems(ctx context.Context, userID int64, limit int) ([]ports.MatchItem, error) {
	rows, err := r.queries.ListHomeEndedMatchesForUser(ctx, matchsqlc.ListHomeEndedMatchesForUserParams{
		UserID: userID, LimitCount: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.MatchItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.MatchItem{
			Match: mapHomeEndedMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
		})
	}
	return items, nil
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

func mapHomeActionMatch(row matchsqlc.ListHomeActionMatchesForUserRow) domain.Match {
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

func mapHomeEndedMatch(row matchsqlc.ListHomeEndedMatchesForUserRow) domain.Match {
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
