package legacyteams

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestImporterIsIdempotentAndAssignsCaptain(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	now := time.Date(2025, 11, 27, 8, 0, 0, 0, time.UTC)
	snapshot := Snapshot{
		Team: LegacyTeam{ID: "legacy-team", Name: "洺悦御府", LogoURL: stringPointer("https://example.test/logo.png"), CaptainUserID: 4, Status: 1, CreatedAt: now, UpdatedAt: now},
		Users: []LegacyUser{
			{ID: 4, OpenID: "openid-captain", Nickname: "队长昵称", AvatarURL: stringPointer("https://example.test/a.png"), RealName: "王队长", PhoneNumber: "13800138000", Status: 1, CreatedAt: now, UpdatedAt: now},
			{ID: 5, OpenID: "openid-vice", Nickname: "副队昵称", AvatarURL: stringPointer("/9j/4AAQSkZJRgABAQ"), RealName: "李副队", PhoneNumber: "", Status: 1, CreatedAt: now, UpdatedAt: now},
		},
		Memberships: []LegacyMembership{
			{UserID: 4, Role: "captain", Status: 1, JoinedAt: now, CreatedAt: now, UpdatedAt: now},
			{UserID: 5, Role: "vice_captain", Status: 0, JoinedAt: now, CreatedAt: now, UpdatedAt: now},
		},
	}
	importer := NewImporter(pool, fakeSource{snapshot: snapshot})

	report, err := importer.Run(context.Background(), false)
	if err != nil {
		t.Fatalf("first import: %v", err)
	}
	if report.UsersInserted != 2 || report.TeamsInserted != 1 || report.MembershipsInserted != 2 {
		t.Fatalf("unexpected first report: %+v", report)
	}
	report, err = importer.Run(context.Background(), false)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if report.UsersSkipped != 2 || report.TeamsSkipped != 1 || report.MembershipsSkipped != 2 {
		t.Fatalf("unexpected second report: %+v", report)
	}

	var captainSet bool
	var active, inactive, captain, vice, nullPhones int
	err = pool.QueryRow(context.Background(), `
        SELECT t.captain_id IS NOT NULL,
               COUNT(*) FILTER (WHERE tm.status='active'),
               COUNT(*) FILTER (WHERE tm.status='inactive'),
               COUNT(*) FILTER (WHERE tm.role='captain'),
               COUNT(*) FILTER (WHERE tm.role='vice_captain'),
               COUNT(*) FILTER (WHERE u.phone_number IS NULL)
        FROM teams t
        JOIN team_members tm ON tm.team_id=t.id
        JOIN users u ON u.id=tm.user_id
        WHERE t.name='洺悦御府'
        GROUP BY t.captain_id`).Scan(&captainSet, &active, &inactive, &captain, &vice, &nullPhones)
	if err != nil || !captainSet || active != 1 || inactive != 1 || captain != 1 || vice != 1 || nullPhones != 1 {
		t.Fatalf("unexpected imported state: captain=%t active=%d inactive=%d roles=%d/%d nullPhones=%d err=%v", captainSet, active, inactive, captain, vice, nullPhones, err)
	}
	var normalizedAvatars int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users WHERE avatar_url LIKE 'data:image/jpeg;base64,%'`).Scan(&normalizedAvatars); err != nil || normalizedAvatars != 1 {
		t.Fatalf("legacy base64 avatar was not normalized: count=%d err=%v", normalizedAvatars, err)
	}
}

func TestImporterDryRunRollsBackAndDuplicateTeamRollsBack(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	now := time.Now().UTC()
	snapshot := Snapshot{
		Team:        LegacyTeam{ID: "legacy", Name: "重名球队", CaptainUserID: 1, Status: 1, CreatedAt: now, UpdatedAt: now},
		Users:       []LegacyUser{{ID: 1, OpenID: "dry-openid", RealName: "测试球员", Status: 1, CreatedAt: now, UpdatedAt: now}},
		Memberships: []LegacyMembership{{UserID: 1, Role: "captain", Status: 1, JoinedAt: now, CreatedAt: now, UpdatedAt: now}},
	}
	importer := NewImporter(pool, fakeSource{snapshot: snapshot})
	if report, err := importer.Run(context.Background(), true); err != nil || report.UsersInserted != 1 {
		t.Fatalf("dry run: report=%+v err=%v", report, err)
	}
	var users int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users`).Scan(&users); err != nil || users != 0 {
		t.Fatalf("dry run wrote users: count=%d err=%v", users, err)
	}
	if _, err := pool.Exec(context.Background(), `INSERT INTO teams (name) VALUES ('重名球队'), ('重名球队')`); err != nil {
		t.Fatalf("seed duplicate teams: %v", err)
	}
	if _, err := importer.Run(context.Background(), false); err == nil || !strings.Contains(err.Error(), "ambiguous") {
		t.Fatalf("expected duplicate team error, got %v", err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM users`).Scan(&users); err != nil || users != 0 {
		t.Fatalf("failed import was not rolled back: count=%d err=%v", users, err)
	}
}

type fakeSource struct {
	snapshot Snapshot
}

func (f fakeSource) Load(context.Context) (Snapshot, error) { return f.snapshot, nil }

func stringPointer(value string) *string { return &value }
