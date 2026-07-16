package legacyteams

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type MySQLSource struct {
	database *sql.DB
}

func NewMySQLSource(database *sql.DB) MySQLSource {
	return MySQLSource{database: database}
}

func (s MySQLSource) Load(ctx context.Context) (Snapshot, error) {
	tx, err := s.database.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return Snapshot{}, fmt.Errorf("begin source transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	team, err := loadTeam(ctx, tx)
	if err != nil {
		return Snapshot{}, err
	}
	users, memberships, err := loadMembers(ctx, tx, team.ID)
	if err != nil {
		return Snapshot{}, err
	}
	if err := tx.Commit(); err != nil {
		return Snapshot{}, fmt.Errorf("finish source read: %w", err)
	}
	return Snapshot{Team: team, Users: users, Memberships: memberships}, nil
}

func loadTeam(ctx context.Context, tx *sql.Tx) (LegacyTeam, error) {
	rows, err := tx.QueryContext(ctx, `
        SELECT id,name,description,logo_url,captain_id,status,created_at,updated_at
        FROM rs_teams ORDER BY created_at,id`)
	if err != nil {
		return LegacyTeam{}, fmt.Errorf("query legacy teams: %w", err)
	}
	defer rows.Close()
	var teams []LegacyTeam
	for rows.Next() {
		var team LegacyTeam
		var description, logo sql.NullString
		var captain sql.NullInt64
		var createdAt, updatedAt sql.NullTime
		if err := rows.Scan(&team.ID, &team.Name, &description, &logo, &captain, &team.Status, &createdAt, &updatedAt); err != nil {
			return LegacyTeam{}, fmt.Errorf("scan legacy team: %w", err)
		}
		team.Description, team.LogoURL = nullString(description), nullString(logo)
		if captain.Valid {
			team.CaptainUserID = captain.Int64
		}
		team.CreatedAt, team.UpdatedAt = nullTime(createdAt), nullTime(updatedAt)
		teams = append(teams, team)
	}
	if err := rows.Err(); err != nil {
		return LegacyTeam{}, fmt.Errorf("iterate legacy teams: %w", err)
	}
	if len(teams) != 1 {
		return LegacyTeam{}, fmt.Errorf("期望旧库有 1 支球队，实际为 %d", len(teams))
	}
	return teams[0], nil
}

func loadMembers(ctx context.Context, tx *sql.Tx, teamID string) ([]LegacyUser, []LegacyMembership, error) {
	rows, err := tx.QueryContext(ctx, `
        SELECT u.id,u.open_id,u.nickname,u.avatar_url,u.real_name,u.phone_number,u.status,
               u.create_time,u.latest_login_date,
               tm.role,tm.status,tm.joined_at,tm.created_at,tm.updated_at
        FROM rs_team_members tm
        JOIN rs_user_info u ON u.id=tm.user_id
        WHERE tm.team_id=? ORDER BY tm.created_at,tm.id`, teamID)
	if err != nil {
		return nil, nil, fmt.Errorf("query legacy members: %w", err)
	}
	defer rows.Close()
	var users []LegacyUser
	var memberships []LegacyMembership
	for rows.Next() {
		var user LegacyUser
		var membership LegacyMembership
		var openID, nickname, avatar, realName, phone sql.NullString
		var userCreated, userUpdated, joined, memberCreated, memberUpdated sql.NullTime
		if err := rows.Scan(
			&user.ID, &openID, &nickname, &avatar, &realName, &phone, &user.Status,
			&userCreated, &userUpdated, &membership.Role, &membership.Status,
			&joined, &memberCreated, &memberUpdated,
		); err != nil {
			return nil, nil, fmt.Errorf("scan legacy member: %w", err)
		}
		user.OpenID, user.Nickname = strings.TrimSpace(openID.String), strings.TrimSpace(nickname.String)
		user.AvatarURL = nullString(avatar)
		user.RealName, user.PhoneNumber = strings.TrimSpace(realName.String), strings.TrimSpace(phone.String)
		user.CreatedAt, user.UpdatedAt = nullTime(userCreated), nullTime(userUpdated)
		membership.UserID = user.ID
		membership.JoinedAt, membership.CreatedAt, membership.UpdatedAt = nullTime(joined), nullTime(memberCreated), nullTime(memberUpdated)
		users = append(users, user)
		memberships = append(memberships, membership)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate legacy members: %w", err)
	}
	return users, memberships, nil
}

func nullString(value sql.NullString) *string {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil
	}
	text := strings.TrimSpace(value.String)
	return &text
}

func nullTime(value sql.NullTime) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time
}
