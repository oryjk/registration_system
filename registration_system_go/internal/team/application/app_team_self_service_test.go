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

// fakeAppTeamSelfRepository 覆盖自服务流程的分支：重名、冻结、成员状态与口令。
type fakeAppTeamSelfRepository struct {
	nameExists     bool
	teamByID       domain.Team
	teamByIDFound  bool
	joinHash       *string
	joinFound      bool
	member         domain.Member
	memberFound    bool
	reactivated    bool
	addMemberErr   error
	createdTeam    domain.Team
	createTeamErr  error
	createdCaptain int64
}

func (f *fakeAppTeamSelfRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.teamByID, f.teamByIDFound, nil
}

func (f *fakeAppTeamSelfRepository) TeamNameExists(context.Context, string) (bool, error) {
	return f.nameExists, nil
}

func (f *fakeAppTeamSelfRepository) CreateWithCaptain(_ context.Context, name string, description, joinPasswordHash *string, captainID int64) (domain.Team, error) {
	if f.createTeamErr != nil {
		return domain.Team{}, f.createTeamErr
	}
	f.createdCaptain = captainID
	f.createdTeam = domain.Team{ID: 7, Name: name, Description: description, CaptainID: &captainID, Status: domain.TeamActive}
	return f.createdTeam, nil
}

func (f *fakeAppTeamSelfRepository) SearchByKeyword(context.Context, string) ([]ports.AppTeamSummary, error) {
	return nil, nil
}

func (f *fakeAppTeamSelfRepository) FindJoinPasswordHash(context.Context, int64) (*string, bool, error) {
	return f.joinHash, f.joinFound, nil
}

func (f *fakeAppTeamSelfRepository) FindMembership(context.Context, int64, int64) (domain.Member, bool, error) {
	return f.member, f.memberFound, nil
}

func (f *fakeAppTeamSelfRepository) AddMember(context.Context, int64, int64, domain.Role) error {
	return f.addMemberErr
}

func (f *fakeAppTeamSelfRepository) ReactivateMember(context.Context, int64, int64) (bool, error) {
	return f.reactivated, nil
}

// plainHasher 测试用口令哈希器：不做加密，直接以明文充当哈希以便断言。
type plainHasher struct{}

func (plainHasher) Hash(password string) (string, error) { return "hashed:" + password, nil }

func (plainHasher) Verify(hash, password string) bool { return hash == "hashed:"+password }

func errorKind(err error) sharederror.Kind {
	var businessError *sharederror.Error
	if errors.As(err, &businessError) {
		return businessError.Kind
	}
	return ""
}

func TestAppTeamSelfServiceCreateTeam(t *testing.T) {
	ctx := context.Background()
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	password := "secret99"

	repository := &fakeAppTeamSelfRepository{}
	team, err := NewAppTeamSelfService(repository, plainHasher{}).CreateTeam(ctx, actor, "  自服务联队  ", nil, &password)
	if err != nil {
		t.Fatalf("create team: %v", err)
	}
	if team.Name != "自服务联队" || repository.createdCaptain != actor.ID {
		t.Fatalf("unexpected team: %+v captain=%d", team, repository.createdCaptain)
	}

	repository = &fakeAppTeamSelfRepository{nameExists: true}
	if _, err := NewAppTeamSelfService(repository, plainHasher{}).CreateTeam(ctx, actor, "自服务联队", nil, nil); errorKind(err) != sharederror.KindConflict {
		t.Fatalf("duplicate name should conflict, got: %v", err)
	}

	// 空口令（空串或 nil）不生成哈希。
	repository = &fakeAppTeamSelfRepository{}
	empty := ""
	if _, err := NewAppTeamSelfService(repository, plainHasher{}).CreateTeam(ctx, actor, "无口令球队", nil, &empty); err != nil {
		t.Fatalf("create without password: %v", err)
	}
	if repository.createdTeam.Description != nil {
		t.Fatalf("empty password must not hash: %+v", repository.createdTeam)
	}
}

func TestAppTeamSelfServiceJoinTeamRules(t *testing.T) {
	ctx := context.Background()
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	activeTeam := domain.Team{ID: 7, Status: domain.TeamActive}
	hash := "hashed:secret99"

	cases := []struct {
		name     string
		repo     *fakeAppTeamSelfRepository
		password *string
		wantKind sharederror.Kind
	}{
		{
			name:     "wrong password",
			repo:     &fakeAppTeamSelfRepository{teamByID: activeTeam, teamByIDFound: true, joinHash: &hash, joinFound: true},
			password: func() *string { wrong := "wrong"; return &wrong }(),
			wantKind: sharederror.KindValidation,
		},
		{
			name:     "already active member",
			repo:     &fakeAppTeamSelfRepository{teamByID: activeTeam, teamByIDFound: true, joinFound: true, member: domain.Member{Status: domain.MemberActive}, memberFound: true},
			password: nil,
			wantKind: sharederror.KindConflict,
		},
		{
			name:     "frozen team",
			repo:     &fakeAppTeamSelfRepository{teamByID: domain.Team{ID: 7, Status: domain.TeamFrozen}, teamByIDFound: true, joinFound: true},
			password: nil,
			wantKind: sharederror.KindValidation,
		},
		{
			name:     "team missing",
			repo:     &fakeAppTeamSelfRepository{},
			password: nil,
			wantKind: sharederror.KindNotFound,
		},
	}
	for _, tc := range cases {
		if err := NewAppTeamSelfService(tc.repo, plainHasher{}).JoinTeam(ctx, actor, 7, tc.password); errorKind(err) != tc.wantKind {
			t.Fatalf("%s: got %v", tc.name, err)
		}
	}

	// 历史 inactive 成员：口令正确时恢复成功，不再走 AddMember。
	correct := "secret99"
	repository := &fakeAppTeamSelfRepository{
		teamByID: activeTeam, teamByIDFound: true,
		joinHash: &hash, joinFound: true,
		member: domain.Member{Status: domain.MemberInactive}, memberFound: true,
		reactivated: true,
	}
	if err := NewAppTeamSelfService(repository, plainHasher{}).JoinTeam(ctx, actor, 7, &correct); err != nil {
		t.Fatalf("rejoin inactive member: %v", err)
	}

	// 无口令球队：直接 AddMember；撞唯一约束映射为冲突。
	repository = &fakeAppTeamSelfRepository{teamByID: activeTeam, teamByIDFound: true, joinFound: true, addMemberErr: ports.ErrMemberAlreadyExists}
	if err := NewAppTeamSelfService(repository, plainHasher{}).JoinTeam(ctx, actor, 7, nil); errorKind(err) != sharederror.KindConflict {
		t.Fatalf("member race should conflict, got: %v", err)
	}
}

func TestAppTeamSelfServiceRequiresJoinPassword(t *testing.T) {
	ctx := context.Background()
	hash := "hashed:secret99"

	withPassword := &fakeAppTeamSelfRepository{joinHash: &hash, joinFound: true}
	requires, err := NewAppTeamSelfService(withPassword, plainHasher{}).RequiresJoinPassword(ctx, 7)
	if err != nil || !requires {
		t.Fatalf("requires password: %v err=%v", requires, err)
	}

	withoutPassword := &fakeAppTeamSelfRepository{joinFound: true}
	requires, err = NewAppTeamSelfService(withoutPassword, plainHasher{}).RequiresJoinPassword(ctx, 7)
	if err != nil || requires {
		t.Fatalf("no password required: %v err=%v", requires, err)
	}

	missing := &fakeAppTeamSelfRepository{}
	if _, err := NewAppTeamSelfService(missing, plainHasher{}).RequiresJoinPassword(ctx, 7); errorKind(err) != sharederror.KindNotFound {
		t.Fatalf("missing team should 404, got: %v", err)
	}
}
