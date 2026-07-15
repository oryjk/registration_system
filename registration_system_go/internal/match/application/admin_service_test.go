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

func TestAdminListMatchesReturnsPage(t *testing.T) {
	repository := &fakeAdminMatchRepository{
		items: []ports.AdminMatchItem{{Match: domain.Match{ID: uuid.New(), Name: "周末比赛"}, HostTeamName: "城北联队"}},
		total: 1,
	}
	service := NewAdminMatchService(repository, fixedClock())

	result, err := service.List(context.Background(), adminActor(3), AdminMatchListQuery{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("list matches: %v", err)
	}
	if result.Total != 1 || len(result.Items) != 1 {
		t.Fatalf("unexpected list result: %+v", result)
	}
}

func TestAdminListMatchesRejectsUser(t *testing.T) {
	service := NewAdminMatchService(&fakeAdminMatchRepository{}, fixedClock())
	if _, err := service.List(context.Background(), userActor(2), AdminMatchListQuery{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestAdminChangesMatchStatus(t *testing.T) {
	id := uuid.New()
	repository := &fakeAdminMatchRepository{match: domain.Match{ID: id, Status: domain.MatchRegistering}, found: true}
	service := NewAdminMatchService(repository, fixedClock())

	match, err := service.ChangeStatus(context.Background(), adminActor(3), id, domain.MatchOngoing)
	if err != nil {
		t.Fatalf("change status: %v", err)
	}
	if match.Status != domain.MatchOngoing || repository.updatedStatus.Status != domain.MatchOngoing {
		t.Fatalf("unexpected status update: %+v", match)
	}
}

type fakeAdminMatchRepository struct {
	match          domain.Match
	groups         []domain.RegistrationGroup
	item           ports.AdminMatchItem
	items          []ports.AdminMatchItem
	total          int64
	found          bool
	updatedDetails domain.Match
	updatedStatus  domain.Match
}

func (f *fakeAdminMatchRepository) CreateWithGroups(_ context.Context, match domain.Match, groups []domain.RegistrationGroup) error {
	f.match, f.groups, f.found = match, groups, true
	return nil
}

func (f *fakeAdminMatchRepository) FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error) {
	return f.match, f.groups, f.found, nil
}

func (f *fakeAdminMatchRepository) FindForAdmin(context.Context, uuid.UUID) (ports.AdminMatchItem, []domain.RegistrationGroup, bool, error) {
	item := f.item
	if item.Match.ID == uuid.Nil {
		item.Match = f.match
	}
	return item, f.groups, f.found, nil
}

func (f *fakeAdminMatchRepository) ListForAdmin(context.Context, ports.AdminMatchFilter) ([]ports.AdminMatchItem, error) {
	return f.items, nil
}

func (f *fakeAdminMatchRepository) CountForAdmin(context.Context, ports.AdminMatchFilter) (int64, error) {
	return f.total, nil
}

func (f *fakeAdminMatchRepository) UpdateDetails(_ context.Context, match domain.Match) error {
	f.updatedDetails = match
	return nil
}

func (f *fakeAdminMatchRepository) UpdateStatus(_ context.Context, match domain.Match) error {
	f.updatedStatus = match
	return nil
}

func adminActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: id, IsSuperAdmin: true}
}
