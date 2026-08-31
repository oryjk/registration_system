package application

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func newInviteTestService(now time.Time, repo AppTeamInviteRepository) *AppInviteService {
	service := NewAppInviteService(repo, []byte("test-secret"))
	service.now = func() time.Time { return now }
	return service
}

func inviteTestRepository() *fakeAppQueryRepository {
	hash := "$2a$10$examplehash"
	return &fakeAppQueryRepository{
		team:         domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		teamFound:    true,
		member:       domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleCaptain, Status: domain.MemberActive},
		memberFound:  true,
		passwordHash: &hash,
	}
}

func TestAppInviteServiceIssuesMemberOnlyCodes(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	repository := inviteTestRepository()
	service := newInviteTestService(now, repository)

	code, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil || code == "" {
		t.Fatalf("code=%q err=%v", code, err)
	}

	// 非成员、普通队员与非用户受众都不能签发（拉新仅队长/领队）。
	repository.memberFound = false
	if _, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7); !isForbidden(err) {
		t.Fatalf("expected forbidden non-member issue, got %v", err)
	}
	repository.memberFound = true
	repository.member = domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleMember, Status: domain.MemberActive}
	if _, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7); !isForbidden(err) {
		t.Fatalf("expected forbidden ordinary member issue, got %v", err)
	}
	repository.member = domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleCaptain, Status: domain.MemberActive}
	if _, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, 7); !isForbidden(err) {
		t.Fatalf("expected forbidden admin issue, got %v", err)
	}
}

func TestAppInviteServiceResolvesValidCode(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	repository := inviteTestRepository()
	service := newInviteTestService(now, repository)

	code, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatalf("issue err=%v", err)
	}

	// 非成员凭有效邀请码可以解析球队公开信息。
	repository.memberFound = false
	view, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, code)
	if err != nil || view.TeamID != 7 || view.Name != "东安联队" || !view.RequiresPassword || view.IsMember {
		t.Fatalf("view=%+v err=%v", view, err)
	}

	// 已是成员时标记 is_member，前端引导返回而非重复加入。
	repository.memberFound = true
	repository.member.UserID = 99
	view, err = service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, code)
	if err != nil || !view.IsMember {
		t.Fatalf("member view=%+v err=%v", view, err)
	}
}

func TestAppInviteServiceRejectsExpiredAndTamperedCodes(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	repository := inviteTestRepository()
	service := newInviteTestService(now, repository)

	code, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatalf("issue err=%v", err)
	}

	// 超过 7 天过期。
	later := newInviteTestService(now.Add(AppTeamInviteTTL+time.Second), repository)
	if _, err := later.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, code); !isForbidden(err) {
		t.Fatalf("expected expired forbidden, got %v", err)
	}

	// 篡改 teamID / 签名 / 用别的密钥签发的码都无效。
	parts := strings.Split(code, ".")
	tampered := fmt.Sprintf("8.%s.%s", parts[1], parts[2])
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, tampered); !isForbidden(err) {
		t.Fatalf("expected tampered team forbidden, got %v", err)
	}
	otherKey := NewAppInviteService(repository, []byte("other-secret"))
	otherKey.now = func() time.Time { return now }
	forged, _, err := otherKey.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatalf("forged issue err=%v", err)
	}
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, forged); !isForbidden(err) {
		t.Fatalf("expected forged forbidden, got %v", err)
	}

	// 空码 / 格式错误。
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, ""); !isForbidden(err) {
		t.Fatalf("expected empty forbidden, got %v", err)
	}
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, "not-a-code"); !isForbidden(err) {
		t.Fatalf("expected malformed forbidden, got %v", err)
	}
}

func TestAppInviteServiceHidesMissingAndFrozenTeams(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	repository := inviteTestRepository()
	service := newInviteTestService(now, repository)

	code, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatalf("issue err=%v", err)
	}

	repository.teamFound = false
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, code); !isNotFound(err) {
		t.Fatalf("expected not found, got %v", err)
	}
	repository.teamFound = true
	repository.team = domain.Team{ID: 7, Status: domain.TeamFrozen}
	if _, err := service.Resolve(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, code); !isForbidden(err) {
		t.Fatalf("expected frozen forbidden, got %v", err)
	}
}

// 码内签名是 base64url 的 HMAC，格式稳定性测试防止无意变更编码方式。
func TestAppInviteCodeFormat(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	service := newInviteTestService(now, inviteTestRepository())
	code, _, err := service.Issue(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatalf("issue err=%v", err)
	}
	parts := strings.Split(code, ".")
	if len(parts) != 3 {
		t.Fatalf("expected 3 segments, got %q", code)
	}
	if parts[0] != "7" {
		t.Fatalf("expected team id segment, got %q", parts[0])
	}
	if _, err := base64.RawURLEncoding.DecodeString(parts[2]); err != nil {
		t.Fatalf("signature not base64url: %v", err)
	}
}

func isForbidden(err error) bool {
	return errors.Is(err, sharederror.ErrForbidden)
}

func isNotFound(err error) bool {
	return errors.Is(err, sharederror.ErrNotFound)
}
