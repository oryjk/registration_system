package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teampassword "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/password"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func errorKind(err error) sharederror.Kind {
	var businessError *sharederror.Error
	if errors.As(err, &businessError) {
		return businessError.Kind
	}
	return ""
}

func TestAppTeamSelfServiceCreateJoinSearchPasswordFlow(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := teampostgres.NewRepository(pool)
	service := NewAppTeamSelfService(repository, teampassword.Bcrypt{})

	var creatorID, joinerID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('self-create') RETURNING id`).Scan(&creatorID); err != nil {
		t.Fatalf("seed creator: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('self-join') RETURNING id`).Scan(&joinerID); err != nil {
		t.Fatalf("seed joiner: %v", err)
	}
	creator := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: creatorID}
	joiner := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: joinerID}

	password := "secret99"
	team, err := service.CreateTeam(ctx, creator, "  自服务联队  ", nil, &password)
	if err != nil {
		t.Fatalf("create team: %v", err)
	}
	if team.Name != "自服务联队" || team.CaptainID == nil || *team.CaptainID != creatorID {
		t.Fatalf("unexpected team: %+v", team)
	}
	member, found, err := repository.FindActiveMember(ctx, team.ID, creatorID)
	if err != nil || !found || member.Role != domain.RoleCaptain {
		t.Fatalf("creator should be captain member: %+v found=%v err=%v", member, found, err)
	}

	if _, err := service.CreateTeam(ctx, creator, "自服务联队", nil, nil); errorKind(err) != sharederror.KindConflict {
		t.Fatalf("duplicate name should conflict, got: %v", err)
	}

	requires, err := service.RequiresJoinPassword(ctx, team.ID)
	if err != nil || !requires {
		t.Fatalf("requires password: %v err=%v", requires, err)
	}

	wrong := "wrong"
	if err := service.JoinTeam(ctx, joiner, team.ID, &wrong); errorKind(err) != sharederror.KindValidation {
		t.Fatalf("wrong password should fail validation, got: %v", err)
	}
	if err := service.JoinTeam(ctx, joiner, team.ID, &password); err != nil {
		t.Fatalf("join with correct password: %v", err)
	}
	if err := service.JoinTeam(ctx, joiner, team.ID, &password); errorKind(err) != sharederror.KindConflict {
		t.Fatalf("rejoin should conflict, got: %v", err)
	}

	// 历史 inactive 成员重新加入：恢复 active 而不是报冲突。
	if _, err := pool.Exec(ctx, `UPDATE team_members SET status='inactive' WHERE team_id=$1 AND user_id=$2`, team.ID, joinerID); err != nil {
		t.Fatalf("deactivate joiner: %v", err)
	}
	if err := service.JoinTeam(ctx, joiner, team.ID, &password); err != nil {
		t.Fatalf("rejoin after inactive: %v", err)
	}
	restored, found, err := repository.FindActiveMember(ctx, team.ID, joinerID)
	if err != nil || !found || restored.Role != domain.RoleMember {
		t.Fatalf("restored member: %+v found=%v err=%v", restored, found, err)
	}

	results, err := service.SearchTeams(ctx, "自服务")
	if err != nil || len(results) != 1 || results[0].Team.ID != team.ID || results[0].MemberCount != 2 {
		t.Fatalf("search teams: %+v err=%v", results, err)
	}
}

func TestAppTeamSelfServiceJoinFrozenTeamRejected(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := teampostgres.NewRepository(pool)
	service := NewAppTeamSelfService(repository, teampassword.Bcrypt{})

	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('frozen-join') RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, status) VALUES ('冻结球队', 'frozen') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}

	err := service.JoinTeam(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, teamID, nil)
	if errorKind(err) != sharederror.KindValidation {
		t.Fatalf("frozen team join should fail validation, got: %v", err)
	}
}
