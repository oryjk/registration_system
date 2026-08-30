package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	userpostgres "github.com/oryjk/registration_system/registration_system_go/internal/user/adapters/postgres"
	userapplication "github.com/oryjk/registration_system/registration_system_go/internal/user/application"
)

type scoreTestAdminAccess struct{}

func (scoreTestAdminAccess) EnsureSuperAdmin(context.Context, sharedauth.Actor) error { return nil }

// TestMatchScoreRecordingFlow 覆盖比分录入主链路：
// 管理端与管理员用户两条入口、状态约束、身份约束与落库结果。
func TestMatchScoreRecordingFlow(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	matchAdminID := seedMatchUser(t, pool)
	plainUserID := seedMatchUser(t, pool)
	match, groups := newPersistableMatch(t, ownerID, teamID)

	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	clock := repositoryTestClock{now: time.Date(2026, 7, 20, 19, 0, 0, 0, time.UTC)}
	adminMatches := matchapplication.NewAdminMatchService(repository, clock, scoreTestAdminAccess{})
	userRepository := userpostgres.NewRepository(pool)
	appUsers := userapplication.NewAppService(userRepository)
	adminUsers := userapplication.NewAdminUserService(userRepository)
	recordScore := matchapplication.NewRecordMatchScore(repository, appUsers, clock)
	adminActor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	// 报名期不允许录入比分。
	if _, err := adminMatches.RecordScore(ctx, adminActor, match.ID, 1, 0); err == nil {
		t.Fatal("报名期录入比分应被拒绝")
	}
	if _, _, _, err := repository.FindByID(ctx, match.ID); err != nil {
		t.Fatalf("find match: %v", err)
	}

	// 进行中：管理端录入，比赛管理员可修正，普通用户无权。
	if _, err := adminMatches.ChangeStatus(ctx, adminActor, match.ID, domain.MatchOngoing); err != nil {
		t.Fatalf("start match: %v", err)
	}
	if _, err := adminMatches.RecordScore(ctx, adminActor, match.ID, 2, 1); err != nil {
		t.Fatalf("admin record score: %v", err)
	}
	if _, err := recordScore.Execute(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: plainUserID}, match.ID,
		matchapplication.RecordMatchScoreCommand{HostScore: 5, AwayScore: 0}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("非比赛管理员应被拒绝，得到 %v", err)
	}

	// 设置比赛管理员后，可在用户端修正比分。
	if _, err := adminUsers.SetMatchAdmin(ctx, adminActor, matchAdminID, true); err != nil {
		t.Fatalf("set match admin: %v", err)
	}
	if _, err := recordScore.Execute(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: matchAdminID}, match.ID,
		matchapplication.RecordMatchScoreCommand{HostScore: 2, AwayScore: 2}); err != nil {
		t.Fatalf("match admin record score: %v", err)
	}
	found, _, ok, err := repository.FindByID(ctx, match.ID)
	if err != nil || !ok {
		t.Fatalf("reload match: ok=%v err=%v", ok, err)
	}
	if found.HostScore == nil || *found.HostScore != 2 || found.AwayScore == nil || *found.AwayScore != 2 {
		t.Fatalf("比分未正确落库: %+v", found)
	}

	// 结束后仍可补录/修正。
	if _, err := adminMatches.ChangeStatus(ctx, adminActor, match.ID, domain.MatchEnded); err != nil {
		t.Fatalf("end match: %v", err)
	}
	if _, err := recordScore.Execute(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: matchAdminID}, match.ID,
		matchapplication.RecordMatchScoreCommand{HostScore: 3, AwayScore: 2}); err != nil {
		t.Fatalf("ended match correction: %v", err)
	}
	found, _, _, err = repository.FindByID(ctx, match.ID)
	if err != nil || found.HostScore == nil || *found.HostScore != 3 || *found.AwayScore != 2 {
		t.Fatalf("修正后的比分未落库: %+v err=%v", found, err)
	}

	// 取消比赛管理员身份后失去录入权。
	if _, err := adminUsers.SetMatchAdmin(ctx, adminActor, matchAdminID, false); err != nil {
		t.Fatalf("unset match admin: %v", err)
	}
	if _, err := recordScore.Execute(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: matchAdminID}, match.ID,
		matchapplication.RecordMatchScoreCommand{HostScore: 9, AwayScore: 9}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("取消身份后应被拒绝，得到 %v", err)
	}
}
