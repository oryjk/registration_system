package postgres

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
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

func TestRepositorySearchesMemberCandidatesByProfile(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var teamID, userID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('候选搜索球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname, real_name, phone_number) VALUES ('candidate-openid', '小明', '王小明', '13800138000') RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed candidate: %v", err)
	}
	repository := NewRepository(pool)
	for _, search := range []string{"王小明", "13800138000"} {
		candidates, err := repository.ListMemberCandidates(ctx, teamID, search, 50)
		if err != nil || len(candidates) != 1 || candidates[0].UserID != userID {
			t.Fatalf("search %q: candidates=%+v err=%v", search, candidates, err)
		}
		if candidates[0].RealName == nil || *candidates[0].RealName != "王小明" || candidates[0].PhoneNumber == nil {
			t.Fatalf("missing profile fields: %+v", candidates[0])
		}
	}
}

func TestRepositoryManagesMembersAndCaptain(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for local PostgreSQL repository test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("open PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin transaction: %v", err)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })

	var teamID, firstUserID, secondUserID, candidateUserID int64
	if err := tx.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('成员仓储测试球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	for nickname, target := range map[string]*int64{
		"王一": &firstUserID, "李二": &secondUserID, "张三": &candidateUserID,
	} {
		if err := tx.QueryRow(ctx, `INSERT INTO users (openid, nickname) VALUES ($1, $2) RETURNING id`, "member-test-"+nickname, nickname).Scan(target); err != nil {
			t.Fatalf("seed user %s: %v", nickname, err)
		}
	}

	repository := NewRepository(tx)
	if err := repository.AddMember(ctx, teamID, firstUserID, domain.RoleLeader); err != nil {
		t.Fatalf("add first member: %v", err)
	}
	if err := repository.AddMember(ctx, teamID, secondUserID, domain.RoleMember); err != nil {
		t.Fatalf("add second member: %v", err)
	}

	members, err := repository.ListMembers(ctx, teamID)
	if err != nil || len(members) != 2 {
		t.Fatalf("list members: members=%+v err=%v", members, err)
	}
	candidates, err := repository.ListMemberCandidates(ctx, teamID, "张", 50)
	if err != nil || len(candidates) != 1 || candidates[0].UserID != candidateUserID {
		t.Fatalf("list candidates: candidates=%+v err=%v", candidates, err)
	}

	if err := repository.SetCaptain(ctx, teamID, &firstUserID); err != nil {
		t.Fatalf("set captain: %v", err)
	}
	team, found, err := repository.FindByID(ctx, teamID)
	if err != nil || !found || team.CaptainID == nil || *team.CaptainID != firstUserID {
		t.Fatalf("captain was not set: team=%+v found=%t err=%v", team, found, err)
	}

	updated, err := repository.UpdateMember(ctx, teamID, secondUserID, domain.RoleMember, domain.MemberInactive)
	if err != nil || !updated {
		t.Fatalf("freeze second member: updated=%t err=%v", updated, err)
	}
	if err := repository.SetCaptain(ctx, teamID, &secondUserID); !errors.Is(err, ports.ErrMemberNotFound) {
		t.Fatalf("expected inactive captain rejection, got %v", err)
	}
	team, _, err = repository.FindByID(ctx, teamID)
	if err != nil || team.CaptainID == nil || *team.CaptainID != firstUserID {
		t.Fatalf("failed captain change modified current captain: team=%+v err=%v", team, err)
	}
	members, err = repository.ListMembers(ctx, teamID)
	if err != nil || memberRole(members, firstUserID) != domain.RoleCaptain {
		t.Fatalf("failed captain change demoted current captain: members=%+v err=%v", members, err)
	}

	if err := repository.SetCaptain(ctx, teamID, nil); err != nil {
		t.Fatalf("clear captain: %v", err)
	}
	team, _, err = repository.FindByID(ctx, teamID)
	if err != nil || team.CaptainID != nil {
		t.Fatalf("captain was not cleared: team=%+v err=%v", team, err)
	}
	removed, err := repository.RemoveMember(ctx, teamID, secondUserID)
	if err != nil || !removed {
		t.Fatalf("remove member: removed=%t err=%v", removed, err)
	}
	if err := repository.AddMember(ctx, teamID, firstUserID, domain.RoleMember); !errors.Is(err, ports.ErrMemberAlreadyExists) {
		t.Fatalf("expected duplicate member error, got %v", err)
	}
}

func memberRole(members []domain.MemberDetails, userID int64) domain.Role {
	for _, member := range members {
		if member.UserID == userID {
			return member.Role
		}
	}
	return ""
}
