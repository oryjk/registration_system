package postgres

import (
	"context"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	"testing"
)

func TestHonorShareRepositoryUniqueYearAndRevocation(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var user, team int64
	if err := pool.QueryRow(ctx, `INSERT INTO users(openid,nickname)VALUES('honor-share-owner','owner')RETURNING id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams(name,join_password_hash)VALUES('honor team','hash')RETURNING id`).Scan(&team); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role,is_paid_member)VALUES($1,$2,'member',true)`, team, user); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range []struct {
		stamp string
		bonus int
	}{{"2025-12-31 15:59:59", 24}, {"2025-12-31 16:00:00", 30}} {
		var matchID, groupID string
		if err := pool.QueryRow(ctx, `INSERT INTO matches
		(id,name,publication_mode,opponent_state,status,host_team_id,opponent_name,players_per_team,start_time,end_time,location,created_by_user_id)
		VALUES(gen_random_uuid(),'honor history','offline_confirmed','no_recruitment','ended',$1,'opponent',8,$2::timestamp,$2::timestamp+interval '2 hours','pitch',$3) RETURNING id`, team, fixture.stamp, user).Scan(&matchID); err != nil {
			t.Fatal(err)
		}
		if err := pool.QueryRow(ctx, `INSERT INTO match_registration_groups(id,match_id,kind,team_id)VALUES(gen_random_uuid(),$1,'host_team',$2) RETURNING id`, matchID, team).Scan(&groupID); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO match_registrations(id,group_id,user_id,status,participation_confirmed_at,early_registration_bonus,participation_base_points,participation_rule_version)
		VALUES(gen_random_uuid(),$1,$2,'attending',$3::timestamp,$4,70,2)`, groupID, user, fixture.stamp, fixture.bonus); err != nil {
			t.Fatal(err)
		}
	}
	repo := NewRepository(pool)
	id, err := repo.CreateHonorShare(ctx, team, user, 2026)
	if err != nil {
		t.Fatal(err)
	}
	repeat, err := repo.CreateHonorShare(ctx, team, user, 2026)
	if err != nil || repeat != id {
		t.Fatalf("share not stable: %v", err)
	}
	next, err := repo.CreateHonorShare(ctx, team, user, 2027)
	if err != nil || next == id {
		t.Fatalf("year not isolated: %v", err)
	}
	view, ok, err := repo.FindHonorShare(ctx, id)
	if err != nil || !ok || view.ScoreYear != 2026 || view.ParticipationPoints != 90 || view.ParticipationRank != 1 || !view.IsPaidMember || !view.RequiresPassword {
		t.Fatalf("view: %+v %v %v", view, ok, err)
	}
	previous, err := repo.CreateHonorShare(ctx, team, user, 2025)
	if err != nil {
		t.Fatal(err)
	}
	previousView, ok, err := repo.FindHonorShare(ctx, previous)
	if err != nil || !ok || previousView.ParticipationPoints != 84 {
		t.Fatalf("previous Beijing year: %+v %v", previousView, err)
	}
	nextView, ok, err := repo.FindHonorShare(ctx, next)
	if err != nil || !ok || nextView.ParticipationPoints != 0 {
		t.Fatalf("new year zero: %+v %v", nextView, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE team_members SET status='left' WHERE team_id=$1 AND user_id=$2`, team, user); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := repo.FindHonorShare(ctx, id); err != nil || ok {
		t.Fatalf("left member visible: %v %v", ok, err)
	}
	if _, err := repo.CreateHonorShare(ctx, team, user, 2026); err == nil {
		t.Fatal("left member created share")
	}
	if _, err := pool.Exec(ctx, `UPDATE team_members SET status='active' WHERE team_id=$1 AND user_id=$2; `, team, user); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET status='frozen' WHERE id=$1`, user); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := repo.FindHonorShare(ctx, id); err != nil || ok {
		t.Fatalf("frozen user visible: %v %v", ok, err)
	}
}
