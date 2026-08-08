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
	realName := "王睿"
	repository := &fakeAppQueryRepository{
		team: domain.Team{ID: 7, Status: domain.TeamActive}, teamFound: true,
		member: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleMember, Status: domain.MemberActive}, memberFound: true,
		members: []ports.AppMember{{UserID: 42, Nickname: "阿睿", RealName: &realName, Role: domain.RoleMember, Status: domain.MemberActive, JoinedAt: now}},
	}
	items, err := NewAppQueryService(repository).ListMembers(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil || len(items) != 1 || items[0].UserID != 42 || items[0].RealName == nil {
		t.Fatalf("items=%+v err=%v", items, err)
	}
}

type fakeAppQueryRepository struct {
	team        domain.Team
	teamFound   bool
	member      domain.Member
	memberFound bool
	members     []ports.AppMember
	err         error
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
