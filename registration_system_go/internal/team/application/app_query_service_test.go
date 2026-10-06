package application

import (
	"context"
	"errors"
	"testing"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

func TestAppQueryServiceRequiresActiveTeamMembership(t *testing.T) {
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	repository := &fakeAppQueryRepository{
		team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, teamFound: true,
		member: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleLeader, Status: domain.MemberActive}, memberFound: true,
	}
	service := NewAppQueryService(repository)
	detail, err := service.GetTeam(context.Background(), actor, 7)
	if err != nil || detail.MyRole != domain.RoleLeader || detail.Team.ID != 7 {
		t.Fatalf("detail=%+v err=%v", detail, err)
	}

	// 球队详情仅限在队成员；分享落地走独立邀请链路（invite code），不放宽此接口。
	repository.memberFound = false
	if _, err := service.GetTeam(context.Background(), actor, 7); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden non-member, got %v", err)
	}
	if _, err := service.GetTeam(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, 7); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden admin audience, got %v", err)
	}
}

func TestAppQueryServiceHidesMissingAndFrozenTeams(t *testing.T) {
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	repository := &fakeAppQueryRepository{}
	service := NewAppQueryService(repository)
	if _, err := service.GetTeam(context.Background(), actor, 99); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
	repository.team = domain.Team{ID: 7, Status: domain.TeamFrozen}
	repository.teamFound = true
	repository.memberFound = true
	if _, err := service.GetTeam(context.Background(), actor, 7); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected frozen team forbidden, got %v", err)
	}
}

func TestAppQueryServiceReturnsPrivacyMemberProjection(t *testing.T) {
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	rechargeAt := now.Add(-24 * time.Hour)
	realName := "王睿"
	repository := &fakeAppQueryRepository{
		team: domain.Team{ID: 7, Status: domain.TeamActive}, teamFound: true,
		member: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleMember, Status: domain.MemberActive}, memberFound: true,
		members: []ports.AppMember{{
			UserID: 42, Nickname: "阿睿", RealName: &realName, Role: domain.RoleMember, Status: domain.MemberActive, JoinedAt: now,
			BalanceCents: 8800, IsPaidMember: true, LastRechargeAt: &rechargeAt, AttendedCount: 11,
		}},
	}
	service := NewAppQueryService(repository)
	items, err := service.ListMembers(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil || len(items) != 1 || items[0].UserID != 42 || items[0].RealName == nil {
		t.Fatalf("items=%+v err=%v", items, err)
	}
	if items[0].AttendedCount != 11 || items[0].BalanceCents != 0 || !items[0].IsPaidMember || items[0].LastRechargeAt != nil {
		t.Fatalf("普通队员应看到会员标识，但不应看到队费账户信息: %+v", items[0])
	}

	repository.member.Role = domain.RoleCaptain
	items, err = service.ListMembers(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil || len(items) != 1 || items[0].BalanceCents != 8800 || !items[0].IsPaidMember || items[0].LastRechargeAt == nil {
		t.Fatalf("队长应看到队费账户信息: items=%+v err=%v", items, err)
	}
}

type fakeAppQueryRepository struct {
	team         domain.Team
	teamFound    bool
	member       domain.Member
	memberFound  bool
	members      []ports.AppMember
	passwordHash *string
	err          error
}

func (f *fakeAppQueryRepository) FindJoinPasswordHash(context.Context, int64) (*string, bool, error) {
	return f.passwordHash, f.teamFound, f.err
}

func (f *fakeAppQueryRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.team, f.teamFound, f.err
}

func (f *fakeAppQueryRepository) FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error) {
	return f.member, f.memberFound, f.err
}

func (f *fakeAppQueryRepository) ListAppMembers(context.Context, int64) ([]ports.AppMember, error) {
	return f.members, f.err
}

func (f *fakeAppQueryRepository) GetTeamMembershipState(context.Context, int64, int64) (ports.AppMembershipState, error) {
	return ports.AppMembershipState{CreditScore: 90}, nil
}
