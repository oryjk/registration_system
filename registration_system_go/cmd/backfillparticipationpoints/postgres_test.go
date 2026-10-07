package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	matchpostgres "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

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
