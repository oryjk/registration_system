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

func TestUserRegistrationPutIndividualUpdatesCapacityAndOpponent(t *testing.T) {
	now := time.Date(2026, 8, 8, 10, 0, 0, 0, time.UTC)
	repository := newFakeUserRegistrationRepository(individualRegistrationFixture(now, 1, 1))
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Hour)})

	registration, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 1,
	})
	if err != nil {
		t.Fatalf("put registration: %v", err)
	}
	if registration.UserID != 42 || registration.Status != domain.RegistrationAttending || registration.RegistrationCount != 1 {
		t.Fatalf("unexpected registration: %+v", registration)
	}
	if repository.group.Status != domain.GroupClosed || repository.match.OpponentState != domain.OpponentConfirmed {
		t.Fatalf("derived state not updated: group=%s opponent=%s", repository.group.Status, repository.match.OpponentState)
	}
	if repository.transactions != 1 || repository.outsideTransactionWrite {
		t.Fatalf("writes must be atomic: transactions=%d outside=%v", repository.transactions, repository.outsideTransactionWrite)
	}
}

func TestUserRegistrationPutValidatesActorStatusAndCount(t *testing.T) {
	now := time.Now()
	fixture := individualRegistrationFixture(now, 1, 2)
	tests := []struct {
		name    string
		actor   sharedauth.Actor
		command PutMyRegistrationCommand
		want    error
	}{
		{name: "admin", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, command: PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1}, want: sharederror.ErrForbidden},
		{name: "count", actor: userActor(42), command: PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 2}, want: sharederror.ErrValidation},
		{name: "server status", actor: userActor(42), command: PutMyRegistrationCommand{Status: domain.RegistrationCancelled, RegistrationCount: 1}, want: sharederror.ErrValidation},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := newFakeUserRegistrationRepository(fixture)
			service := NewUserRegistrationService(repository, fakeClock{now: now})
			_, err := service.Put(context.Background(), test.actor, repository.match.ID, repository.group.ID, test.command)
			if !errors.Is(err, test.want) {
				t.Fatalf("expected %v, got %v", test.want, err)
			}
			if repository.transactions != 0 {
				t.Fatal("invalid command must fail before opening a transaction")
			}
		})
	}
}

func TestUserRegistrationPutEnforcesGroupAuthorization(t *testing.T) {
	now := time.Now()
	t.Run("team group requires active membership", func(t *testing.T) {
		fixture := teamRegistrationFixture(now, domain.GroupHostTeam, 7)
		repository := newFakeUserRegistrationRepository(fixture)
		service := NewUserRegistrationService(repository, fakeClock{now: now})
		_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
		if !errors.Is(err, sharederror.ErrForbidden) {
			t.Fatalf("expected forbidden, got %v", err)
		}
	})

	t.Run("selected guest group accepts its active member", func(t *testing.T) {
		fixture := teamRegistrationFixture(now, domain.GroupGuestTeam, 8)
		awayTeamID := int64(8)
		fixture.match.AwayTeamID = &awayTeamID
		fixture.match.OpponentState = domain.OpponentConfirmed
		repository := newFakeUserRegistrationRepository(fixture)
		repository.members = map[int64]map[int64]bool{8: {42: true}}
		service := NewUserRegistrationService(repository, fakeClock{now: now})
		if _, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand()); err != nil {
			t.Fatalf("put selected guest registration: %v", err)
		}
	})

	t.Run("unselected guest group conflicts", func(t *testing.T) {
		fixture := teamRegistrationFixture(now, domain.GroupGuestTeam, 8)
		repository := newFakeUserRegistrationRepository(fixture)
		repository.members = map[int64]map[int64]bool{8: {42: true}}
		service := NewUserRegistrationService(repository, fakeClock{now: now})
		_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
		if !errors.Is(err, sharederror.ErrConflict) {
			t.Fatalf("expected conflict, got %v", err)
		}
	})

	t.Run("host member cannot join individual opponent", func(t *testing.T) {
		fixture := individualRegistrationFixture(now, 1, 2)
		repository := newFakeUserRegistrationRepository(fixture)
		repository.members = map[int64]map[int64]bool{7: {42: true}}
		service := NewUserRegistrationService(repository, fakeClock{now: now})
		_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
		if !errors.Is(err, sharederror.ErrForbidden) {
			t.Fatalf("expected forbidden, got %v", err)
		}
	})

	t.Run("individual group accepts attending only", func(t *testing.T) {
		fixture := individualRegistrationFixture(now, 1, 2)
		repository := newFakeUserRegistrationRepository(fixture)
		service := NewUserRegistrationService(repository, fakeClock{now: now})
		_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{Status: domain.RegistrationLeave, RegistrationCount: 1})
		if !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("expected validation, got %v", err)
		}
	})
}

func TestUserRegistrationPutRejectsUnavailableOrConflictingRegistration(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name   string
		mutate func(*fakeUserRegistrationRepository)
	}{
		{name: "match not registering", mutate: func(r *fakeUserRegistrationRepository) { r.match.Status = domain.MatchOngoing }},
		{name: "group cancelled", mutate: func(r *fakeUserRegistrationRepository) { r.group.Status = domain.GroupCancelled }},
		{name: "group closed", mutate: func(r *fakeUserRegistrationRepository) { r.group.Status = domain.GroupClosed }},
		{name: "capacity full", mutate: func(r *fakeUserRegistrationRepository) {
			other, _ := domain.NewRegistration(r.group.ID, 99, domain.RegistrationAttending, 1, now)
			r.registrations[r.group.ID] = append(r.registrations[r.group.ID], other)
		}},
		{name: "active registration in another group", mutate: func(r *fakeUserRegistrationRepository) {
			otherGroupID := uuid.New()
			other, _ := domain.NewRegistration(otherGroupID, 42, domain.RegistrationAttending, 1, now)
			r.registrations[otherGroupID] = append(r.registrations[otherGroupID], other)
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := newFakeUserRegistrationRepository(individualRegistrationFixture(now, 1, 1))
			test.mutate(repository)
			service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Minute)})
			_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
			if !errors.Is(err, sharederror.ErrConflict) {
				t.Fatalf("expected conflict, got %v", err)
			}
		})
	}
}

func TestUserRegistrationPutIsIdempotentAndReactivatesCancelledRow(t *testing.T) {
	now := time.Now()
	fixture := teamRegistrationFixture(now, domain.GroupHostTeam, 7)
	repository := newFakeUserRegistrationRepository(fixture)
	existing, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 1, now)
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	repository.members = map[int64]map[int64]bool{7: {42: true}}
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Hour)})

	unchanged, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
	if err != nil || !unchanged.UpdatedAt.Equal(now) {
		t.Fatalf("idempotent put changed registration: %+v err=%v", unchanged, err)
	}
	existing.RegistrationCount = 2
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	normalized, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
	if err != nil || normalized.RegistrationCount != 1 {
		t.Fatalf("normalize legacy registration count: %+v err=%v", normalized, err)
	}

	existing.Cancel(now.Add(time.Minute))
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	reactivated, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
	if err != nil || reactivated.CancelledAt != nil || reactivated.Status != domain.RegistrationAttending {
		t.Fatalf("reactivate registration: %+v err=%v", reactivated, err)
	}
}

func TestUserRegistrationDeleteAllowsLostMembershipAndIsIdempotent(t *testing.T) {
	now := time.Now()
	fixture := teamRegistrationFixture(now, domain.GroupHostTeam, 7)
	repository := newFakeUserRegistrationRepository(fixture)
	existing, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 1, now)
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Hour)})

	cancelled, err := service.Delete(context.Background(), userActor(42), repository.match.ID, repository.group.ID)
	if err != nil || cancelled.Status != domain.RegistrationCancelled || cancelled.CancelledAt == nil {
		t.Fatalf("cancel registration: %+v err=%v", cancelled, err)
	}
	repeated, err := service.Delete(context.Background(), userActor(42), repository.match.ID, repository.group.ID)
	if err != nil || repeated.CancelledAt == nil || !repeated.CancelledAt.Equal(*cancelled.CancelledAt) {
		t.Fatalf("repeat cancellation must be stable: %+v err=%v", repeated, err)
	}
	if repository.membershipChecks != 0 {
		t.Fatal("delete must not require current team membership")
	}
}

func TestUserRegistrationDeleteMissingReturnsNotFound(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(teamRegistrationFixture(now, domain.GroupHostTeam, 7))
	service := NewUserRegistrationService(repository, fakeClock{now: now})
	_, err := service.Delete(context.Background(), userActor(42), repository.match.ID, repository.group.ID)
	if !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}

func TestUserRegistrationPutRejectsTimesOutsideRegistrationWindow(t *testing.T) {
	windowStart := time.Date(2026, 8, 16, 9, 0, 0, 0, time.UTC)
	windowEnd := windowStart.Add(2 * time.Hour)
	tests := []struct {
		name string
		now  time.Time
	}{
		{name: "before start", now: windowStart.Add(-time.Nanosecond)},
		{name: "at end", now: windowEnd},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := newFakeUserRegistrationRepository(individualRegistrationFixture(windowStart, 1, 2))
			repository.match.RegistrationStartAt = &windowStart
			repository.match.RegistrationEndAt = &windowEnd
			service := NewUserRegistrationService(repository, fakeClock{now: test.now})

			_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
			if !errors.Is(err, sharederror.ErrConflict) {
				t.Fatalf("expected conflict outside registration window, got %v", err)
			}
			if len(repository.registrations[repository.group.ID]) != 0 {
				t.Fatal("registration outside the window must not be persisted")
			}
		})
	}
}

func TestUserRegistrationDeleteRejectsAfterRegistrationWindow(t *testing.T) {
	now := time.Date(2026, 8, 16, 12, 0, 0, 0, time.UTC)
	repository := newFakeUserRegistrationRepository(teamRegistrationFixture(now.Add(-2*time.Hour), domain.GroupHostTeam, 7))
	windowEnd := now.Add(-time.Minute)
	repository.match.RegistrationEndAt = &windowEnd
	existing, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 1, now.Add(-time.Hour))
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	service := NewUserRegistrationService(repository, fakeClock{now: now})

	_, err := service.Delete(context.Background(), userActor(42), repository.match.ID, repository.group.ID)
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected conflict after registration window, got %v", err)
	}
	if repository.registrations[repository.group.ID][0].Status != domain.RegistrationAttending {
		t.Fatal("registration outside the window must not be cancelled")
	}
}

func TestUserRegistrationRollsBackWhenDerivedStateWriteFails(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(individualRegistrationFixture(now, 1, 1))
	repository.updateGroupErr = errors.New("write failed")
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Hour)})

	_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
	if !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("expected internal error, got %v", err)
	}
	if len(repository.registrations[repository.group.ID]) != 0 || repository.group.Status != domain.GroupOpen || repository.match.OpponentState != domain.OpponentRecruiting {
		t.Fatalf("failed transaction leaked writes: %+v %+v %+v", repository.registrations, repository.group, repository.match)
	}
}

func TestUserRegistrationMapsPersistenceConstraintErrors(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name    string
		store   error
		wantErr error
	}{
		{name: "conflict", store: ports.ErrUserRegistrationConflict, wantErr: sharederror.ErrConflict},
		{name: "validation", store: ports.ErrUserRegistrationValidation, wantErr: sharederror.ErrValidation},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := newFakeUserRegistrationRepository(individualRegistrationFixture(now, 1, 2))
			repository.saveRegistrationErr = test.store
			service := NewUserRegistrationService(repository, fakeClock{now: now})
			_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, validRegistrationCommand())
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("expected %v, got %v", test.wantErr, err)
			}
		})
	}
}

type registrationFixture struct {
	match domain.Match
	group domain.RegistrationGroup
}

func individualRegistrationFixture(now time.Time, minPlayers, maxPlayers int) registrationFixture {
	matchID := uuid.New()
	return registrationFixture{
		match: domain.Match{ID: matchID, HostTeamID: 7, PublicationMode: domain.OnlineIndividual, OpponentState: domain.OpponentRecruiting, Status: domain.MatchRegistering, UpdatedAt: now},
		group: domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: minPlayers, MaxPlayers: maxPlayers}, now),
	}
}

func teamRegistrationFixture(now time.Time, kind domain.GroupKind, teamID int64) registrationFixture {
	matchID := uuid.New()
	return registrationFixture{
		match: domain.Match{ID: matchID, HostTeamID: 7, PublicationMode: domain.OnlineTeam, OpponentState: domain.OpponentRecruiting, Status: domain.MatchRegistering, UpdatedAt: now},
		group: domain.NewTeamGroup(matchID, kind, teamID, nil, now),
	}
}

func validRegistrationCommand() PutMyRegistrationCommand {
	return PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1}
}

type fakeUserRegistrationRepository struct {
	match                   domain.Match
	group                   domain.RegistrationGroup
	registrations           map[uuid.UUID][]domain.Registration
	transactions            int
	inTransaction           bool
	outsideTransactionWrite bool
	updateGroupErr          error
	saveRegistrationErr     error
	members                 map[int64]map[int64]bool
	membershipChecks        int
}

func newFakeUserRegistrationRepository(fixture registrationFixture) *fakeUserRegistrationRepository {
	return &fakeUserRegistrationRepository{match: fixture.match, group: fixture.group, registrations: make(map[uuid.UUID][]domain.Registration)}
}

func (f *fakeUserRegistrationRepository) WithinUserRegistrationTransaction(ctx context.Context, operation func(ports.UserRegistrationTransaction) error) error {
	f.transactions++
	working := *f
	working.inTransaction = true
	working.registrations = cloneRegistrations(f.registrations)
	if err := operation(&working); err != nil {
		return err
	}
	working.inTransaction = false
	*f = working
	return nil
}

func (f *fakeUserRegistrationRepository) FindMatchForUpdate(context.Context, uuid.UUID) (domain.Match, bool, error) {
	return f.match, f.match.ID != uuid.Nil, nil
}

func (f *fakeUserRegistrationRepository) FindGroupForUpdate(_ context.Context, matchID, groupID uuid.UUID) (domain.RegistrationGroup, bool, error) {
	return f.group, f.group.ID == groupID && f.group.MatchID == matchID, nil
}

func (f *fakeUserRegistrationRepository) FindUserRegistrationForUpdate(_ context.Context, groupID uuid.UUID, userID int64) (domain.Registration, bool, error) {
	for _, registration := range f.registrations[groupID] {
		if registration.UserID == userID {
			return registration, true, nil
		}
	}
	return domain.Registration{}, false, nil
}

func (f *fakeUserRegistrationRepository) FindActiveUserRegistrationInMatchForUpdate(_ context.Context, matchID uuid.UUID, userID int64) (domain.Registration, bool, error) {
	if f.match.ID != matchID {
		return domain.Registration{}, false, nil
	}
	for _, registrations := range f.registrations {
		for _, registration := range registrations {
			if registration.UserID == userID && registration.Status != domain.RegistrationCancelled {
				return registration, true, nil
			}
		}
	}
	return domain.Registration{}, false, nil
}

func (f *fakeUserRegistrationRepository) CountAttendingForGroup(_ context.Context, groupID uuid.UUID) (int, error) {
	count := 0
	for _, registration := range f.registrations[groupID] {
		if registration.OccupiesCapacity() {
			count += registration.RegistrationCount
		}
	}
	return count, nil
}

func (f *fakeUserRegistrationRepository) IsActiveTeamMember(_ context.Context, teamID, userID int64) (bool, error) {
	f.membershipChecks++
	return f.members[teamID][userID], nil
}

func (f *fakeUserRegistrationRepository) SaveRegistration(_ context.Context, registration domain.Registration) error {
	f.recordWrite()
	if f.saveRegistrationErr != nil {
		return f.saveRegistrationErr
	}
	items := f.registrations[registration.GroupID]
	for index := range items {
		if items[index].UserID == registration.UserID {
			items[index] = registration
			f.registrations[registration.GroupID] = items
			return nil
		}
	}
	f.registrations[registration.GroupID] = append(items, registration)
	return nil
}

func (f *fakeUserRegistrationRepository) UpdateGroup(_ context.Context, group domain.RegistrationGroup) error {
	f.recordWrite()
	if f.updateGroupErr != nil {
		return f.updateGroupErr
	}
	f.group = group
	return nil
}

func (f *fakeUserRegistrationRepository) UpdateMatchOpponent(_ context.Context, match domain.Match) error {
	f.recordWrite()
	f.match = match
	return nil
}

func (f *fakeUserRegistrationRepository) recordWrite() {
	if !f.inTransaction {
		f.outsideTransactionWrite = true
	}
}

func cloneRegistrations(source map[uuid.UUID][]domain.Registration) map[uuid.UUID][]domain.Registration {
	cloned := make(map[uuid.UUID][]domain.Registration, len(source))
	for groupID, registrations := range source {
		cloned[groupID] = append([]domain.Registration(nil), registrations...)
	}
	return cloned
}

var _ ports.UserRegistrationRepository = (*fakeUserRegistrationRepository)(nil)
var _ ports.UserRegistrationTransaction = (*fakeUserRegistrationRepository)(nil)
