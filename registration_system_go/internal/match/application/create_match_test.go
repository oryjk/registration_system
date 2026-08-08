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

func TestCreateOnlineTeamMatchOpensHostGroupImmediately(t *testing.T) {
	repository := &fakeMatchRepository{}
	useCase := NewCreateMatch(repository, &fakeTeamAccess{}, &fakeDefaultLimits{}, fixedClock())

	result, err := useCase.Execute(context.Background(), userActor(101), validCreateCommand(domain.OnlineTeam))
	if err != nil {
		t.Fatalf("create match: %v", err)
	}
	if result.Match.OpponentState != domain.OpponentRecruiting {
		t.Fatalf("expected recruiting state, got %s", result.Match.OpponentState)
	}
	if len(result.Groups) != 1 || result.Groups[0].Kind != domain.GroupHostTeam || result.Groups[0].Status != domain.GroupOpen {
		t.Fatalf("unexpected initial groups: %+v", result.Groups)
	}
	if repository.created.ID != result.Match.ID {
		t.Fatal("expected repository to receive match")
	}
}

func TestCreateIndividualMatchResolvesLimitsOnServer(t *testing.T) {
	limits := &fakeDefaultLimits{limits: domain.IndividualLimits{MinPlayers: 8, MaxPlayers: 10}}
	useCase := NewCreateMatch(&fakeMatchRepository{}, &fakeTeamAccess{}, limits, fixedClock())

	result, err := useCase.Execute(context.Background(), userActor(101), validCreateCommand(domain.OnlineIndividual))
	if err != nil {
		t.Fatalf("create match: %v", err)
	}
	if limits.receivedPlayersPerTeam != 8 {
		t.Fatalf("expected limits lookup for 8, got %d", limits.receivedPlayersPerTeam)
	}
	if len(result.Groups) != 2 || result.Groups[1].MinPlayers == nil || *result.Groups[1].MinPlayers != 8 || *result.Groups[1].MaxPlayers != 10 {
		t.Fatalf("unexpected individual group: %+v", result.Groups)
	}
}

func TestCreateMatchRejectsOrdinaryMember(t *testing.T) {
	teamAccess := &fakeTeamAccess{err: sharederror.ErrForbidden}
	useCase := NewCreateMatch(&fakeMatchRepository{}, teamAccess, &fakeDefaultLimits{}, fixedClock())

	if _, err := useCase.Execute(context.Background(), userActor(103), validCreateCommand(domain.OnlineTeam)); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestCreateMatchAllowsAdminActorForExistingTeam(t *testing.T) {
	useCase := NewCreateMatch(&fakeMatchRepository{}, &fakeTeamAccess{}, &fakeDefaultLimits{}, fixedClock())
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1, IsSuperAdmin: false}

	result, err := useCase.Execute(context.Background(), actor, validCreateCommand(domain.OnlineTeam))
	if err != nil {
		t.Fatalf("create admin match: %v", err)
	}
	if result.Match.CreatedByAdminID == nil || *result.Match.CreatedByAdminID != actor.ID {
		t.Fatalf("unexpected admin creator: %+v", result.Match)
	}
}

type fakeMatchRepository struct {
	created domain.Match
	groups  []domain.RegistrationGroup
	err     error
}

func (f *fakeMatchRepository) CreateWithGroups(_ context.Context, match domain.Match, groups []domain.RegistrationGroup) error {
	f.created = match
	f.groups = groups
	return f.err
}

func (f *fakeMatchRepository) FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error) {
	return domain.Match{}, nil, false, nil
}

func (f *fakeMatchRepository) FindForAdmin(context.Context, uuid.UUID) (ports.AdminMatchItem, []domain.RegistrationGroup, bool, error) {
	return ports.AdminMatchItem{}, nil, false, nil
}

func (f *fakeMatchRepository) ListForAdmin(context.Context, ports.AdminMatchFilter) ([]ports.AdminMatchItem, error) {
	return nil, nil
}

func (f *fakeMatchRepository) CountForAdmin(context.Context, ports.AdminMatchFilter) (int64, error) {
	return 0, nil
}

func (f *fakeMatchRepository) UpdateDetails(context.Context, domain.Match) error { return nil }
func (f *fakeMatchRepository) UpdateStatus(context.Context, domain.Match) error  { return nil }
func (f *fakeMatchRepository) Delete(context.Context, uuid.UUID) (bool, error)   { return false, nil }

func (f *fakeMatchRepository) CreateRegistration(context.Context, domain.Registration) error {
	return nil
}

func (f *fakeMatchRepository) ListRosterForGroup(context.Context, domain.RegistrationGroup) ([]ports.AdminRosterEntry, error) {
	return nil, nil
}

type fakeTeamAccess struct {
	err error
}

func (f *fakeTeamAccess) EnsureManager(context.Context, int64, int64) error {
	return f.err
}

func (f *fakeTeamAccess) EnsureExists(context.Context, int64) error { return f.err }

func (f *fakeTeamAccess) EnsureActive(context.Context, int64) error { return f.err }

func (f *fakeTeamAccess) EnsureActiveMember(context.Context, int64, int64) error { return f.err }

func (f *fakeTeamAccess) IsActiveMember(context.Context, int64, int64) (bool, error) {
	return false, f.err
}

type fakeDefaultLimits struct {
	limits                 domain.IndividualLimits
	receivedPlayersPerTeam int
	err                    error
}

func (f *fakeDefaultLimits) Resolve(_ context.Context, playersPerTeam int) (domain.IndividualLimits, error) {
	f.receivedPlayersPerTeam = playersPerTeam
	if f.err != nil {
		return domain.IndividualLimits{}, f.err
	}
	if f.limits.MinPlayers == 0 {
		return domain.ResolveIndividualLimits(playersPerTeam, nil)
	}
	return f.limits, nil
}

type fakeClock struct {
	now time.Time
}

func (f fakeClock) Now() time.Time { return f.now }

func fixedClock() fakeClock {
	return fakeClock{now: time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)}
}

func userActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func validCreateCommand(mode domain.PublicationMode) CreateMatchCommand {
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	return CreateMatchCommand{
		Name:              "周末约球",
		PublicationMode:   mode,
		HostTeamID:        7,
		PlayersPerTeam:    8,
		HostCapacityLimit: intPointer(12),
		StartTime:         start,
		EndTime:           start.Add(2 * time.Hour),
		Location:          "东安球场",
	}
}

func intPointer(value int) *int { return &value }
