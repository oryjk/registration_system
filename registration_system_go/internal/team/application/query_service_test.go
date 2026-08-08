package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestEnsureManagerAllowsCaptainAndLeaderOnly(t *testing.T) {
	tests := []struct {
		name    string
		role    domain.Role
		wantErr bool
	}{
		{name: "captain", role: domain.RoleCaptain},
		{name: "leader", role: domain.RoleLeader},
		{name: "vice captain", role: domain.RoleViceCaptain, wantErr: true},
		{name: "member", role: domain.RoleMember, wantErr: true},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := &fakeTeamRepository{membership: domain.Member{TeamID: 10, UserID: int64(index + 1), Role: test.role, Status: domain.MemberActive}}
			service := NewQueryService(repository)
			err := service.EnsureManager(context.Background(), 10, int64(index+1))
			if test.wantErr && err == nil {
				t.Fatal("expected forbidden error")
			}
			if !test.wantErr && err != nil {
				t.Fatalf("expected manager role to pass, got %v", err)
			}
		})
	}
}

func TestEnsureManagerRejectsMissingMembership(t *testing.T) {
	service := NewQueryService(&fakeTeamRepository{found: false})
	if err := service.EnsureManager(context.Background(), 10, 99); err == nil {
		t.Fatal("expected missing membership to fail")
	}
}

func TestActiveMembershipQueries(t *testing.T) {
	active := &fakeTeamRepository{membership: domain.Member{TeamID: 10, UserID: 42, Status: domain.MemberActive}}
	service := NewQueryService(active)
	if err := service.EnsureActiveMember(context.Background(), 10, 42); err != nil {
		t.Fatalf("ensure active member: %v", err)
	}
	found, err := service.IsActiveMember(context.Background(), 10, 42)
	if err != nil || !found {
		t.Fatalf("is active member: found=%v err=%v", found, err)
	}

	missingService := NewQueryService(&fakeTeamRepository{})
	if err := missingService.EnsureActiveMember(context.Background(), 10, 42); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("missing member should be forbidden, got %v", err)
	}
	found, err = missingService.IsActiveMember(context.Background(), 10, 42)
	if err != nil || found {
		t.Fatalf("missing member should return false: found=%v err=%v", found, err)
	}
}

func TestActiveMembershipQueryWrapsRepositoryFailure(t *testing.T) {
	service := NewQueryService(&fakeTeamRepository{err: errors.New("database unavailable")})
	if _, err := service.IsActiveMember(context.Background(), 10, 42); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("expected internal error, got %v", err)
	}
}

func TestAdminListsAllTeams(t *testing.T) {
	repository := &fakeTeamRepository{teams: []domain.Team{
		{ID: 1, Name: "东安联队", Status: domain.TeamActive},
		{ID: 2, Name: "西城联队", Status: domain.TeamFrozen},
	}}
	service := NewQueryService(repository)

	items, err := service.ListTeams(context.Background(), adminActor(), nil)
	if err != nil {
		t.Fatalf("list teams: %v", err)
	}
	if len(items) != 2 || repository.listStatus != nil {
		t.Fatalf("unexpected teams or filter: items=%+v status=%v", items, repository.listStatus)
	}
}

func TestAdminUpdatesTeam(t *testing.T) {
	repository := &fakeTeamRepository{team: domain.Team{ID: 7, Name: "旧队名", Status: domain.TeamActive}, found: true}
	service := NewQueryService(repository)
	description := "新的球队简介"

	updated, err := service.UpdateTeam(context.Background(), adminActor(), 7, " 新队名 ", &description, domain.TeamFrozen)
	if err != nil {
		t.Fatalf("update team: %v", err)
	}
	if updated.Name != "新队名" || updated.Status != domain.TeamFrozen || repository.updated.ID != 7 {
		t.Fatalf("unexpected updated team: %+v, persisted=%+v", updated, repository.updated)
	}
}

func TestUserCannotUpdateTeam(t *testing.T) {
	repository := &fakeTeamRepository{team: domain.Team{ID: 7, Name: "旧队名", Status: domain.TeamActive}, found: true}
	service := NewQueryService(repository)

	_, err := service.UpdateTeam(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7, "新队名", nil, domain.TeamActive)
	if !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if repository.updated.ID != 0 {
		t.Fatal("repository update must not run")
	}
}

func TestAdminCannotDeleteTeamUsedByBusinessData(t *testing.T) {
	repository := &fakeTeamRepository{deleteErr: sharederror.ErrConflict}
	service := NewQueryService(repository)

	err := service.DeleteTeam(context.Background(), adminActor(), 7)
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
}

func TestAdminDeleteRejectsMissingTeam(t *testing.T) {
	service := NewQueryService(&fakeTeamRepository{})

	err := service.DeleteTeam(context.Background(), adminActor(), 99)
	if !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func adminActor() sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}
}

type fakeTeamRepository struct {
	membership domain.Member
	team       domain.Team
	teams      []domain.Team
	updated    domain.Team
	found      bool
	err        error
	deleteErr  error
	listStatus *domain.TeamStatus
}

func (f *fakeTeamRepository) FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error) {
	if f.err != nil {
		return domain.Member{}, false, f.err
	}
	if !f.found && f.membership.UserID == 0 {
		return domain.Member{}, false, nil
	}
	return f.membership, true, nil
}

func (f *fakeTeamRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.team, f.found, f.err
}

func (f *fakeTeamRepository) ListByUser(context.Context, int64) ([]domain.TeamMembership, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeTeamRepository) List(_ context.Context, status *domain.TeamStatus) ([]domain.Team, error) {
	f.listStatus = status
	return f.teams, f.err
}

func (f *fakeTeamRepository) Create(context.Context, domain.Team) (domain.Team, error) {
	return domain.Team{}, errors.New("not implemented")
}

func (f *fakeTeamRepository) Update(_ context.Context, team domain.Team) (domain.Team, error) {
	f.updated = team
	return team, f.err
}

func (f *fakeTeamRepository) Delete(context.Context, int64) (bool, error) {
	if f.deleteErr != nil {
		return false, f.deleteErr
	}
	return f.found, nil
}
