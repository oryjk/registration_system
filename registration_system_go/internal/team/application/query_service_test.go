package application

import (
	"context"
	"errors"
	"testing"

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

type fakeTeamRepository struct {
	membership domain.Member
	found      bool
	err        error
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
	return domain.Team{}, false, errors.New("not implemented")
}

func (f *fakeTeamRepository) ListByUser(context.Context, int64) ([]domain.TeamMembership, error) {
	return nil, errors.New("not implemented")
}
