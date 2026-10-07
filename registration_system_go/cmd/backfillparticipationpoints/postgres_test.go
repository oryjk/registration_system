package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	matchpostgres "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func seedNativeHistory(t *testing.T, pool *pgxpool.Pool) (domain.Registration, time.Time) {
	t.Helper()
	ctx := context.Background()
	var owner, team int64
	if err := pool.QueryRow(ctx, `INSERT INTO users(openid) VALUES($1) RETURNING id`, uuid.NewString()).Scan(&owner); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams(name,captain_id) VALUES('native-history',$1) RETURNING id`, owner).Scan(&team); err != nil {
		t.Fatal(err)
	}
	publication := time.Date(2026, 9, 28, 10, 41, 7, 0, time.UTC)
	start := time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)
	m, groups, err := domain.NewMatch(domain.NewMatchInput{Name: "native-history", PublicationMode: domain.OnlineTeam, HostTeamID: &team, CreatedByUserID: &owner, PlayersPerTeam: 8, StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "test", CreatedAt: publication}, domain.IndividualLimits{})
	if err != nil {
		t.Fatal(err)
	}
	m.Status = domain.MatchEnded
	repo := matchpostgres.NewRepository(pool)
	if err := repo.CreateWithGroups(ctx, m, groups); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE matches SET created_at=$2 WHERE id=$1`, m.ID, publication); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE match_registration_groups SET created_at=$2 WHERE id=$1`, groups[0].ID, publication); err != nil {
		t.Fatal(err)
	}
	r, _ := domain.NewRegistration(groups[0].ID, owner, domain.RegistrationAttending, 1, publication.Add(5*time.Second))
	if err := repo.CreateRegistration(ctx, r); err != nil {
		t.Fatal(err)
	}
	lastUpdate := time.Date(2026, 10, 6, 14, 43, 12, 0, time.UTC)
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET updated_at=$2,paid=true WHERE id=$1`, r.ID, lastUpdate); err != nil {
		t.Fatal(err)
	}
	return r, lastUpdate
}

func TestNativeBackfillUsesFirstRegistrationDespiteLaterCorrection(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	r, lastUpdate := seedNativeHistory(t, pool)
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	candidates, err := loadCandidates(ctx, tx, time.Date(2026, 10, 7, 0, 52, 35, 0, time.UTC), false)
	if err != nil || len(candidates) != 1 {
		t.Fatalf("candidates=%+v err=%v", candidates, err)
	}
	u, ok := calculate(candidates[0], nil)
	if !ok || u.Bonus != 30 || !u.ResponseAt.Equal(r.CreatedAt) {
		t.Fatalf("last modification replaced first response: reward=%+v first=%v last=%v", u, r.CreatedAt, lastUpdate)
	}
	written, err := applyRewards(ctx, tx, []rewardUpdate{u})
	if err != nil || written != 1 {
		t.Fatalf("write=%d err=%v", written, err)
	}
	var bonus int32
	var first, updated time.Time
	var paid bool
	if err := tx.QueryRow(ctx, `SELECT early_registration_bonus,participation_confirmed_at,updated_at,paid FROM match_registrations WHERE id=$1`, r.ID).Scan(&bonus, &first, &updated, &paid); err != nil {
		t.Fatal(err)
	}
	if bonus != 30 || !first.Equal(r.CreatedAt) || !updated.Equal(lastUpdate) || !paid {
		t.Fatalf("bonus=%d first=%v updated=%v paid=%v", bonus, first, updated, paid)
	}
}

func TestGoHistoryRepairPreservesTrustedResponsesAndIsIdempotent(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	r, lastUpdate := seedNativeHistory(t, pool)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET participation_confirmed_at=updated_at,early_registration_bonus=0,participation_rule_version=2 WHERE id=$1`, r.ID); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"v1", "trusted-v2", "live", "mapped", "unchanged"} {
		var user int64
		if err := pool.QueryRow(ctx, `INSERT INTO users(openid) VALUES($1) RETURNING id`, uuid.NewString()).Scan(&user); err != nil {
			t.Fatal(err)
		}
		id := uuid.New()
		updated, first, bonus, version := lastUpdate, lastUpdate, 0, 2
		switch kind {
		case "v1":
			bonus, version = 6, 1
		case "trusted-v2":
			first, bonus = r.CreatedAt, 30
		case "live":
			updated = time.Date(2026, 10, 7, 1, 0, 0, 0, time.UTC)
			first = updated
		case "unchanged":
			updated, first, bonus = r.CreatedAt, r.CreatedAt, 30
		}
		if _, err := pool.Exec(ctx, `INSERT INTO match_registrations(id,group_id,user_id,status,created_at,updated_at,participation_confirmed_at,early_registration_bonus,participation_rule_version) VALUES($1,$2,$3,'attending',$4,$5,$6,$7,$8)`, id, r.GroupID, user, r.CreatedAt, updated, first, bonus, version); err != nil {
			t.Fatal(err)
		}
		if kind == "mapped" {
			if _, err := pool.Exec(ctx, `INSERT INTO legacy_import_mappings(source_system,entity_type,source_id,target_id,source_fingerprint,target_fingerprint) VALUES('legacy_postgres','registration','7:4',$1,$2,$2)`, id.String(), strings.Repeat("a", 64)); err != nil {
				t.Fatal(err)
			}
		}
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var protectedBefore, protectedAfter string
	const fingerprint = `SELECT md5(string_agg(r::text,'' ORDER BY id)) FROM match_registrations r WHERE id<>$1`
	if err := tx.QueryRow(ctx, fingerprint, r.ID).Scan(&protectedBefore); err != nil {
		t.Fatal(err)
	}
	cutoff := time.Date(2026, 10, 7, 0, 52, 35, 0, time.UTC)
	candidates, err := loadNativeRepairCandidates(ctx, tx, cutoff, true)
	if err != nil || len(candidates) != 1 || candidates[0].ID != r.ID {
		t.Fatalf("repair selected trusted or new records: %+v err=%v", candidates, err)
	}
	u, ok := calculate(candidates[0], nil)
	if !ok || u.Bonus != 30 || !u.ResponseAt.Equal(r.CreatedAt) {
		t.Fatalf("repair did not restore first response: %+v", u)
	}
	written, err := applyRewards(ctx, tx, []rewardUpdate{u})
	if err != nil || written != 1 {
		t.Fatalf("repair written=%d err=%v", written, err)
	}
	written, err = applyRewards(ctx, tx, []rewardUpdate{u})
	if err != nil || written != 0 {
		t.Fatalf("repair repeated written=%d err=%v", written, err)
	}
	remaining, err := loadNativeRepairCandidates(ctx, tx, cutoff, false)
	if err != nil || len(remaining) != 0 {
		t.Fatalf("repair not idempotent: %+v err=%v", remaining, err)
	}
	if err := tx.QueryRow(ctx, fingerprint, r.ID).Scan(&protectedAfter); err != nil || protectedBefore != protectedAfter {
		t.Fatalf("protected records changed: %s vs %s err=%v", protectedBefore, protectedAfter, err)
	}
	var first, updated, created time.Time
	var points int64
	var paid bool
	var status string
	if err := tx.QueryRow(ctx, `SELECT r.participation_confirmed_at,r.updated_at,r.created_at,r.paid,r.status,p.points FROM match_registrations r JOIN team_participation_points p ON p.registration_id=r.id WHERE r.id=$1`, r.ID).Scan(&first, &updated, &created, &paid, &status, &points); err != nil {
		t.Fatal(err)
	}
	if !first.Equal(r.CreatedAt) || !created.Equal(r.CreatedAt) || !updated.Equal(lastUpdate) || !paid || status != "attending" || points != 100 {
		t.Fatalf("repair changed facts: first=%v created=%v updated=%v paid=%v status=%s points=%d", first, created, updated, paid, status, points)
	}
}

func TestBackfillUsesLegacyOperationTimeAndPreservesExistingFacts(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var owner, team int64
	if err := pool.QueryRow(ctx, `INSERT INTO users(openid) VALUES($1) RETURNING id`, uuid.NewString()).Scan(&owner); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams(name,captain_id) VALUES('backfill-test',$1) RETURNING id`, owner).Scan(&team); err != nil {
		t.Fatal(err)
	}
	opening := time.Date(2026, 1, 4, 0, 0, 0, 0, time.UTC)
	start := opening.Add(4 * 24 * time.Hour)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{Name: "backfill-test", PublicationMode: domain.OnlineTeam, HostTeamID: &team, CreatedByUserID: &owner, PlayersPerTeam: 8, StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "test", CreatedAt: opening}, domain.IndividualLimits{})
	if err != nil {
		t.Fatal(err)
	}
	match.Status = domain.MatchEnded
	repo := matchpostgres.NewRepository(pool)
	if err := repo.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatal(err)
	}
	registration, _ := domain.NewRegistration(groups[0].ID, owner, domain.RegistrationAttending, 1, opening.Add(time.Minute))
	if err := repo.CreateRegistration(ctx, registration); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET paid=true WHERE id=$1`, registration.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO legacy_import_mappings(source_system,entity_type,source_id,target_id,source_fingerprint,target_fingerprint) VALUES('legacy_postgres','registration','7:4',$1,$2,$2)`, registration.ID.String(), strings.Repeat("a", 64)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE rs_activity(id text,created_at timestamp,start_time timestamp,end_time timestamp,holding_date timestamp); CREATE TABLE rs_user_activity(activity_id text,user_id bigint,stand integer,operation_time timestamp)`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO rs_activity VALUES('7',$1,$2,NULL,$3)`, start.Add(8*time.Hour), opening.Add(8*time.Hour), start.Add(8*time.Hour)); err != nil {
		t.Fatal(err)
	}
	response := opening.Add(30 * time.Minute)
	if _, err := pool.Exec(ctx, `INSERT INTO rs_user_activity VALUES('7',4,1,$1)`, response); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	old, err := loadLegacy(ctx, tx)
	if err != nil {
		t.Fatal(err)
	}
	candidates, err := loadCandidates(ctx, tx, time.Date(2026, 10, 7, 0, 52, 35, 0, time.UTC), true)
	if err != nil {
		t.Fatal(err)
	}
	if len(candidates) != 1 || candidates[0].LegacySource != "7:4" || !candidates[0].Eligible {
		t.Fatalf("candidates=%+v", candidates)
	}
	value := old[candidates[0].LegacySource]
	update, ok := calculate(candidates[0], &value)
	if !ok || update.Bonus != 30 || !update.ResponseAt.Equal(response) {
		t.Fatalf("update=%+v", update)
	}
	written, err := applyRewards(ctx, tx, []rewardUpdate{update})
	if err != nil || written != 1 {
		t.Fatalf("written=%d err=%v", written, err)
	}
	changed := update
	changed.Bonus = 6
	changed.ResponseAt = response.Add(time.Hour)
	written, err = applyRewards(ctx, tx, []rewardUpdate{changed})
	if err != nil || written != 0 {
		t.Fatalf("repeat overwrote reward written=%d err=%v", written, err)
	}
	var bonus, version int32
	var first, operation time.Time
	var paid bool
	var status string
	if err := tx.QueryRow(ctx, `SELECT early_registration_bonus,participation_rule_version,participation_confirmed_at,updated_at,paid,status FROM match_registrations WHERE id=$1`, registration.ID).Scan(&bonus, &version, &first, &operation, &paid, &status); err != nil {
		t.Fatal(err)
	}
	if bonus != 30 || version != 2 || !first.Equal(response) || !operation.Equal(registration.UpdatedAt) || !paid || status != "attending" {
		t.Fatalf("reward/payment/status facts changed bonus=%d version=%d first=%v operation=%v paid=%v status=%s", bonus, version, first, operation, paid, status)
	}
	var points int64
	if err := tx.QueryRow(ctx, `SELECT points FROM team_participation_points WHERE registration_id=$1`, registration.ID).Scan(&points); err != nil || points != 100 {
		t.Fatalf("points=%d err=%v", points, err)
	}
	remaining, err := loadCandidates(ctx, tx, time.Now().UTC(), false)
	if err != nil || len(remaining) != 0 {
		t.Fatalf("repeat candidates=%+v err=%v", remaining, err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
}
