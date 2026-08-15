package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestUserMatchQueryListsMatchesWithBoundedPagination(t *testing.T) {
	repository := &fakeUserMatchRepository{
		items: []ports.MatchItem{{Match: domain.Match{ID: uuid.New(), Name: "周末友谊赛"}, HostTeamName: "东安联队"}},
		total: 1,
	}
	service := NewUserMatchQueryService(repository)

	result, err := service.List(context.Background(), userActor(42), UserMatchListQuery{Page: -1, PageSize: 999})
	if err != nil {
		t.Fatalf("list user matches: %v", err)
	}
	if result.Page != 1 || result.PageSize != 100 || result.Total != 1 || len(result.Items) != 1 {
		t.Fatalf("unexpected list result: %+v", result)
	}
	if repository.filter.Limit != 100 || repository.filter.Offset != 0 {
		t.Fatalf("unexpected repository filter: %+v", repository.filter)
	}
}

func TestUserMatchQueryPassesAllAndMineScopes(t *testing.T) {
	repository := &fakeUserMatchRepository{}
	service := NewUserMatchQueryService(repository)
	status := domain.MatchOngoing

	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{Status: &status, Search: " 友谊 ", Page: 2, PageSize: 10}); err != nil {
		t.Fatal(err)
	}
	if repository.filter.Scope != MatchScopeAll || repository.filter.UserID != 42 || repository.filter.Status != &status || repository.filter.Search != "友谊" || repository.filter.Offset != 10 {
		t.Fatalf("unexpected all filter: %+v", repository.filter)
	}
	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{Scope: MatchScopeMine}); err != nil {
		t.Fatal(err)
	}
	if repository.filter.Scope != MatchScopeMine || repository.filter.UserID != 42 {
		t.Fatalf("unexpected mine filter: %+v", repository.filter)
	}
	startsAfter := time.Date(2026, 8, 20, 8, 0, 0, 0, time.UTC)
	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{Scope: MatchScopeOthers, StartsAfter: &startsAfter}); err != nil {
		t.Fatal(err)
	}
	if repository.filter.Scope != MatchScopeOthers || repository.filter.StartsAfter != &startsAfter {
		t.Fatalf("unexpected others filter: %+v", repository.filter)
	}
	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{Scope: "team"}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected invalid scope validation, got %v", err)
	}
}

func TestUserMatchQueryPassesPublicationModesAndDateFilter(t *testing.T) {
	repository := &fakeUserMatchRepository{}
	service := NewUserMatchQueryService(repository)
	modes := []domain.PublicationMode{domain.OnlineTeam, domain.OnlineIndividual}
	dateStart := time.Date(2026, 8, 21, 16, 0, 0, 0, time.UTC)

	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{PublicationModes: modes, DateStart: &dateStart}); err != nil {
		t.Fatal(err)
	}
	if len(repository.filter.PublicationModes) != 2 ||
		repository.filter.PublicationModes[0] != domain.OnlineTeam ||
		repository.filter.PublicationModes[1] != domain.OnlineIndividual ||
		repository.filter.DateStart == nil || !repository.filter.DateStart.Equal(dateStart) {
		t.Fatalf("unexpected publication filter: %+v", repository.filter)
	}

	if _, err := service.List(context.Background(), userActor(42), UserMatchListQuery{PublicationModes: []domain.PublicationMode{"team"}}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("expected invalid publication mode validation, got %v", err)
	}
}

func TestUserMatchQueryReturnsOnlyCurrentUsersRegistration(t *testing.T) {
	matchID := uuid.New()
	groupID := uuid.New()
	status := domain.RegistrationAttending
	repository := &fakeUserMatchRepository{
		item:  ports.MatchItem{Match: domain.Match{ID: matchID, Name: "散人约球", PublicationMode: domain.OnlineIndividual}},
		found: true,
		groups: []ports.UserGroupState{{
			Group:          domain.RegistrationGroup{ID: groupID, MatchID: matchID, Kind: domain.GroupIndividualOpponent},
			AttendingCount: 7,
			MyRegistration: &domain.Registration{GroupID: groupID, UserID: 42, Status: status, RegistrationCount: 1},
		}},
	}
	service := NewUserMatchQueryService(repository)

	detail, err := service.Get(context.Background(), userActor(42), matchID)
	if err != nil {
		t.Fatalf("get user match: %v", err)
	}
	if repository.userID != 42 || len(detail.Groups) != 1 || detail.Groups[0].AttendingCount != 7 {
		t.Fatalf("unexpected user detail: %+v", detail)
	}
	if detail.Groups[0].MyRegistration == nil || detail.Groups[0].MyRegistration.UserID != 42 {
		t.Fatalf("missing current user registration: %+v", detail.Groups[0])
	}
}

func TestUserMatchQueryRejectsAdminActorAndMissingMatch(t *testing.T) {
	service := NewUserMatchQueryService(&fakeUserMatchRepository{})
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	if _, err := service.List(context.Background(), admin, UserMatchListQuery{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected admin list forbidden, got %v", err)
	}
	if _, err := service.Get(context.Background(), userActor(42), uuid.New()); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected missing match, got %v", err)
	}
}

func TestUserMatchHomeLimitsAndTrimsSections(t *testing.T) {
	ended := make([]ports.MatchItem, 4)
	for index := range ended {
		ended[index] = ports.MatchItem{Match: domain.Match{ID: uuid.New(), Name: "已结束比赛"}}
	}
	actions := make([]ports.HomeMatchItem, 4)
	for index := range actions {
		actions[index] = ports.HomeMatchItem{Item: ports.MatchItem{Match: domain.Match{ID: uuid.New(), Name: "待处理比赛"}}}
	}
	repository := &fakeUserMatchRepository{homeActions: actions, homeEnded: ended}
	service := NewUserMatchQueryService(repository)

	result, err := service.Home(context.Background(), userActor(42))
	if err != nil {
		t.Fatalf("get user match home: %v", err)
	}
	if repository.homeUserID != 42 || repository.homeActionLimit != 4 || repository.homeEndedLimit != 4 {
		t.Fatalf("unexpected home query: user=%d action_limit=%d ended_limit=%d",
			repository.homeUserID, repository.homeActionLimit, repository.homeEndedLimit)
	}
	if len(result.ActionItems) != 3 || !result.ActionHasMore ||
		len(result.EndedItems) != 3 || !result.EndedHasMore {
		t.Fatalf("unexpected home result: %+v", result)
	}
	for index := range result.EndedItems {
		if result.EndedItems[index].Match.ID != ended[index].Match.ID {
			t.Fatalf("ended match order changed at %d", index)
		}
	}
}

func TestUserMatchHomeDoesNotReportMoreForThreeItemsPerSection(t *testing.T) {
	ended := make([]ports.MatchItem, 3)
	repository := &fakeUserMatchRepository{homeEnded: ended}
	service := NewUserMatchQueryService(repository)

	result, err := service.Home(context.Background(), userActor(42))
	if err != nil {
		t.Fatalf("get user match home: %v", err)
	}
	if len(result.EndedItems) != 3 || result.EndedHasMore ||
		len(result.ActionItems) != 0 || result.ActionHasMore {
		t.Fatalf("expected three items per section without more, got %+v", result)
	}
}

func TestUserMatchHomeRejectsAdminActor(t *testing.T) {
	service := NewUserMatchQueryService(&fakeUserMatchRepository{})
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}

	if _, err := service.Home(context.Background(), admin); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected admin home forbidden, got %v", err)
	}
}

type fakeUserMatchRepository struct {
	items           []ports.MatchItem
	total           int64
	item            ports.MatchItem
	groups          []ports.UserGroupState
	found           bool
	filter          ports.MatchListFilter
	userID          int64
	homeActions     []ports.HomeMatchItem
	homeEnded       []ports.MatchItem
	homeUserID      int64
	homeActionLimit int
	homeEndedLimit  int
	err             error
}

func (f *fakeUserMatchRepository) ListForUser(_ context.Context, filter ports.MatchListFilter) ([]ports.MatchItem, error) {
	f.filter = filter
	return f.items, f.err
}

func (f *fakeUserMatchRepository) CountForUser(context.Context, ports.MatchListFilter) (int64, error) {
	return f.total, f.err
}

func (f *fakeUserMatchRepository) FindForUser(_ context.Context, _ uuid.UUID, userID int64) (ports.MatchItem, []ports.UserGroupState, bool, error) {
	f.userID = userID
	return f.item, f.groups, f.found, f.err
}

func (f *fakeUserMatchRepository) ListHomeActionItems(_ context.Context, userID int64, limit int) ([]ports.HomeMatchItem, error) {
	f.homeUserID = userID
	f.homeActionLimit = limit
	return f.homeActions, f.err
}

func (f *fakeUserMatchRepository) ListHomeEndedItems(_ context.Context, userID int64, limit int) ([]ports.MatchItem, error) {
	f.homeUserID = userID
	f.homeEndedLimit = limit
	return f.homeEnded, f.err
}
