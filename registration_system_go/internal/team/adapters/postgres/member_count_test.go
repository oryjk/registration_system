package postgres

import (
	"context"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryTeamListCountsCurrentMembers(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var teamID, emptyTeamID, otherTeamID int64
	for name, target := range map[string]*int64{"有成员": &teamID, "空球队": &emptyTeamID, "其他球队": &otherTeamID} {
		if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ($1) RETURNING id`, name).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	for _, member := range []struct {
		teamID int64
		role   string
		status string
		openid string
	}{
		{teamID, "captain", "active", "count-captain"},
		{teamID, "leader", "active", "count-leader"},
		{teamID, "member", "inactive", "count-inactive"},
		{teamID, "member", "removed", "count-removed"},
		{otherTeamID, "member", "active", "count-other"},
	} {
		var userID int64
		if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, member.openid).Scan(&userID); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, $3, $4)`, member.teamID, userID, member.role, member.status); err != nil {
			t.Fatal(err)
		}
	}
	items, err := NewRepository(pool).List(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := map[int64]int64{teamID: 3, emptyTeamID: 0, otherTeamID: 1}
	if len(items) != len(want) {
		t.Fatalf("expected three teams, got %d", len(items))
	}
	for _, team := range items {
		if team.MemberCount != want[team.ID] {
			t.Errorf("team %d: member count = %d, want %d", team.ID, team.MemberCount, want[team.ID])
		}
	}
}
