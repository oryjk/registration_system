package application

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeUserMatchUpdateRepository struct {
	match     domain.Match
	groups    []domain.RegistrationGroup
	found     bool
	updated   domain.Match
	updatedGp *domain.RegistrationGroup
	updateErr error
}

func (f *fakeUserMatchUpdateRepository) FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error) {
	return f.match, f.groups, f.found, nil
}

func (f *fakeUserMatchUpdateRepository) UpdateDetails(_ context.Context, match domain.Match, group *domain.RegistrationGroup) error {
	if f.updateErr != nil {
		return f.updateErr
	}
	f.updated = match
	f.updatedGp = group
	return nil
}

type fakeUserMatchAuthorizer struct {
	allowed map[int64]bool
}

func (f fakeUserMatchAuthorizer) EnsureManager(_ context.Context, teamID, userID int64) error {
	if f.allowed[userID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func newUpdateTestMatch() (domain.Match, []domain.RegistrationGroup) {
	teamID := int64(7)
	start := time.Date(2026, 9, 1, 18, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "周末约球", PublicationMode: domain.OfflineConfirmed, HostTeamID: &teamID, CreatedByUserID: userIDPtr(42),
		PlayersPerTeam: 8, StartTime: start, EndTime: end, Location: "东安球场",
		OpponentName: stringPointer("红星队"),
	}, domain.IndividualLimits{})
	if err != nil {
		panic(err)
	}
	return match, groups
}

func TestUserUpdateMatchDetailsRules(t *testing.T) {
	match, groups := newUpdateTestMatch()
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	authorizer := fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}

	cases := []struct {
		name    string
		found   bool
		command UserUpdateMatchCommand
		wantErr string
	}{
		{"empty command", true, UserUpdateMatchCommand{}, "没有要修改的内容"},
		{"match missing", false, UserUpdateMatchCommand{OpponentName: stringPointer("x")}, "比赛不存在"},
		{"match not editable pickup", true, UserUpdateMatchCommand{HostCapacityLimit: updateTestIntPointer(10)}, ""},
		{"capacity must be positive", true, UserUpdateMatchCommand{HostCapacityLimit: updateTestIntPointer(0)}, "上限必须大于 0"},
	}
	for _, testCase := range cases {
		repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: testCase.found}
		service := NewUserMatchUpdateService(repository, authorizer, time.Now)
		_, err := service.UpdateDetails(context.Background(), actor, match.ID, testCase.command)
		if testCase.wantErr == "" {
			if err != nil {
				t.Fatalf("%s: 不应报错，得到 %v", testCase.name, err)
			}
			continue
		}
		if err == nil || !strings.Contains(err.Error(), testCase.wantErr) {
			t.Fatalf("%s: 期望错误含 %q，得到 %v", testCase.name, testCase.wantErr, err)
		}
	}
}

func TestUserUpdateMatchDetailsUpdatesSchedule(t *testing.T) {
	match, groups := newUpdateTestMatch()
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	authorizer := fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}

	newStart := time.Date(2026, 9, 6, 16, 30, 0, 0, time.UTC)
	newEnd := newStart.Add(90 * time.Minute)
	repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: true}
	service := NewUserMatchUpdateService(repository, authorizer, time.Now)

	updated, err := service.UpdateDetails(context.Background(), actor, match.ID,
		UserUpdateMatchCommand{StartTime: &newStart, EndTime: &newEnd})
	if err != nil {
		t.Fatalf("仅更新起止时间应成功: %v", err)
	}
	if !updated.StartTime.Equal(newStart) || !updated.EndTime.Equal(newEnd) {
		t.Fatalf("起止时间应更新: got %s-%s", updated.StartTime, updated.EndTime)
	}
	if repository.updated.OpponentName == nil || *repository.updated.OpponentName != "红星队" {
		t.Fatalf("未提交的字段应保持原值: %+v", repository.updated.OpponentName)
	}
	if repository.updatedGp != nil {
		t.Fatalf("未提交人数上限时不应更新报名组: %+v", repository.updatedGp)
	}
}

func TestUserUpdateMatchDetailsScheduleRules(t *testing.T) {
	match, groups := newUpdateTestMatch()
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	authorizer := fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}
	now := time.Date(2026, 9, 4, 12, 0, 0, 0, time.UTC)

	newStart := match.StartTime.Add(24 * time.Hour)
	endBeforeStart := newStart.Add(-time.Hour)
	pastStart := now.Add(-2 * time.Hour)
	pastEnd := pastStart.Add(time.Hour)

	cases := []struct {
		name    string
		command UserUpdateMatchCommand
		wantErr string
	}{
		{"end must be after start", UserUpdateMatchCommand{StartTime: &newStart, EndTime: &endBeforeStart}, "结束时间必须晚于开始时间"},
		{"past schedule is allowed", UserUpdateMatchCommand{StartTime: &pastStart, EndTime: &pastEnd}, ""},
	}
	for _, testCase := range cases {
		repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: true}
		service := NewUserMatchUpdateService(repository, authorizer, func() time.Time { return now })
		_, err := service.UpdateDetails(context.Background(), actor, match.ID, testCase.command)
		if testCase.wantErr == "" {
			if err != nil {
				t.Fatalf("%s: 不应报错，得到 %v", testCase.name, err)
			}
			continue
		}
		if err == nil || !strings.Contains(err.Error(), testCase.wantErr) {
			t.Fatalf("%s: 期望错误含 %q，得到 %v", testCase.name, testCase.wantErr, err)
		}
	}
}

func TestUserUpdateMatchDetailsRequiresHostManager(t *testing.T) {
	match, groups := newUpdateTestMatch()
	repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: true}
	service := NewUserMatchUpdateService(repository, fakeUserMatchAuthorizer{}, time.Now)

	if _, err := service.UpdateDetails(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 9}, match.ID, UserUpdateMatchCommand{OpponentName: stringPointer("新对手")}); err == nil {
		t.Fatal("非主队管理者应被拒绝")
	}
}

func TestUserUpdateMatchDetailsAppliesFields(t *testing.T) {
	match, groups := newUpdateTestMatch()
	repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: true}
	service := NewUserMatchUpdateService(repository, fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}, time.Now)

	updated, err := service.UpdateDetails(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID,
		UserUpdateMatchCommand{OpponentName: stringPointer("新对手联"), HostCapacityLimit: updateTestIntPointer(12)})
	if err != nil {
		t.Fatalf("更新应成功: %v", err)
	}
	if updated.OpponentName == nil || *updated.OpponentName != "新对手联" {
		t.Fatalf("对手名称应更新: %+v", updated.OpponentName)
	}
	if repository.updatedGp == nil || repository.updatedGp.MaxPlayers == nil || *repository.updatedGp.MaxPlayers != 12 {
		t.Fatalf("主队组上限应更新为 12: %+v", repository.updatedGp)
	}
	if repository.updated.Name != match.Name || !repository.updated.StartTime.Equal(match.StartTime) {
		t.Fatalf("其余字段应保持原值: %+v", repository.updated)
	}
}

func TestUserUpdateMatchRejectsMatchWithoutHost(t *testing.T) {
	start := time.Date(2026, 9, 1, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "散人约球", PublicationMode: domain.OnlinePickup, CreatedByUserID: userIDPtr(42),
		PlayersPerTeam: 6, StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "东安球场",
	}, domain.IndividualLimits{MinPlayers: 4, MaxPlayers: 12})
	if err != nil {
		t.Fatal(err)
	}
	repository := &fakeUserMatchUpdateRepository{match: match, groups: groups, found: true}
	service := NewUserMatchUpdateService(repository, fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}, time.Now)

	_, err = service.UpdateDetails(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID, UserUpdateMatchCommand{HostCapacityLimit: updateTestIntPointer(10)})
	if err == nil || !strings.Contains(err.Error(), "没有主队") {
		t.Fatalf("无主队比赛应被拒绝: %v", err)
	}
}

func stringPointer(value string) *string { return &value }

func updateTestIntPointer(value int) *int { return &value }

func userIDPtr(value int64) *int64 { return &value }
