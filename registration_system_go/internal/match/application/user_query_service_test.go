package application

import (
	"context"
	"errors"
	"testing"

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

type fakeUserMatchRepository struct {
	items  []ports.MatchItem
	total  int64
	item   ports.MatchItem
	groups []ports.UserGroupState
	found  bool
	filter ports.MatchListFilter
	userID int64
	err    error
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
