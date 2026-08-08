package legacymatches

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestImporterIsIdempotentAndMapsLegacyState(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()

	// 目标库预置主队与队长用户，模拟上一轮球队导入结果。
	var hostTeamID, captainID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('captain-openid') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('洺悦御府', $1) RETURNING id`, captainID).Scan(&hostTeamID); err != nil {
		t.Fatalf("seed host team: %v", err)
	}
	// 预置一个已注册球员，报名会引用其 openid。
	var playerID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('player-openid') RETURNING id`).Scan(&playerID); err != nil {
		t.Fatalf("seed player: %v", err)
	}

	now := time.Date(2025, 11, 27, 8, 0, 0, 0, time.UTC)
	start := time.Date(2025, 11, 30, 19, 0, 0, 0, time.UTC)
	snapshot := Snapshot{
		Users: []LegacyUser{{SourceID: 901, OpenID: "player-openid", Nickname: "球员", Status: 1, UpdatedAt: now}},
		Matches: []LegacyMatch{
			{
				SourceID: "match-real-opponent", Name: "周日友谊赛", Opposing: "叮叮猫",
				Status: 2, PlayersPerTeam: 8, StartTime: start, EndTime: start.Add(2 * time.Hour),
				Location: "驿马河", CreatedAt: now, UpdatedAt: now, HomeTeamSourceID: 1,
			},
			{
				SourceID: "match-pending", Name: "周四友谊赛", Opposing: "",
				Status: 0, PlayersPerTeam: 0, StartTime: start.Add(48 * time.Hour), EndTime: start.Add(50 * time.Hour),
				Location: "环球中心", CreatedAt: now, UpdatedAt: now, HomeTeamSourceID: 1,
			},
		},
		Registrations: []LegacyRegistration{
			// stand=0 必须落到 unknown；registration_count=0 必须落到 1。
			{ActivitySourceID: "match-real-opponent", UserSourceID: 901, OpenID: "player-openid", Stand: 0, RegistrationCount: 0, OperationTime: now, CreatedAt: now, UpdatedAt: now},
			{ActivitySourceID: "match-pending", UserSourceID: 901, OpenID: "player-openid", Stand: 1, RegistrationCount: 1, OperationTime: now, CreatedAt: now, UpdatedAt: now},
		},
	}
	importer := NewImporter(pool, fakeSource{snapshot: snapshot}, hostTeamID, captainID)

	report, err := importer.Run(ctx, false)
	if err != nil {
		t.Fatalf("first import: %v", err)
	}
	if report.UsersUpdated != 1 || report.MatchesInserted != 2 || report.RegistrationsInserted != 2 || !report.PendingTeamCreated {
		t.Fatalf("unexpected first report: %+v", report)
	}

	// 第二轮必须幂等：全部跳过，不再新建“待定”球队。
	report, err = importer.Run(ctx, false)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if report.UsersSkipped != 1 || report.MatchesSkipped != 2 || report.RegistrationsSkipped != 2 || report.PendingTeamCreated {
		t.Fatalf("unexpected second report: %+v", report)
	}

	var (
		matchCount, pendingTeamCount                      int
		unknownCount, attendingCount, pendingAwayRefCount int
		registrationCountValue                            int
	)
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE host_team_id=$1`, hostTeamID).Scan(&matchCount); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if matchCount != 2 {
		t.Fatalf("expected 2 matches, got %d", matchCount)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM teams WHERE name='待定'`).Scan(&pendingTeamCount); err != nil {
		t.Fatalf("count pending team: %v", err)
	}
	if pendingTeamCount != 1 {
		t.Fatalf("expected 1 pending team, got %d", pendingTeamCount)
	}
	// 真实对手名比赛 away_team_id 为空；待定比赛 away_team_id 指向“待定”球队。
	if err := pool.QueryRow(ctx, `
        SELECT COUNT(*) FROM matches m
        JOIN teams t ON t.id=m.away_team_id
        WHERE m.host_team_id=$1 AND t.name='待定'`, hostTeamID).Scan(&pendingAwayRefCount); err != nil {
		t.Fatalf("count pending away refs: %v", err)
	}
	if pendingAwayRefCount != 1 {
		t.Fatalf("expected 1 match referencing pending team, got %d", pendingAwayRefCount)
	}
	if err := pool.QueryRow(ctx, `
        SELECT COUNT(*) FILTER (WHERE status='unknown'),
               COUNT(*) FILTER (WHERE status='attending'),
               MAX(registration_count)
        FROM match_registrations`).Scan(&unknownCount, &attendingCount, &registrationCountValue); err != nil {
		t.Fatalf("query registrations: %v", err)
	}
	if unknownCount != 1 || attendingCount != 1 {
		t.Fatalf("expected 1 unknown + 1 attending, got unknown=%d attending=%d", unknownCount, attendingCount)
	}
	// registration_count=0 的旧记录必须落到 1（满足 Go 正约束）。
	if registrationCountValue != 1 {
		t.Fatalf("expected registration_count normalized to 1, got max=%d", registrationCountValue)
	}
}

func TestImporterDryRunRollsBack(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()

	var hostTeamID, captainID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('captain-openid') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('洺悦御府', $1) RETURNING id`, captainID).Scan(&hostTeamID); err != nil {
		t.Fatalf("seed host team: %v", err)
	}

	now := time.Now().UTC()
	start := now.Add(24 * time.Hour)
	snapshot := Snapshot{
		Matches: []LegacyMatch{{
			SourceID: "dry-match", Name: "预演赛", Opposing: "老朋友", Status: 2, PlayersPerTeam: 8,
			StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "场地", CreatedAt: now, UpdatedAt: now, HomeTeamSourceID: 1,
		}},
	}
	importer := NewImporter(pool, fakeSource{snapshot: snapshot}, hostTeamID, captainID)
	report, err := importer.Run(ctx, true)
	if err != nil || report.MatchesInserted != 1 || !report.PendingTeamCreated {
		t.Fatalf("dry run: report=%+v err=%v", report, err)
	}

	var matches, pendingTeams int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches`).Scan(&matches); err != nil {
		t.Fatalf("count matches after dry run: %v", err)
	}
	if matches != 0 {
		t.Fatalf("dry run wrote matches: %d", matches)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM teams WHERE name='待定'`).Scan(&pendingTeams); err != nil {
		t.Fatalf("count pending teams after dry run: %v", err)
	}
	if pendingTeams != 0 {
		t.Fatalf("dry run wrote pending team: %d", pendingTeams)
	}
}

func TestImporterAbortsOnOrphanPostgresUserReference(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()

	var hostTeamID, captainID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('captain-openid') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('洺悦御府', $1) RETURNING id`, captainID).Scan(&hostTeamID); err != nil {
		t.Fatalf("seed host team: %v", err)
	}

	now := time.Now().UTC()
	start := now.Add(24 * time.Hour)
	snapshot := Snapshot{
		Matches: []LegacyMatch{{
			SourceID: "orphan-match", Name: "孤儿赛", Opposing: "盼盼", Status: 2, PlayersPerTeam: 8,
			StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "场地", CreatedAt: now, UpdatedAt: now, HomeTeamSourceID: 1,
		}},
		// 报名引用的 PostgreSQL user_id 不在快照用户列表里，必须中止。
		Registrations: []LegacyRegistration{{
			ActivitySourceID: "orphan-match", UserSourceID: 999, OpenID: "ghost-openid", Stand: 1, RegistrationCount: 1,
			OperationTime: now, CreatedAt: now, UpdatedAt: now,
		}},
	}
	importer := NewImporter(pool, fakeSource{snapshot: snapshot}, hostTeamID, captainID)
	_, err := importer.Run(ctx, false)
	if err == nil || !strings.Contains(err.Error(), "PostgreSQL 用户") {
		t.Fatalf("expected orphan postgres user abort, got %v", err)
	}

	var matches int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches`).Scan(&matches); err != nil {
		t.Fatalf("count matches after abort: %v", err)
	}
	if matches != 0 {
		t.Fatalf("aborted import wrote matches: %d", matches)
	}
}

type fakeSource struct {
	snapshot Snapshot
}

func (f fakeSource) Load(context.Context, LoadOptions) (Snapshot, error) { return f.snapshot, nil }
