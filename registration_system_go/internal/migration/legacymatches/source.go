package legacymatches

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

// pendingTeamName 是对手为“待定”的历史比赛在目标库使用的占位客队名。
const pendingTeamName = "待定"

// legacyWallClockLocation 是旧库无时区时间列的实际语义：国内服务器写入的
// Asia/Shanghai 墙钟。中国无夏令时，用固定 +8 偏移即可，且不依赖二进制内的 tzdata。
var legacyWallClockLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

// toUTCMoment 把 pgx 从 TIMESTAMP（without time zone）列扫出的墙钟 time.Time
// 按 Asia/Shanghai 解释并换算成 UTC 时刻——目标库 matches 时间列统一存 UTC 墙钟，
// 若不转换，上海墙钟会被当成 UTC 落库，整体偏大 8 小时。
func toUTCMoment(wallClock time.Time) time.Time {
	if wallClock.IsZero() {
		return wallClock
	}
	return time.Date(
		wallClock.Year(), wallClock.Month(), wallClock.Day(),
		wallClock.Hour(), wallClock.Minute(), wallClock.Second(), wallClock.Nanosecond(),
		legacyWallClockLocation,
	).UTC()
}

func toUTCMomentPtr(wallClock *time.Time) *time.Time {
	if wallClock == nil || wallClock.IsZero() {
		return wallClock
	}
	converted := toUTCMoment(*wallClock)
	return &converted
}

// PostgresSource 从旧库（Rust 自身 PostgreSQL）只读加载球队 1 的历史比赛与报名。
// 使用 RepeatableRead 事务保证快照一致；仅查询，不写入。
type PostgresSource struct {
	source sourcePool
	teamID int64
}

type sourcePool interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewPostgresSource(source sourcePool, teamID int64) PostgresSource {
	return PostgresSource{source: source, teamID: teamID}
}

func (s PostgresSource) Load(ctx context.Context, options LoadOptions) (Snapshot, error) {
	tx, err := s.source.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return Snapshot{}, fmt.Errorf("begin source transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	matches, err := loadMatches(ctx, tx, s.teamID, options)
	if err != nil {
		return Snapshot{}, err
	}
	matchSourceIDs := make([]string, 0, len(matches))
	for _, match := range matches {
		// rs_activity.id 是 CHAR(36)，读出来带填充空格；统一 trim，
		// 否则报名表里变长存储的 activity_id（'7'、短 UUID 等）会匹配不上。
		matchSourceIDs = append(matchSourceIDs, strings.TrimSpace(match.SourceID))
	}
	users, registrations, err := loadRegistrations(ctx, tx, matchSourceIDs)
	if err != nil {
		return Snapshot{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Snapshot{}, fmt.Errorf("finish source read: %w", err)
	}
	return Snapshot{Matches: matches, Users: users, Registrations: registrations}, nil
}

func loadMatches(ctx context.Context, tx pgx.Tx, teamID int64, options LoadOptions) ([]LegacyMatch, error) {
	rows, err := tx.Query(ctx, `
        SELECT id, name, COALESCE(opposing,''), status, COALESCE(players_per_team,0),
               holding_date, start_time, end_time, location, location_latitude, location_longitude,
               description, created_at, updated_at, COALESCE(home_team_id,0), team_capacity_limit
	        FROM rs_activity
	        WHERE (home_team_id=$1 OR away_team_id=$1)
	          AND (
	              $4::boolean
	              OR
	              btrim(id) = ANY($2::text[])
	              OR (status IN (0,1) AND ($3::timestamptz IS NULL OR updated_at >= $3))
	          )
	        ORDER BY created_at, id`, teamID, options.TrackedMatchSourceIDs, options.Since, options.Mode == mapping.ModeFull)
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
			&match.HoldingDate, &match.RegistrationStartAt, &match.RegistrationEndAt,
			&match.Location, &match.Latitude, &match.Longitude,
			&description, &match.CreatedAt, &match.UpdatedAt, &match.HomeTeamSourceID, &match.HostCapacityLimit,
		); err != nil {
			return nil, fmt.Errorf("scan legacy activity: %w", err)
		}
		match.Description = description
		// 比赛时间与报名窗口按上海墙钟解释统一换算成 UTC 时刻；
		// created_at/updated_at 是审计字段，维持旧值不做换算。
		match.HoldingDate = toUTCMoment(match.HoldingDate)
		match.RegistrationStartAt = toUTCMomentPtr(match.RegistrationStartAt)
		match.RegistrationEndAt = toUTCMomentPtr(match.RegistrationEndAt)
		matches = append(matches, match)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate legacy activities: %w", err)
	}
	return matches, nil
}

func loadRegistrations(ctx context.Context, tx pgx.Tx, matchSourceIDs []string) ([]LegacyUser, []LegacyRegistration, error) {
	if len(matchSourceIDs) == 0 {
		return nil, nil, nil
	}
	rows, err := tx.Query(ctx, `
        SELECT ua.activity_id, u.id, u.open_id, u.nickname, u.real_name,
               u.avatar_url, u.phone_number, u.status,
               ua.stand, ua.registration_count,
               ua.operation_time, ua.created_at, ua.updated_at
        FROM rs_user_activity ua
        JOIN rs_user_info u ON u.id = ua.user_id
        WHERE btrim(ua.activity_id) = ANY($1::text[])
        ORDER BY ua.created_at, ua.id`, matchSourceIDs)
	if err != nil {
		return nil, nil, fmt.Errorf("query legacy registrations: %w", err)
	}
	defer rows.Close()
	usersByID := make(map[int64]LegacyUser)
	var registrations []LegacyRegistration
	for rows.Next() {
		var registration LegacyRegistration
		var user LegacyUser
		if err := rows.Scan(
			&registration.ActivitySourceID, &user.SourceID, &user.OpenID, &user.Nickname,
			&user.RealName, &user.AvatarURL, &user.PhoneNumber, &user.Status,
			&registration.Stand,
			&registration.RegistrationCount, &registration.OperationTime,
			&registration.CreatedAt, &registration.UpdatedAt,
		); err != nil {
			return nil, nil, fmt.Errorf("scan legacy registration: %w", err)
		}
		registration.UserSourceID = user.SourceID
		registration.OpenID = user.OpenID
		user.UpdatedAt = registration.UpdatedAt
		if current, exists := usersByID[user.SourceID]; !exists || current.UpdatedAt.Before(user.UpdatedAt) {
			usersByID[user.SourceID] = user
		}
		registrations = append(registrations, registration)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterate legacy registrations: %w", err)
	}
	userIDs := make([]int64, 0, len(usersByID))
	for id := range usersByID {
		userIDs = append(userIDs, id)
	}
	sort.Slice(userIDs, func(left, right int) bool { return userIDs[left] < userIDs[right] })
	users := make([]LegacyUser, 0, len(userIDs))
	for _, id := range userIDs {
		users = append(users, usersByID[id])
	}
	return users, registrations, nil
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
