package legacymatches

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pendingTeamName 是对手为“待定”的历史比赛在目标库使用的占位客队名。
const pendingTeamName = "待定"

// PostgresSource 从旧库（Rust 自身 PostgreSQL）只读加载球队 1 的历史比赛与报名。
// 使用 RepeatableRead 事务保证快照一致；仅查询，不写入。
type PostgresSource struct {
	source *pgxpool.Pool
	teamID int64
}

func NewPostgresSource(source *pgxpool.Pool, teamID int64) PostgresSource {
	return PostgresSource{source: source, teamID: teamID}
}

func (s PostgresSource) Load(ctx context.Context) (Snapshot, error) {
	tx, err := s.source.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return Snapshot{}, fmt.Errorf("begin source transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	matches, err := loadMatches(ctx, tx, s.teamID)
	if err != nil {
		return Snapshot{}, err
	}
	registrations, err := loadRegistrations(ctx, tx, s.teamID)
	if err != nil {
		return Snapshot{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Snapshot{}, fmt.Errorf("finish source read: %w", err)
	}
	return Snapshot{Matches: matches, Registrations: registrations}, nil
}

func loadMatches(ctx context.Context, tx pgx.Tx, teamID int64) ([]LegacyMatch, error) {
	rows, err := tx.Query(ctx, `
        SELECT id, name, COALESCE(opposing,''), status, COALESCE(players_per_team,0),
               start_time, end_time, location, location_latitude, location_longitude,
               description, created_at, updated_at, COALESCE(home_team_id,0)
        FROM rs_activity
        WHERE home_team_id=$1 OR away_team_id=$1
        ORDER BY created_at, id`, teamID)
	if err != nil {
		return nil, fmt.Errorf("query legacy activities: %w", err)
	}
	defer rows.Close()
	var matches []LegacyMatch
	for rows.Next() {
		var match LegacyMatch
		var description *string
		if err := rows.Scan(
			&match.SourceID, &match.Name, &match.Opposing, &match.Status, &match.PlayersPerTeam,
			&match.StartTime, &match.EndTime, &match.Location, &match.Latitude, &match.Longitude,
			&description, &match.CreatedAt, &match.UpdatedAt, &match.HomeTeamSourceID,
		); err != nil {
			return nil, fmt.Errorf("scan legacy activity: %w", err)
		}
		match.Description = description
		matches = append(matches, match)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate legacy activities: %w", err)
	}
	return matches, nil
}

func loadRegistrations(ctx context.Context, tx pgx.Tx, teamID int64) ([]LegacyRegistration, error) {
	rows, err := tx.Query(ctx, `
        SELECT ua.activity_id, u.open_id, ua.stand, ua.registration_count,
               ua.operation_time, ua.created_at, ua.updated_at
        FROM rs_user_activity ua
        JOIN rs_activity a ON a.id = ua.activity_id
        JOIN rs_user_info u ON u.id = ua.user_id
        WHERE a.home_team_id=$1 OR a.away_team_id=$1
        ORDER BY ua.created_at, ua.id`, teamID)
	if err != nil {
		return nil, fmt.Errorf("query legacy registrations: %w", err)
	}
	defer rows.Close()
	var registrations []LegacyRegistration
	for rows.Next() {
		var registration LegacyRegistration
		if err := rows.Scan(
			&registration.ActivitySourceID, &registration.OpenID, &registration.Stand,
			&registration.RegistrationCount, &registration.OperationTime,
			&registration.CreatedAt, &registration.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan legacy registration: %w", err)
		}
		registrations = append(registrations, registration)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate legacy registrations: %w", err)
	}
	return registrations, nil
}

// normalizedTimes 兜底零值时间，保证目标 created_at/updated_at 非空。
func normalizedTimes(first, second time.Time) (time.Time, time.Time) {
	now := time.Now().UTC()
	if first.IsZero() {
		first = now
	}
	if second.IsZero() {
		second = first
	}
	return first, second
}
