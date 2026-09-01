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
	database database
	queries  *teamsqlc.Queries
}

type database interface {
	teamsqlc.DBTX
	Begin(context.Context) (pgx.Tx, error)
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: teamsqlc.New(database)}
}

func (r *Repository) FindByID(ctx context.Context, teamID int64) (domain.Team, bool, error) {
	row, err := r.queries.GetTeamByID(ctx, teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Team{}, false, nil
	}
	if err != nil {
		return domain.Team{}, false, err
	}
	return teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt), true, nil
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
	return teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt), nil
}

func (r *Repository) Update(ctx context.Context, team domain.Team) (domain.Team, error) {
	row, err := r.queries.UpdateTeam(ctx, teamsqlc.UpdateTeamParams{
		ID: team.ID, Name: team.Name, Description: team.Description, Status: string(team.Status),
	})
	if err != nil {
		return domain.Team{}, err
	}
	return teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt), nil
}

// UpdateTeamProfile 只更新球队资料（name/description/logo_url），不触碰 status。
func (r *Repository) UpdateTeamProfile(ctx context.Context, team domain.Team) (domain.Team, error) {
	row, err := r.queries.UpdateTeamProfile(ctx, teamsqlc.UpdateTeamProfileParams{
		ID: team.ID, Name: team.Name, Description: team.Description, LogoUrl: team.LogoURL,
	})
	if err != nil {
		return domain.Team{}, err
	}
	return teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt), nil
}

func (r *Repository) ActiveUserExists(ctx context.Context, userID int64) (bool, error) {
	return r.queries.ActiveUserExists(ctx, userID)
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

func (r *Repository) Dissolve(ctx context.Context, teamID int64) (bool, error) {
	rowsAffected, err := r.queries.DissolveTeam(ctx, teamID)
	if err != nil {
		return false, err
	}
	return rowsAffected > 0, nil
}

func (r *Repository) FindDissolveBlockers(ctx context.Context, teamID int64) (domain.DissolveBlockers, error) {
	matchRows, err := r.queries.FindDissolveBlockingMatches(ctx, &teamID)
	if err != nil {
		return domain.DissolveBlockers{}, err
	}
	applicationRows, err := r.queries.FindDissolveBlockingApplications(ctx, teamID)
	if err != nil {
		return domain.DissolveBlockers{}, err
	}
	blockers := domain.DissolveBlockers{
		Matches:      make([]domain.DissolveBlockerMatch, 0, len(matchRows)),
		Applications: make([]domain.DissolveBlockerApplication, 0, len(applicationRows)),
	}
	for _, row := range matchRows {
		blockers.Matches = append(blockers.Matches, domain.DissolveBlockerMatch{
			ID:     uuid.UUID(row.ID.Bytes),
			Name:   row.Name,
			Status: row.Status,
			IsHost: row.IsHost,
		})
	}
	for _, row := range applicationRows {
		blockers.Applications = append(blockers.Applications, domain.DissolveBlockerApplication{
			ID:        uuid.UUID(row.ID.Bytes),
			MatchID:   uuid.UUID(row.MatchID.Bytes),
			MatchName: row.MatchName,
			Status:    row.Status,
		})
	}
	return blockers, nil
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
			BalanceCents: row.BalanceCents,
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

// RemoveMember 硬删成员行，并在同一事务内取消其在本队未开始比赛中的球队组报名
// （进行中/已完赛/已取消比赛与已支付报名保留，见 CancelMemberUpcomingTeamRegistrations）。
func (r *Repository) RemoveMember(ctx context.Context, teamID, userID int64) (bool, error) {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	queries := r.queries.WithTx(tx)
	rowsAffected, err := queries.RemoveTeamMember(ctx, teamsqlc.RemoveTeamMemberParams{TeamID: teamID, UserID: userID})
	if err != nil {
		return false, err
	}
	if rowsAffected == 0 {
		return false, nil
	}
	if _, err := queries.CancelMemberUpcomingTeamRegistrations(ctx, teamsqlc.CancelMemberUpcomingTeamRegistrationsParams{
		TeamID: teamID, UserID: userID,
	}); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
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

func teamFields(id int64, name string, description, logoURL *string, captainID *int64, status string, createdAt, updatedAt pgtype.Timestamp) domain.Team {
	return domain.Team{
		ID:          id,
		Name:        name,
		Description: description,
		LogoURL:     logoURL,
		CaptainID:   captainID,
		Status:      domain.TeamStatus(status),
		CreatedAt:   createdAt.Time,
		UpdatedAt:   updatedAt.Time,
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
	teamIDParam := teamID
	rows, err := r.queries.ListTeamMemberAttendanceRecords(ctx, teamsqlc.ListTeamMemberAttendanceRecordsParams{
		TeamID: &teamIDParam, UserID: userID, StartDate: pgDate(startDate), EndDate: pgDate(endDate),
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
			OperationTime: operationTime, Registered: boolRegistered(row.Registered),
		})
	}
	return records, nil
}

func (r *Repository) ListAttendanceRanking(ctx context.Context, teamID int64, startDate, endDate *time.Time) ([]ports.AttendanceRankingItem, error) {
	teamIDParam := teamID
	rows, err := r.queries.ListTeamAttendanceRanking(ctx, teamsqlc.ListTeamAttendanceRankingParams{
		TeamID: teamIDParam, StartDate: pgDate(startDate), EndDate: pgDate(endDate),
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
	teamIDParam := teamID
	rows, err := r.queries.ListTeamMatchAttendance(ctx, teamsqlc.ListTeamMatchAttendanceParams{
		TeamID: &teamIDParam, MatchID: pgTeamUUID(matchID),
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
			OperationTime: operationTime, Registered: boolRegistered(row.Registered),
		})
	}
	return header, members, true, nil
}

func boolRegistered(value any) bool {
	if value == nil {
		return false
	}
	if typed, ok := value.(bool); ok {
		return typed
	}
	return false
}

// GetTeamMembershipState 查询球队会员状态与 userID 在该球队的个人账户余额。
func (r *Repository) GetTeamMembershipState(ctx context.Context, teamID, userID int64) (ports.AppMembershipState, error) {
	row, err := r.queries.GetTeamMembershipState(ctx, teamsqlc.GetTeamMembershipStateParams{ID: teamID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.AppMembershipState{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if err != nil {
		return ports.AppMembershipState{}, err
	}
	state := ports.AppMembershipState{CreditScore: int(row.CreditScore), BalanceCents: row.MyBalanceCents}
	if row.VipUntil.Valid {
		vipUntil := row.VipUntil.Time
		state.VipUntil = &vipUntil
	}
	return state, nil
}

// TeamNameExists 检查球队名称是否已被占用（精确匹配，忽略前后空白由调用方保证）。
func (r *Repository) TeamNameExists(ctx context.Context, name string) (bool, error) {
	_, err := r.queries.FindTeamByName(ctx, name)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// CreateWithCaptain 原子创建球队并把创建者写入 captain 成员。
func (r *Repository) CreateWithCaptain(ctx context.Context, name string, description, joinPasswordHash *string, captainID int64) (domain.Team, error) {
	tx, err := r.database.Begin(ctx)
	if err != nil {
		return domain.Team{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	queries := r.queries.WithTx(tx)
	row, err := queries.CreateTeamWithCaptain(ctx, teamsqlc.CreateTeamWithCaptainParams{
		Name: name, Description: description, JoinPasswordHash: joinPasswordHash, CaptainID: &captainID,
	})
	if err != nil {
		return domain.Team{}, err
	}
	if _, err := queries.AddTeamMember(ctx, teamsqlc.AddTeamMemberParams{
		TeamID: row.ID, UserID: captainID, Role: string(domain.RoleCaptain),
	}); err != nil {
		return domain.Team{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Team{}, err
	}
	return teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt), nil
}

// SearchByKeyword 用户侧球队搜索：仅 active 球队，空关键字返回全部（上限 50）。
func (r *Repository) SearchByKeyword(ctx context.Context, keyword string) ([]ports.AppTeamSummary, error) {
	rows, err := r.queries.SearchActiveTeamsByKeyword(ctx, keyword)
	if err != nil {
		return nil, err
	}
	items := make([]ports.AppTeamSummary, 0, len(rows))
	for _, row := range rows {
		summary := ports.AppTeamSummary{
			Team:        teamFields(row.ID, row.Name, row.Description, row.LogoUrl, row.CaptainID, row.Status, row.CreatedAt, row.UpdatedAt),
			MemberCount: row.MemberCount,
			CreditScore: int(row.CreditScore),
		}
		if row.VipUntil.Valid {
			vipUntil := row.VipUntil.Time
			summary.VipUntil = &vipUntil
		}
		items = append(items, summary)
	}
	return items, nil
}

// FindJoinPasswordHash 返回入队口令哈希；球队不存在时第二个返回值为 false。
func (r *Repository) FindJoinPasswordHash(ctx context.Context, teamID int64) (*string, bool, error) {
	hash, err := r.queries.GetTeamJoinPasswordHash(ctx, teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return hash, true, nil
}

// UpdateJoinPasswordHash 更新入队口令哈希（nil 表示清除）；球队不存在时第二个返回值为 false。
func (r *Repository) UpdateJoinPasswordHash(ctx context.Context, teamID int64, hash *string) (bool, error) {
	_, err := r.queries.UpdateTeamJoinPasswordHash(ctx, teamsqlc.UpdateTeamJoinPasswordHashParams{
		ID: teamID, JoinPasswordHash: hash,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// ReactivateMember 把历史 inactive 成员恢复为 active 普通队员。
func (r *Repository) FindUserNickname(ctx context.Context, userID int64) (string, bool, error) {
	nickname, err := r.queries.GetUserNickname(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return nickname, true, nil
}

func (r *Repository) LeaveMember(ctx context.Context, teamID, userID int64) (bool, error) {
	rowsAffected, err := r.queries.LeaveTeamMember(ctx, teamsqlc.LeaveTeamMemberParams{TeamID: teamID, UserID: userID})
	return rowsAffected > 0, err
}

func (r *Repository) ReactivateMember(ctx context.Context, teamID, userID int64) (bool, error) {
	rows, err := r.queries.ReactivateTeamMember(ctx, teamsqlc.ReactivateTeamMemberParams{TeamID: teamID, UserID: userID})
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}
