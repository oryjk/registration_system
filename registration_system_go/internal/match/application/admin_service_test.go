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

func TestAdminListMatchesReturnsPage(t *testing.T) {
	repository := &fakeAdminMatchRepository{
		items: []ports.AdminMatchItem{{Match: domain.Match{ID: uuid.New(), Name: "周末比赛"}, HostTeamName: "城北联队"}},
		total: 1,
	}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	result, err := service.List(context.Background(), adminActor(3), AdminMatchListQuery{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("list matches: %v", err)
	}
	if result.Total != 1 || len(result.Items) != 1 {
		t.Fatalf("unexpected list result: %+v", result)
	}
}

func TestAdminListMatchesRejectsUser(t *testing.T) {
	service := NewAdminMatchService(&fakeAdminMatchRepository{}, fixedClock(), &fakeAdminAccess{})
	if _, err := service.List(context.Background(), userActor(2), AdminMatchListQuery{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestAdminGetMatchIncludesGroupRosters(t *testing.T) {
	matchID := uuid.New()
	teamID := int64(11)
	hostGroup := domain.RegistrationGroup{ID: uuid.New(), MatchID: matchID, Kind: domain.GroupHostTeam, TeamID: &teamID, Status: domain.GroupOpen}
	individualGroup := domain.RegistrationGroup{ID: uuid.New(), MatchID: matchID, Kind: domain.GroupIndividualOpponent, Status: domain.GroupOpen}
	attending := domain.RegistrationAttending
	captain := "captain"
	member := "member"
	repository := &fakeAdminMatchRepository{
		match:  domain.Match{ID: matchID, Name: "周四友谊赛"},
		groups: []domain.RegistrationGroup{hostGroup, individualGroup},
		found:  true,
		rosters: map[uuid.UUID][]ports.AdminRosterEntry{
			hostGroup.ID: {
				{UserID: 38, Nickname: "东安利马", MemberRole: &captain, Status: &attending},
				{UserID: 40, Nickname: "阿东", MemberRole: &member},
			},
			individualGroup.ID: {
				{UserID: 41, Nickname: "散人甲", Status: &attending},
			},
		},
	}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	detail, err := service.Get(context.Background(), adminActor(3), matchID)
	if err != nil {
		t.Fatalf("get match: %v", err)
	}
	if len(detail.Rosters) != 2 {
		t.Fatalf("expected rosters for both groups, got %+v", detail.Rosters)
	}
	if detail.Rosters[0].GroupID != hostGroup.ID || detail.Rosters[1].GroupID != individualGroup.ID {
		t.Fatalf("rosters must align with group order: %+v", detail.Rosters)
	}
	hostEntries := detail.Rosters[0].Entries
	if len(hostEntries) != 2 || hostEntries[0].UserID != 38 {
		t.Fatalf("unexpected host roster: %+v", hostEntries)
	}
	if hostEntries[1].Status != nil {
		t.Fatalf("member without registration must keep nil status: %+v", hostEntries[1])
	}
	if len(detail.Rosters[1].Entries) != 1 || detail.Rosters[1].Entries[0].UserID != 41 {
		t.Fatalf("unexpected individual roster: %+v", detail.Rosters[1].Entries)
	}
}

func TestAdminChangesMatchStatus(t *testing.T) {
	id := uuid.New()
	repository := &fakeAdminMatchRepository{match: domain.Match{ID: id, Status: domain.MatchRegistering}, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	match, err := service.ChangeStatus(context.Background(), adminActor(3), id, domain.MatchOngoing)
	if err != nil {
		t.Fatalf("change status: %v", err)
	}
	if match.Status != domain.MatchOngoing || repository.updatedStatus.Status != domain.MatchOngoing {
		t.Fatalf("unexpected status update: %+v", match)
	}
}

func TestAdminUpdatesRegistrationWindowWithTriStateSemantics(t *testing.T) {
	originalStart := time.Date(2026, 8, 20, 8, 0, 0, 0, time.UTC)
	originalEnd := originalStart.Add(48 * time.Hour)
	replacementEnd := originalEnd.Add(24 * time.Hour)

	tests := []struct {
		name      string
		start     OptionalTimestamp
		end       OptionalTimestamp
		wantStart *time.Time
		wantEnd   *time.Time
	}{
		{name: "omitted values are preserved", wantStart: &originalStart, wantEnd: &originalEnd},
		{name: "explicit null clears a value", start: OptionalTimestamp{Set: true}, wantEnd: &originalEnd},
		{name: "timestamp replaces a value", end: OptionalTimestamp{Set: true, Value: &replacementEnd}, wantStart: &originalStart, wantEnd: &replacementEnd},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id := uuid.New()
			createdByAdminID := int64(3)
			repository := &fakeAdminMatchRepository{match: domain.Match{
				ID: id, Status: domain.MatchRegistering, PublicationMode: domain.OnlineTeam,
				Name: "周末比赛", HostTeamID: int64Pointer(11), PlayersPerTeam: 7,
				StartTime: originalEnd.Add(24 * time.Hour), EndTime: originalEnd.Add(26 * time.Hour),
				RegistrationStartAt: &originalStart, RegistrationEndAt: &originalEnd,
				Location: "滨江球场", CreatedByAdminID: &createdByAdminID,
			}, found: true}
			service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

			updated, err := service.UpdateDetails(context.Background(), adminActor(3), id, UpdateMatchCommand{
				Name: "周末比赛", StartTime: repository.match.StartTime, EndTime: repository.match.EndTime,
				RegistrationStartAt: tt.start, RegistrationEndAt: tt.end, Location: "滨江球场",
			})
			if err != nil {
				t.Fatalf("update details: %v", err)
			}
			assertOptionalTimeEqual(t, updated.RegistrationStartAt, tt.wantStart)
			assertOptionalTimeEqual(t, updated.RegistrationEndAt, tt.wantEnd)
		})
	}
}

func updatableAdminMatchFixture(id uuid.UUID) (domain.Match, []domain.RegistrationGroup) {
	createdByAdminID := int64(3)
	start := time.Date(2026, 8, 22, 12, 0, 0, 0, time.UTC)
	return domain.Match{
			ID: id, Status: domain.MatchRegistering, PublicationMode: domain.OnlineTeam,
			Name: "周四友谊赛", HostTeamID: int64Pointer(11), PlayersPerTeam: 8,
			StartTime: start, EndTime: start.Add(2 * time.Hour),
			Location: "驿马河", CreatedByAdminID: &createdByAdminID,
		}, []domain.RegistrationGroup{
			{ID: uuid.New(), MatchID: id, Kind: domain.GroupIndividualOpponent, Status: domain.GroupOpen},
			{ID: uuid.New(), MatchID: id, Kind: domain.GroupHostTeam, Status: domain.GroupOpen},
		}
}

func TestAdminUpdatesHostCapacityWithDetails(t *testing.T) {
	id := uuid.New()
	match, groups := updatableAdminMatchFixture(id)
	repository := &fakeAdminMatchRepository{match: match, groups: groups, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	limit := 12
	if _, err := service.UpdateDetails(context.Background(), adminActor(3), id, UpdateMatchCommand{
		Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location,
		HostCapacityLimit: &limit,
	}); err != nil {
		t.Fatalf("update details: %v", err)
	}
	saved := repository.updatedHostGroup
	if saved == nil || saved.ID != groups[1].ID || saved.MaxPlayers == nil || *saved.MaxPlayers != 12 {
		t.Fatalf("expected host group capacity 12, got %+v", saved)
	}
}

func TestAdminUpdateWithoutCapacityLeavesHostGroupUntouched(t *testing.T) {
	id := uuid.New()
	match, groups := updatableAdminMatchFixture(id)
	repository := &fakeAdminMatchRepository{match: match, groups: groups, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	if _, err := service.UpdateDetails(context.Background(), adminActor(3), id, UpdateMatchCommand{
		Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location,
	}); err != nil {
		t.Fatalf("update details: %v", err)
	}
	if repository.updatedHostGroup != nil {
		t.Fatalf("host group must not be persisted when capacity omitted: %+v", repository.updatedHostGroup)
	}
}

func TestAdminUpdateCapacityRequiresHostGroup(t *testing.T) {
	id := uuid.New()
	match, _ := updatableAdminMatchFixture(id)
	repository := &fakeAdminMatchRepository{match: match, found: true}
	service := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{})

	limit := 12
	if _, err := service.UpdateDetails(context.Background(), adminActor(3), id, UpdateMatchCommand{
		Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location,
		HostCapacityLimit: &limit,
	}); err == nil {
		t.Fatal("expected missing host group to fail the update")
	}
	if repository.updatedDetails.ID != uuid.Nil {
		t.Fatal("match details must not persist when capacity update is invalid")
	}
}

func assertOptionalTimeEqual(t *testing.T, got, want *time.Time) {
	t.Helper()
	if got == nil || want == nil {
		if got != nil || want != nil {
			t.Fatalf("unexpected optional time: got=%v want=%v", got, want)
		}
		return
	}
	if !got.Equal(*want) {
		t.Fatalf("unexpected time: got=%s want=%s", got, want)
	}
}

func TestSuperAdminDeletesMatchInEveryStatus(t *testing.T) {
	statuses := []domain.MatchStatus{domain.MatchRegistering, domain.MatchOngoing, domain.MatchEnded, domain.MatchCancelled}
	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			id := uuid.New()
			repository := &fakeAdminMatchRepository{match: domain.Match{ID: id, Status: status}, deleteFound: true}
			access := &fakeAdminAccess{}
			service := NewAdminMatchService(repository, fixedClock(), access)

			if err := service.Delete(context.Background(), adminActor(3), id); err != nil {
				t.Fatalf("delete %s match: %v", status, err)
			}
			if repository.deletedID != id || access.actor.ID != 3 {
				t.Fatalf("delete was not authorized or persisted: repository=%+v access=%+v", repository, access)
			}
		})
	}
}

func TestVenueAdminCannotDeleteMatch(t *testing.T) {
	repository := &fakeAdminMatchRepository{deleteFound: true}
	access := &fakeAdminAccess{err: sharederror.ErrForbidden}
	service := NewAdminMatchService(repository, fixedClock(), access)
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 8}

	if err := service.Delete(context.Background(), actor, uuid.New()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if repository.deletedID != uuid.Nil {
		t.Fatal("repository delete must not run when authorization fails")
	}
}

type fakeAdminMatchRepository struct {
	match            domain.Match
	groups           []domain.RegistrationGroup
	item             ports.AdminMatchItem
	items            []ports.AdminMatchItem
	total            int64
	found            bool
	rosters          map[uuid.UUID][]ports.AdminRosterEntry
	updatedDetails   domain.Match
	updatedHostGroup *domain.RegistrationGroup
	updatedStatus    domain.Match
	updatedScore     domain.Match
	deleteFound      bool
	deletedID        uuid.UUID
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

func (f *fakeAdminMatchRepository) UpdateDetails(_ context.Context, match domain.Match, hostGroup *domain.RegistrationGroup) error {
	f.updatedDetails = match
	f.updatedHostGroup = hostGroup
	return nil
}

func (f *fakeAdminMatchRepository) UpdateStatus(_ context.Context, match domain.Match) error {
	f.updatedStatus = match
	return nil
}

func (f *fakeAdminMatchRepository) FinishUpdateStatus(context.Context, domain.Match) (bool, error) {
	return true, nil
}

func (f *fakeAdminMatchRepository) UpdateScore(_ context.Context, match domain.Match) error {
	f.updatedScore = match
	return nil
}

func (f *fakeAdminMatchRepository) Delete(_ context.Context, id uuid.UUID) (bool, error) {
	f.deletedID = id
	return f.deleteFound, nil
}

func (f *fakeAdminMatchRepository) CreateRegistration(context.Context, domain.Registration) error {
	return nil
}

func (f *fakeAdminMatchRepository) ListRosterForGroup(_ context.Context, group domain.RegistrationGroup) ([]ports.AdminRosterEntry, error) {
	return f.rosters[group.ID], nil
}

type fakeAdminAccess struct {
	actor sharedauth.Actor
	err   error
}

func (f *fakeAdminAccess) EnsureSuperAdmin(_ context.Context, actor sharedauth.Actor) error {
	f.actor = actor
	return f.err
}

func adminActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: id, IsSuperAdmin: true}
}
