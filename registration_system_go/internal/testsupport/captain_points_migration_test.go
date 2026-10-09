package testsupport

import (
	"context"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/pressly/goose/v3"
)

func TestCaptainPointsMigrationBackfillsCurrentCaptainAndPreservesFacts(t *testing.T) {
	pool, database := newMigratedSchemaForDown(t)
	ctx := context.Background()
	_, file, _, _ := runtime.Caller(0)
	dir := filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "db", "migrations"))
	if err := goose.DownTo(database, dir, 41); err != nil {
		t.Fatal(err)
	}
	// Reconstruct version 41 in this isolated schema; production Down preserves
	// snapshots, whereas this fixture needs historical rows without snapshots.
	if _, err := pool.Exec(ctx, `DROP TRIGGER capture_match_group_participation_rule ON match_registration_groups; DROP TABLE match_group_participation_rules`); err != nil {
		t.Fatal(err)
	}
	var original, current, team int64
	if err := pool.QueryRow(ctx, `INSERT INTO users(openid) VALUES('original-captain') RETURNING id`).Scan(&original); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users(openid) VALUES('current-captain') RETURNING id`).Scan(&current); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams(name,captain_id) VALUES('history',$1) RETURNING id`, original).Scan(&team); err != nil {
		t.Fatal(err)
	}
	var match, group string
	if err := pool.QueryRow(ctx, `INSERT INTO matches(id,name,publication_mode,opponent_state,status,host_team_id,opponent_name,players_per_team,start_time,end_time,location,created_by_user_id)
	 VALUES(gen_random_uuid(),'history','offline_confirmed','no_recruitment','ended',$1,'other',8,'2025-12-31 16:00:00','2025-12-31 18:00:00','pitch',$2) RETURNING id`, team, original).Scan(&match); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO match_registration_groups(id,match_id,kind,team_id) VALUES(gen_random_uuid(),$1,'host_team',$2) RETURNING id`, match, team).Scan(&group); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO match_registrations(id,group_id,user_id,status,participation_confirmed_at,early_registration_bonus,paid)
	 VALUES(gen_random_uuid(),$1,$2,'attending','2025-12-30 16:00:00',30,true),(gen_random_uuid(),$1,$3,'attending','2025-12-30 16:00:00',30,true)`, group, original, current); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE teams SET captain_id=$2 WHERE id=$1`, team, current); err != nil {
		t.Fatal(err)
	}
	var before string
	if err := pool.QueryRow(ctx, `SELECT md5(string_agg(to_jsonb(r)::text,',' ORDER BY r.user_id)) FROM match_registrations r`).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(database, dir); err != nil {
		t.Fatal(err)
	}
	assertPoints := func(user, expected int64) {
		t.Helper()
		var points int64
		var year int
		if err := pool.QueryRow(ctx, `SELECT score_year,points FROM team_participation_points WHERE group_id=$1 AND user_id=$2`, group, user).Scan(&year, &points); err != nil {
			t.Fatal(err)
		}
		if year != 2026 || points != expected {
			t.Fatalf("user=%d year=%d points=%d want=%d", user, year, points, expected)
		}
	}
	assertPoints(original, 90)
	assertPoints(current, 100)
	var after string
	if err := pool.QueryRow(ctx, `SELECT md5(string_agg(to_jsonb(r)::text,',' ORDER BY r.user_id)) FROM match_registrations r`).Scan(&after); err != nil || before != after {
		t.Fatalf("registration facts changed: before=%s after=%s err=%v", before, after, err)
	}
	if err := goose.DownTo(database, dir, 41); err != nil {
		t.Fatal(err)
	}
	assertPoints(original, 100)
	assertPoints(current, 100)
	if _, err := pool.Exec(ctx, `UPDATE teams SET captain_id=$2 WHERE id=$1`, team, original); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(database, dir); err != nil {
		t.Fatal(err)
	}
	assertPoints(original, 90)
	assertPoints(current, 100) // Existing snapshots must not migrate to a later captain.
}
