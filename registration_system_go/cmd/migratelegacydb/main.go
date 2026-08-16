// migratelegacydb 一键把 Rust 旧库数据迁移到 Go 新库，可反复执行：
//
//	重置目标库（终止连接 → DROP → CREATE）→ goose 建 schema →
//	种子（主队 + 队长，按旧库用户 ID 原样保留）→ 全量导入 → 数量校验。
//
// 任一步失败立即报错退出；校验不一致（用户/比赛/报名数量与源库不符）也报错退出，
// 保证迁移后数据准确，不允许静默缺数。
//
// 环境变量：
//
//	LEGACY_PG_URL  旧库（Rust registration_system）连接串
//	TARGET_PG_URL  新库（registration_system_go）连接串，库名必须显式写在串里
//
// 用法（在 registration_system_go 目录下）：
//
//	go run ./cmd/migratelegacydb -legacy-team-id 1 -host-team-id 11 \
//	  -host-team-name 洺悦御府 -captain-legacy-user-id 4
package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/legacymatches"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
	"github.com/pressly/goose/v3"
)

type cliOptions struct {
	legacyTeamID        int64
	hostTeamID          int64
	hostTeamName        string
	captainLegacyUserID int64
}

func main() {
	options, err := parseOptions(os.Args[1:])
	if err != nil {
		slog.Error("无效的迁移参数", "error", err)
		os.Exit(2)
	}
	if err := run(context.Background(), options); err != nil {
		slog.Error("迁移失败", "error", err)
		os.Exit(1)
	}
}

func parseOptions(args []string) (cliOptions, error) {
	flags := flag.NewFlagSet("migratelegacydb", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	legacyTeamID := flags.Int64("legacy-team-id", 1, "源库球队 ID")
	hostTeamID := flags.Int64("host-team-id", 11, "目标库主队 ID")
	hostTeamName := flags.String("host-team-name", "洺悦御府", "目标库主队名称")
	captainLegacyUserID := flags.Int64("captain-legacy-user-id", 4, "源库队长用户 ID（目标库按此 ID 原样保留）")
	if err := flags.Parse(args); err != nil {
		return cliOptions{}, err
	}
	options := cliOptions{
		legacyTeamID:        *legacyTeamID,
		hostTeamID:          *hostTeamID,
		hostTeamName:        *hostTeamName,
		captainLegacyUserID: *captainLegacyUserID,
	}
	if options.legacyTeamID <= 0 || options.hostTeamID <= 0 || options.captainLegacyUserID <= 0 {
		return cliOptions{}, fmt.Errorf("legacy-team-id / host-team-id / captain-legacy-user-id 必须为正整数")
	}
	if strings.TrimSpace(options.hostTeamName) == "" {
		return cliOptions{}, fmt.Errorf("host-team-name 不能为空")
	}
	return options, nil
}

func run(ctx context.Context, options cliOptions) error {
	legacyURL := strings.TrimSpace(os.Getenv("LEGACY_PG_URL"))
	targetURL := strings.TrimSpace(os.Getenv("TARGET_PG_URL"))
	if legacyURL == "" || targetURL == "" {
		return fmt.Errorf("需要设置 LEGACY_PG_URL 和 TARGET_PG_URL 环境变量")
	}

	legacyPool, err := pgxpool.New(ctx, legacyURL)
	if err != nil {
		return fmt.Errorf("打开旧库: %w", err)
	}
	defer legacyPool.Close()

	targetDBName, err := databaseNameOf(targetURL)
	if err != nil {
		return err
	}

	// 1. 重置目标库：终止连接 → DROP → CREATE。
	if err := resetTargetDatabase(ctx, targetURL, targetDBName); err != nil {
		return err
	}

	targetPool, err := pgxpool.New(ctx, targetURL)
	if err != nil {
		return fmt.Errorf("打开新库: %w", err)
	}
	defer targetPool.Close()

	// 2. 建表结构。
	if err := applyMigrations(targetURL); err != nil {
		return err
	}

	// 3. 种子：主队 + 队长（按旧库 ID 原样建，导入时按 openid 合并进同一行）。
	captain, err := loadLegacyCaptain(ctx, legacyPool, options.captainLegacyUserID)
	if err != nil {
		return err
	}
	if err := seedHostAndCaptain(ctx, targetPool, options, captain); err != nil {
		return err
	}

	// 4. 全量导入。
	report, err := legacymatches.NewImporter(
		targetPool, legacymatches.NewPostgresSource(legacyPool, options.legacyTeamID),
		options.hostTeamID, options.captainLegacyUserID,
	).RunWithOptions(ctx, legacymatches.RunOptions{Mode: mapping.ModeFull})
	if err != nil {
		return fmt.Errorf("导入旧数据: %w", err)
	}

	// 5. 数量校验：源/目标不一致直接失败，保证迁移结果可信。
	expected, err := countSourceRows(ctx, legacyPool, options.legacyTeamID)
	if err != nil {
		return fmt.Errorf("统计旧库数量: %w", err)
	}
	actual, err := countTargetRows(ctx, targetPool)
	if err != nil {
		return fmt.Errorf("统计新库数量: %w", err)
	}
	if mismatch := compareCounts(expected, actual); mismatch != "" {
		return fmt.Errorf("迁移后数量校验失败: %s（源=%+v 目标=%+v）", mismatch, expected, actual)
	}

	fmt.Printf(
		"migration ok: users=%d matches=%d registrations=%d | import report: users_inserted=%d users_updated=%d matches_inserted=%d registrations_inserted=%d conflicts=%d orphan_references=%d\n",
		actual.Users, actual.Matches, actual.Registrations,
		report.UsersInserted, report.UsersUpdated, report.MatchesInserted, report.RegistrationsInserted, report.Conflicts, report.OrphanReferences,
	)
	return nil
}

func databaseNameOf(targetURL string) (string, error) {
	config, err := pgx.ParseConfig(targetURL)
	if err != nil {
		return "", fmt.Errorf("解析 TARGET_PG_URL: %w", err)
	}
	if config.Database == "" {
		return "", fmt.Errorf("TARGET_PG_URL 必须显式携带目标库名")
	}
	return config.Database, nil
}

func resetTargetDatabase(ctx context.Context, targetURL, targetDBName string) error {
	adminURL := replaceDatabase(targetURL, "postgres")
	admin, err := pgxpool.New(ctx, adminURL)
	if err != nil {
		return fmt.Errorf("打开管理连接: %w", err)
	}
	defer admin.Close()

	// 有服务在连目标库时会 DROP 失败，先踢连接再重试几次。
	for attempt := 1; attempt <= 5; attempt++ {
		_, _ = admin.Exec(ctx, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, targetDBName)
		_, err := admin.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s`, pgx.Identifier{targetDBName}.Sanitize()))
		if err == nil {
			break
		}
		if attempt == 5 {
			return fmt.Errorf("drop 目标库: %w", err)
		}
		time.Sleep(time.Second)
	}
	if _, err := admin.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s`, pgx.Identifier{targetDBName}.Sanitize())); err != nil {
		return fmt.Errorf("create 目标库: %w", err)
	}
	return nil
}

func replaceDatabase(url, database string) string {
	oldConfig, err := pgx.ParseConfig(url)
	if err != nil {
		return url
	}
	marker := "/" + oldConfig.Database
	replacement := "/" + database
	// databaseNameOf 已要求显式库名，这里理论上必然命中；未命中时原样返回。
	if index := strings.LastIndex(url, marker); index >= 0 {
		return url[:index] + replacement + url[index+len(marker):]
	}
	return url
}

func applyMigrations(targetURL string) error {
	connConfig, err := pgx.ParseConfig(targetURL)
	if err != nil {
		return fmt.Errorf("解析 TARGET_PG_URL: %w", err)
	}
	dsn := stdlib.RegisterConnConfig(connConfig)
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("打开迁移连接: %w", err)
	}
	defer database.Close()

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		return fmt.Errorf("定位迁移目录失败")
	}
	migrationDir := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "db", "migrations"))
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("goose 方言: %w", err)
	}
	if err := goose.Up(database, migrationDir); err != nil {
		return fmt.Errorf("goose 迁移: %w", err)
	}
	return nil
}

type legacyCaptain struct {
	ID        int64
	OpenID    string
	Nickname  string
	RealName  *string
	AvatarURL *string
	Phone     *string
	Active    bool
}

func loadLegacyCaptain(ctx context.Context, legacy *pgxpool.Pool, userID int64) (legacyCaptain, error) {
	var captain legacyCaptain
	var status int
	err := legacy.QueryRow(ctx, `
		SELECT id, open_id, nickname, real_name, avatar_url, phone_number, status
		FROM rs_user_info WHERE id = $1`, userID,
	).Scan(&captain.ID, &captain.OpenID, &captain.Nickname, &captain.RealName, &captain.AvatarURL, &captain.Phone, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return legacyCaptain{}, fmt.Errorf("旧库不存在队长用户 %d", userID)
	}
	if err != nil {
		return legacyCaptain{}, fmt.Errorf("查询旧库队长: %w", err)
	}
	captain.Active = status == 1
	return captain, nil
}

func seedHostAndCaptain(ctx context.Context, target *pgxpool.Pool, options cliOptions, captain legacyCaptain) error {
	if _, err := target.Exec(ctx,
		`INSERT INTO teams (id, name) VALUES ($1, $2)`, options.hostTeamID, options.hostTeamName,
	); err != nil {
		return fmt.Errorf("种子主队: %w", err)
	}
	status := "frozen"
	if captain.Active {
		status = "active"
	}
	if _, err := target.Exec(ctx, `
		INSERT INTO users (id, openid, nickname, avatar_url, real_name, phone_number, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		captain.ID, captain.OpenID, strings.TrimSpace(captain.Nickname), captain.AvatarURL, captain.RealName, captain.Phone, status,
	); err != nil {
		return fmt.Errorf("种子队长: %w", err)
	}
	if _, err := target.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'captain', 'active')`, options.hostTeamID, captain.ID,
	); err != nil {
		return fmt.Errorf("种子队长成员关系: %w", err)
	}
	return nil
}

type sourceCounts struct {
	Users         int
	Matches       int
	Registrations int
}

type targetCounts struct {
	Users         int
	Matches       int
	Registrations int
}

func countSourceRows(ctx context.Context, legacy *pgxpool.Pool, legacyTeamID int64) (sourceCounts, error) {
	var counts sourceCounts
	// 与 legacymatches 源查询保持同一谓词：主队或客队为本球队的活动全量导入。
	if err := legacy.QueryRow(ctx, `
		SELECT count(*) FROM rs_activity WHERE home_team_id=$1 OR away_team_id=$1`, legacyTeamID,
	).Scan(&counts.Matches); err != nil {
		return sourceCounts{}, err
	}
	if err := legacy.QueryRow(ctx, `
		SELECT count(DISTINCT ua.user_id)
		FROM rs_user_activity ua
		JOIN rs_activity a ON a.id = ua.activity_id
		WHERE a.home_team_id=$1 OR a.away_team_id=$1`, legacyTeamID,
	).Scan(&counts.Users); err != nil {
		return sourceCounts{}, err
	}
	// 目标库报名表按（分组, 用户）唯一；同场次同用户的重复报名在导入时按更新处理，
	// 因此期望值取 DISTINCT（activity_id, user_id）。
	if err := legacy.QueryRow(ctx, `
		SELECT count(DISTINCT (ua.activity_id, ua.user_id)) FROM rs_user_activity ua
		JOIN rs_activity a ON a.id = ua.activity_id
		WHERE a.home_team_id=$1 OR a.away_team_id=$1`, legacyTeamID,
	).Scan(&counts.Registrations); err != nil {
		return sourceCounts{}, err
	}
	return counts, nil
}

func countTargetRows(ctx context.Context, target *pgxpool.Pool) (targetCounts, error) {
	var counts targetCounts
	if err := target.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&counts.Users); err != nil {
		return targetCounts{}, err
	}
	if err := target.QueryRow(ctx, `SELECT count(*) FROM matches`).Scan(&counts.Matches); err != nil {
		return targetCounts{}, err
	}
	if err := target.QueryRow(ctx, `SELECT count(*) FROM match_registrations`).Scan(&counts.Registrations); err != nil {
		return targetCounts{}, err
	}
	return counts, nil
}

// compareCounts 返回第一处不一致的描述；全部一致返回空串。
func compareCounts(expected sourceCounts, actual targetCounts) string {
	switch {
	case expected.Users != actual.Users:
		return fmt.Sprintf("用户数不一致 expected=%d actual=%d", expected.Users, actual.Users)
	case expected.Matches != actual.Matches:
		return fmt.Sprintf("比赛数不一致 expected=%d actual=%d", expected.Matches, actual.Matches)
	case expected.Registrations != actual.Registrations:
		return fmt.Sprintf("报名数不一致 expected=%d actual=%d", expected.Registrations, actual.Registrations)
	}
	return ""
}
