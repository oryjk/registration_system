package postgres

import (
	"context"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryMapsActiveLeaderMembership(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('openid-1') RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('东安联队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'leader')`, teamID, userID); err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	membership, ok, err := NewRepository(pool).FindActiveMember(ctx, teamID, userID)
	if err != nil {
		t.Fatalf("find membership: %v", err)
	}
	if !ok || membership.Role != domain.RoleLeader || membership.Status != domain.MemberActive {
		t.Fatalf("unexpected membership: %+v, ok=%v", membership, ok)
	}
}
