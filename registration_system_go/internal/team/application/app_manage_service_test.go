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

func managerActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func TestCaptainAndLeaderCanManageTeam(t *testing.T) {
	for _, role := range []domain.Role{domain.RoleCaptain, domain.RoleLeader} {
		repository := &fakeAppManageRepository{
			team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, teamFound: true,
			manager:      domain.Member{TeamID: 7, UserID: 42, Role: role, Status: domain.MemberActive},
			managerFound: true,
		}
		service := NewAppManageService(repository)
		name := "  东安联队二队  "
		if err := service.UpdateProfile(context.Background(), managerActor(42), 7, &name, nil, nil); err != nil {
			t.Fatalf("role %s should manage team: %v", role, err)
		}
		if repository.updatedProfile.Name != "东安联队二队" {
			t.Fatalf("role %s: name not normalized: %+v", role, repository.updatedProfile)
		}
	}
}

func TestNonManagersCannotManageTeam(t *testing.T) {
	cases := []struct {
		name         string
		actor        sharedauth.Actor
		manager      domain.Member
		managerFound bool
	}{
		{name: "普通队员", actor: managerActor(9), manager: domain.Member{UserID: 9, Role: domain.RoleMember, Status: domain.MemberActive}, managerFound: true},
		{name: "副队长", actor: managerActor(9), manager: domain.Member{UserID: 9, Role: domain.RoleViceCaptain, Status: domain.MemberActive}, managerFound: true},
		{name: "离队队长", actor: managerActor(9), manager: domain.Member{UserID: 9, Role: domain.RoleCaptain, Status: domain.MemberInactive}, managerFound: false},
		{name: "非成员", actor: managerActor(9)},
		{name: "admin actor", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			repository := &fakeAppManageRepository{
				team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, teamFound: true,
				manager: test.manager, managerFound: test.managerFound,
			}
			service := NewAppManageService(repository)
			name := "新名字"
			if err := service.UpdateProfile(context.Background(), test.actor, 7, &name, nil, nil); !errors.Is(err, sharederror.ErrForbidden) {
				t.Fatalf("update profile: expected forbidden, got %v", err)
			}
			if err := service.AddMember(context.Background(), test.actor, 7, 50, domain.RoleMember); !errors.Is(err, sharederror.ErrForbidden) {
				t.Fatalf("add member: expected forbidden, got %v", err)
			}
			if err := service.RemoveMember(context.Background(), test.actor, 7, 50); !errors.Is(err, sharederror.ErrForbidden) {
				t.Fatalf("remove member: expected forbidden, got %v", err)
			}
			if repository.profileUpdated || repository.addedUserID != 0 || repository.removedUserID != 0 {
				t.Fatalf("repository must not be touched: %+v", repository)
			}
		})
	}
}

func TestUpdateProfileValidatesNameAndClearsOptionalFields(t *testing.T) {
	newRepository := func() *fakeAppManageRepository {
		return &fakeAppManageRepository{
			team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, teamFound: true,
			manager: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleCaptain, Status: domain.MemberActive}, managerFound: true,
		}
	}
	service := NewAppManageService(newRepository())

	empty := ""
	if err := service.UpdateProfile(context.Background(), managerActor(42), 7, &empty, nil, nil); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation for empty name, got %v", err)
	}
	tooLong := make([]rune, 121)
	for i := range tooLong {
		tooLong[i] = '队'
	}
	longName := string(tooLong)
	if err := service.UpdateProfile(context.Background(), managerActor(42), 7, &longName, nil, nil); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected validation for long name, got %v", err)
	}

	repository := newRepository()
	service = NewAppManageService(repository)
	description := "  "
	logo := ""
	if err := service.UpdateProfile(context.Background(), managerActor(42), 7, nil, &description, &logo); err != nil {
		t.Fatalf("clear optional fields: %v", err)
	}
	if repository.updatedProfile.Name != "东安联队" {
		t.Fatalf("name must stay unchanged: %+v", repository.updatedProfile)
	}
	if repository.updatedProfile.Description != nil || repository.updatedProfile.LogoURL != nil {
		t.Fatalf("blank description/logo must be cleared: %+v", repository.updatedProfile)
	}
	if repository.updatedProfile.Status != domain.TeamActive {
		t.Fatalf("status must not change: %+v", repository.updatedProfile)
	}
}

func TestAppAddMemberRules(t *testing.T) {
	newRepository := func() *fakeAppManageRepository {
		return &fakeAppManageRepository{
			team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive}, teamFound: true,
			manager: domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleLeader, Status: domain.MemberActive}, managerFound: true,
			activeUser: true,
		}
	}

	repository := newRepository()
	service := NewAppManageService(repository)
	if err := service.AddMember(context.Background(), managerActor(42), 7, 50, domain.RoleViceCaptain); err != nil {
		t.Fatalf("add member: %v", err)
	}
	if repository.addedUserID != 50 || repository.addedRole != domain.RoleViceCaptain {
		t.Fatalf("unexpected add call: user=%d role=%s", repository.addedUserID, repository.addedRole)
	}

	if err := service.AddMember(context.Background(), managerActor(42), 7, 50, domain.RoleCaptain); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("captain role must be rejected, got %v", err)
	}
	if err := service.AddMember(context.Background(), managerActor(42), 7, 0, domain.RoleMember); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid user must be rejected, got %v", err)
	}

	inactiveUserRepository := newRepository()
	inactiveUserRepository.activeUser = false
	service = NewAppManageService(inactiveUserRepository)
	if err := service.AddMember(context.Background(), managerActor(42), 7, 50, domain.RoleMember); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("inactive user must be rejected, got %v", err)
	}

	existingRepository := newRepository()
	existingRepository.addErr = ports.ErrMemberAlreadyExists
	service = NewAppManageService(existingRepository)
	if err := service.AddMember(context.Background(), managerActor(42), 7, 50, domain.RoleMember); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("existing member must conflict, got %v", err)
	}
}

func TestAppUpdateMemberRules(t *testing.T) {
	captainID := int64(42)
	newRepository := func() *fakeAppManageRepository {
		return &fakeAppManageRepository{
			team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive, CaptainID: &captainID}, teamFound: true,
			manager:      domain.Member{TeamID: 7, UserID: captainID, Role: domain.RoleCaptain, Status: domain.MemberActive},
			managerFound: true,
			member:       domain.Member{TeamID: 7, UserID: 50, Role: domain.RoleMember, Status: domain.MemberActive},
			memberFound:  true,
		}
	}

	repository := newRepository()
	service := NewAppManageService(repository)
	leader := domain.RoleLeader
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 50, &leader, nil); err != nil {
		t.Fatalf("update role only: %v", err)
	}
	if repository.updatedRole != domain.RoleLeader || repository.updatedStatus != domain.MemberActive {
		t.Fatalf("unexpected update: role=%s status=%s", repository.updatedRole, repository.updatedStatus)
	}

	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 50, nil, nil); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("empty patch must be rejected, got %v", err)
	}
	captainRole := domain.RoleCaptain
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 50, &captainRole, nil); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("captain role must be rejected, got %v", err)
	}
	invalidStatus := domain.MemberStatus("banned")
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 50, nil, &invalidStatus); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid status must be rejected, got %v", err)
	}
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, captainID, &leader, nil); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("captain himself must conflict, got %v", err)
	}
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 99, &leader, nil); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("missing member must be not found, got %v", err)
	}

	inactive := domain.MemberInactive
	repository = newRepository()
	service = NewAppManageService(repository)
	if err := service.UpdateMember(context.Background(), managerActor(captainID), 7, 50, nil, &inactive); err != nil {
		t.Fatalf("update status only: %v", err)
	}
	if repository.updatedRole != domain.RoleMember || repository.updatedStatus != domain.MemberInactive {
		t.Fatalf("unexpected status-only update: role=%s status=%s", repository.updatedRole, repository.updatedStatus)
	}
}

func TestAppRemoveMemberRules(t *testing.T) {
	captainID := int64(42)
	repository := &fakeAppManageRepository{
		team: domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive, CaptainID: &captainID}, teamFound: true,
		manager:      domain.Member{TeamID: 7, UserID: captainID, Role: domain.RoleCaptain, Status: domain.MemberActive},
		managerFound: true,
	}
	service := NewAppManageService(repository)

	if err := service.RemoveMember(context.Background(), managerActor(captainID), 7, captainID); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("captain himself must conflict, got %v", err)
	}
	if err := service.RemoveMember(context.Background(), managerActor(captainID), 7, 99); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("missing member must be not found, got %v", err)
	}
	if err := service.RemoveMember(context.Background(), managerActor(captainID), 7, 50); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	if repository.removedUserID != 50 {
		t.Fatalf("unexpected remove call: %d", repository.removedUserID)
	}
}

type fakeAppManageRepository struct {
	team           domain.Team
	teamFound      bool
	manager        domain.Member
	managerFound   bool
	member         domain.Member
	memberFound    bool
	activeUser     bool
	addErr         error
	profileUpdated bool
	updatedProfile domain.Team
	addedUserID    int64
	addedRole      domain.Role
	updatedRole    domain.Role
	updatedStatus  domain.MemberStatus
	removedUserID  int64
}

func (f *fakeAppManageRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.team, f.teamFound, nil
}

func (f *fakeAppManageRepository) FindActiveMember(_ context.Context, _, userID int64) (domain.Member, bool, error) {
	if f.managerFound && f.manager.UserID == userID {
		return f.manager, true, nil
	}
	return domain.Member{}, false, nil
}

func (f *fakeAppManageRepository) FindMembership(_ context.Context, _, userID int64) (domain.Member, bool, error) {
	if f.memberFound && f.member.UserID == userID {
		return f.member, true, nil
	}
	return domain.Member{}, false, nil
}

func (f *fakeAppManageRepository) ActiveUserExists(context.Context, int64) (bool, error) {
	return f.activeUser, nil
}

func (f *fakeAppManageRepository) UpdateTeamProfile(_ context.Context, team domain.Team) (domain.Team, error) {
	f.profileUpdated = true
	f.updatedProfile = team
	return team, nil
}

func (f *fakeAppManageRepository) AddMember(_ context.Context, _, userID int64, role domain.Role) error {
	if f.addErr != nil {
		return f.addErr
	}
	f.addedUserID = userID
	f.addedRole = role
	return nil
}

func (f *fakeAppManageRepository) UpdateMember(_ context.Context, _, userID int64, role domain.Role, status domain.MemberStatus) (bool, error) {
	if !f.memberFound || f.member.UserID != userID {
		return false, nil
	}
	f.updatedRole = role
	f.updatedStatus = status
	return true, nil
}

func (f *fakeAppManageRepository) RemoveMember(_ context.Context, _, userID int64) (bool, error) {
	if userID == 50 {
		f.removedUserID = userID
		return true, nil
	}
	return false, nil
}
