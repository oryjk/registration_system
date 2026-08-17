package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamsqlc "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
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

func (r *Repository) FindMembership(ctx context.Context, teamID, userID int64) (domain.Member, bool, error) {
	row, err := r.queries.FindTeamMembership(ctx, teamsqlc.FindTeamMembershipParams{TeamID: teamID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Member{}, false, nil
	}
	if err != nil {
		return domain.Member{}, false, err
	}
	return domain.Member{
		ID: row.ID, TeamID: row.TeamID, UserID: row.UserID,
		Role: domain.Role(row.Role), Status: domain.MemberStatus(row.Status), JoinedAt: row.JoinedAt.Time,
	}, true, nil
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

func (r *Repository) List(ctx context.Context, status *domain.TeamStatus) ([]domain.Team, error) {
	var value *string
	if status != nil {
		statusValue := string(*status)
		value = &statusValue
	}
	rows, err := r.queries.ListTeams(ctx, value)
	if err != nil {
		return nil, err
	}
	items := make([]domain.Team, 0, len(rows))
	for _, row := range rows {
		team := domain.Team{
			ID:          row.ID,
			Name:        row.Name,
			Description: row.Description,
			LogoURL:     row.LogoUrl,
			CaptainID:   row.CaptainID,
			Status:      domain.TeamStatus(row.Status),
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		}
		if row.CaptainID != nil && row.CaptainNickname != nil {
			team.Captain = &domain.CaptainSummary{
				UserID:    *row.CaptainID,
				Nickname:  *row.CaptainNickname,
				AvatarURL: row.CaptainAvatarUrl,
				RealName:  row.CaptainRealName,
			}
		}
		items = append(items, team)
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

func (r *Repository) Update(ctx context.Context, team domain.Team) (domain.Team, error) {
	row, err := r.queries.UpdateTeam(ctx, teamsqlc.UpdateTeamParams{
		ID: team.ID, Name: team.Name, Description: team.Description, Status: string(team.Status),
	})
	if err != nil {
		return domain.Team{}, err
	}
	return mapTeam(row), nil
}

func (r *Repository) Delete(ctx context.Context, teamID int64) (bool, error) {
	rowsAffected, err := r.queries.DeleteTeam(ctx, teamID)
	if err != nil {
		var postgresError *pgconn.PgError
		if errors.As(err, &postgresError) && postgresError.Code == "23503" {
			return false, sharederror.ErrConflict
		}
		return false, err
	}
	return rowsAffected > 0, nil
}

func (r *Repository) ListMembers(ctx context.Context, teamID int64) ([]domain.MemberDetails, error) {
	rows, err := r.queries.ListTeamMembers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	items := make([]domain.MemberDetails, 0, len(rows))
	for _, row := range rows {
		items = append(items, domain.MemberDetails{
			Member: domain.Member{
				ID: row.ID, TeamID: row.TeamID, UserID: row.UserID,
				Role: domain.Role(row.Role), Status: domain.MemberStatus(row.Status), JoinedAt: row.JoinedAt.Time,
			},
			Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			RealName: row.RealName, PhoneNumber: row.PhoneNumber,
		})
	}
	return items, nil
}

func (r *Repository) ListAppMembers(ctx context.Context, teamID int64) ([]ports.AppMember, error) {
	rows, err := r.queries.ListAppTeamMembers(ctx, teamID)
	if err != nil {
		return nil, err
	}
	items := make([]ports.AppMember, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.AppMember{
			UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			RealName: row.RealName, Role: domain.Role(row.Role), Status: domain.MemberStatus(row.Status),
			JoinedAt: row.JoinedAt.Time,
		})
	}
	return items, nil
}

func (r *Repository) ListMemberCandidates(ctx context.Context, teamID int64, search string, limit int) ([]domain.MemberCandidate, error) {
	rows, err := r.queries.ListTeamMemberCandidates(ctx, teamsqlc.ListTeamMemberCandidatesParams{
		TeamID: teamID, Search: search, Limit: int32(limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]domain.MemberCandidate, 0, len(rows))
	for _, row := range rows {
		items = append(items, domain.MemberCandidate{
			UserID: row.ID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			RealName: row.RealName, PhoneNumber: row.PhoneNumber,
		})
	}
	return items, nil
}

func (r *Repository) AddMember(ctx context.Context, teamID, userID int64, role domain.Role) error {
	_, err := r.queries.AddTeamMember(ctx, teamsqlc.AddTeamMemberParams{TeamID: teamID, UserID: userID, Role: string(role)})
	if err == nil {
		return nil
	}
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) {
		switch postgresError.Code {
		case "23505":
			return ports.ErrMemberAlreadyExists
		case "23503":
			return ports.ErrUserNotFound
		}
	}
	return err
}

func (r *Repository) UpdateMember(ctx context.Context, teamID, userID int64, role domain.Role, status domain.MemberStatus) (bool, error) {
	rowsAffected, err := r.queries.UpdateTeamMember(ctx, teamsqlc.UpdateTeamMemberParams{
		TeamID: teamID, UserID: userID, Role: string(role), Status: string(status),
	})
	return rowsAffected > 0, err
}

func (r *Repository) RemoveMember(ctx context.Context, teamID, userID int64) (bool, error) {
	rowsAffected, err := r.queries.RemoveTeamMember(ctx, teamsqlc.RemoveTeamMemberParams{TeamID: teamID, UserID: userID})
	return rowsAffected > 0, err
}

func (r *Repository) SetCaptain(ctx context.Context, teamID int64, userID *int64) error {
	var err error
	if userID == nil {
		_, err = r.queries.ClearTeamCaptain(ctx, teamID)
	} else {
		_, err = r.queries.SetTeamCaptain(ctx, teamsqlc.SetTeamCaptainParams{ID: teamID, UserID: *userID})
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.ErrMemberNotFound
	}
	return err
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

func pgTeamUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgDate(value *time.Time) pgtype.Date {
	if value == nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: *value, Valid: true}
}

func (r *Repository) ListMemberAttendanceRecords(ctx context.Context, teamID, userID int64, startDate, endDate *time.Time) ([]ports.AttendanceRecord, error) {
	rows, err := r.queries.ListTeamMemberAttendanceRecords(ctx, teamsqlc.ListTeamMemberAttendanceRecordsParams{
		TeamID: teamID, UserID: userID, StartDate: pgDate(startDate), EndDate: pgDate(endDate),
	})
	if err != nil {
		return nil, err
	}
	records := make([]ports.AttendanceRecord, 0, len(rows))
	for _, row := range rows {
		var operationTime *time.Time
		if row.OperationTime.Valid {
			operationTime = &row.OperationTime.Time
		}
		records = append(records, ports.AttendanceRecord{
			ActivityID: row.ActivityID, ActivityName: row.ActivityName,
			HoldingDate: row.HoldingDate.Time, Location: row.Location,
			Stand: row.StandStatus, RegistrationCount: int(row.RegistrationCount),
			OperationTime: operationTime, Registered: row.Registered,
		})
	}
	return records, nil
}

func (r *Repository) ListAttendanceRanking(ctx context.Context, teamID int64, startDate, endDate *time.Time) ([]ports.AttendanceRankingItem, error) {
	rows, err := r.queries.ListTeamAttendanceRanking(ctx, teamsqlc.ListTeamAttendanceRankingParams{
		TeamID: teamID, StartDate: pgDate(startDate), EndDate: pgDate(endDate),
	})
	if err != nil {
		return nil, err
	}
	items := make([]ports.AttendanceRankingItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ports.AttendanceRankingItem{
			UserID: row.UserID, UserName: row.UserName, AvatarURL: row.AvatarUrl,
			TotalCount: row.TotalCount, AttendedCount: row.AttendedCount,
			LeaveCount: row.LeaveCount, LateCount: row.LateCount,
			UnregisteredCount: row.UnregisteredCount,
		})
	}
	return items, nil
}

func (r *Repository) ListMatchAttendance(ctx context.Context, teamID int64, matchID uuid.UUID) (ports.MatchAttendanceHeader, []ports.MatchAttendanceMember, bool, error) {
	rows, err := r.queries.ListTeamMatchAttendance(ctx, teamsqlc.ListTeamMatchAttendanceParams{
		TeamID: teamID, MatchID: pgTeamUUID(matchID),
	})
	if err != nil {
		return ports.MatchAttendanceHeader{}, nil, false, err
	}
	if len(rows) == 0 {
		return ports.MatchAttendanceHeader{}, nil, false, nil
	}
	header := ports.MatchAttendanceHeader{
		ActivityID: rows[0].ActivityID, ActivityName: rows[0].ActivityName,
		HoldingDate: rows[0].HoldingDate.Time, Location: rows[0].Location,
	}
	members := make([]ports.MatchAttendanceMember, 0, len(rows))
	for _, row := range rows {
		var operationTime *time.Time
		if row.OperationTime.Valid {
			operationTime = &row.OperationTime.Time
		}
		members = append(members, ports.MatchAttendanceMember{
			UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarUrl,
			Stand: row.StandStatus, RegistrationCount: int(row.RegistrationCount),
			OperationTime: operationTime, Registered: row.Registered,
		})
	}
	return header, members, true, nil
}
