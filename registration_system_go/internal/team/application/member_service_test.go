package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

func TestAdminAddsTeamMember(t *testing.T) {
	repository := &fakeMemberRepository{
		team:  domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		found: true,
	}
	service := NewMemberService(repository)

	result, err := service.Add(context.Background(), adminActor(), 7, 42, domain.RoleLeader)
	if err != nil {
		t.Fatalf("add member: %v", err)
	}
	if repository.addedUserID != 42 || repository.addedRole != domain.RoleLeader {
		t.Fatalf("unexpected add call: user=%d role=%s", repository.addedUserID, repository.addedRole)
	}
	if len(result.Members) != 1 || result.Members[0].UserID != 42 {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestMemberCannotBeAssignedCaptainRoleDirectly(t *testing.T) {
	repository := &fakeMemberRepository{team: domain.Team{ID: 7}, found: true}
	service := NewMemberService(repository)

	_, err := service.Add(context.Background(), adminActor(), 7, 42, domain.RoleCaptain)
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if repository.addedUserID != 0 {
		t.Fatal("repository must not add captain directly")
	}
}

func TestCurrentCaptainCannotBeUpdatedOrRemoved(t *testing.T) {
	captainID := int64(42)
	repository := &fakeMemberRepository{team: domain.Team{ID: 7, CaptainID: &captainID}, found: true}
	service := NewMemberService(repository)

	if _, err := service.Update(context.Background(), adminActor(), 7, captainID, domain.RoleLeader, domain.MemberActive); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected update conflict, got %v", err)
	}
	if _, err := service.Remove(context.Background(), adminActor(), 7, captainID); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected remove conflict, got %v", err)
	}
}

func TestAdminSetsAndClearsCaptain(t *testing.T) {
	repository := &fakeMemberRepository{
		team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, found: true,
		members: []domain.MemberDetails{{Member: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleMember, Status: domain.MemberActive}}},
	}
	service := NewMemberService(repository)
	captainID := int64(42)

	result, err := service.SetCaptain(context.Background(), adminActor(), 7, &captainID)
	if err != nil {
		t.Fatalf("set captain: %v", err)
	}
	if result.Team.CaptainID == nil || *result.Team.CaptainID != captainID || result.Members[0].Role != domain.RoleCaptain {
		t.Fatalf("unexpected captain result: %+v", result)
	}

	result, err = service.SetCaptain(context.Background(), adminActor(), 7, nil)
	if err != nil {
		t.Fatalf("clear captain: %v", err)
	}
	if result.Team.CaptainID != nil || result.Members[0].Role != domain.RoleMember {
		t.Fatalf("unexpected cleared captain result: %+v", result)
	}
}

func TestSetCaptainRejectsInactiveOrMissingMember(t *testing.T) {
	repository := &fakeMemberRepository{team: domain.Team{ID: 7}, found: true, setCaptainErr: ports.ErrMemberNotFound}
	service := NewMemberService(repository)
	captainID := int64(99)

	_, err := service.SetCaptain(context.Background(), adminActor(), 7, &captainID)
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestUserCannotManageTeamMembers(t *testing.T) {
	repository := &fakeMemberRepository{team: domain.Team{ID: 7}, found: true}
	service := NewMemberService(repository)
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}

	if _, err := service.List(context.Background(), actor, 7); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

type fakeMemberRepository struct {
	team          domain.Team
	members       []domain.MemberDetails
	candidates    []domain.MemberCandidate
	found         bool
	addedUserID   int64
	addedRole     domain.Role
	setCaptainErr error
}

func (f *fakeMemberRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.team, f.found, nil
}

func (f *fakeMemberRepository) ListMembers(context.Context, int64) ([]domain.MemberDetails, error) {
	return f.members, nil
}

func (f *fakeMemberRepository) ListMemberCandidates(context.Context, int64, string, int) ([]domain.MemberCandidate, error) {
	return f.candidates, nil
}

func (f *fakeMemberRepository) AddMember(_ context.Context, teamID, userID int64, role domain.Role) error {
	f.addedUserID = userID
	f.addedRole = role
	f.members = append(f.members, domain.MemberDetails{Member: domain.Member{TeamID: teamID, UserID: userID, Role: role, Status: domain.MemberActive}})
	return nil
}

func (f *fakeMemberRepository) UpdateMember(_ context.Context, _, userID int64, role domain.Role, status domain.MemberStatus) (bool, error) {
	for index := range f.members {
		if f.members[index].UserID == userID {
			f.members[index].Role = role
			f.members[index].Status = status
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeMemberRepository) RemoveMember(_ context.Context, _, userID int64) (bool, error) {
	for index := range f.members {
		if f.members[index].UserID == userID {
			f.members = append(f.members[:index], f.members[index+1:]...)
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeMemberRepository) SetCaptain(_ context.Context, _ int64, userID *int64) error {
	if f.setCaptainErr != nil {
		return f.setCaptainErr
	}
	for index := range f.members {
		if f.members[index].Role == domain.RoleCaptain {
			f.members[index].Role = domain.RoleMember
		}
		if userID != nil && f.members[index].UserID == *userID {
			f.members[index].Role = domain.RoleCaptain
		}
	}
	f.team.CaptainID = userID
	return nil
}
