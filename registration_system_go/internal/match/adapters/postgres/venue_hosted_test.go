package postgres

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/defaults"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

type venueTestClock struct{ now time.Time }

func (c venueTestClock) Now() time.Time { return c.now }

// venueTestTeams 只判定管理权限；报名时的队员身份走真实 team_members 表。
type venueTestTeams struct{ managers map[[2]int64]bool }

func (t venueTestTeams) EnsureManager(_ context.Context, teamID, userID int64) error {
	if !t.managers[[2]int64{teamID, userID}] {
		return sharederror.ErrForbidden
	}
	return nil
}
func (t venueTestTeams) EnsureCaptain(ctx context.Context, teamID, userID int64) error {
	return t.EnsureManager(ctx, teamID, userID)
}
func (venueTestTeams) EnsureExists(context.Context, int64) error                  { return nil }
func (venueTestTeams) EnsureActive(context.Context, int64) error                  { return nil }
func (venueTestTeams) EnsureActiveMember(context.Context, int64, int64) error     { return nil }
func (venueTestTeams) IsActiveMember(context.Context, int64, int64) (bool, error) { return true, nil }

type venueTestAccess struct{ venues map[int64]bool }

func (a venueTestAccess) EnsureVenue(_ context.Context, userID int64) error {
	if !a.venues[userID] {
		return sharederror.ErrForbidden
	}
	return nil
}

type venueTestNotifier struct {
	mu    sync.Mutex
	users []int64
}

func (n *venueTestNotifier) NotifyVenueTeamRemoved(_ context.Context, userID int64, _ uuid.UUID, _ string) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.users = append(n.users, userID)
	return nil
}

type venueFixture struct {
	t             *testing.T
	pool          *pgxpool.Pool
	repo          *Repository
	teams         venueTestTeams
	notifier      *venueTestNotifier
	sides         application.VenueSideService
	registrations application.UserRegistrationService
	publisher     int64
	match         domain.Match
	sideA, sideB  domain.RegistrationGroup
	limits        domain.IndividualLimits
}

func newVenueFixture(t *testing.T) *venueFixture {
	t.Helper()
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repo := NewRepository(pool)
	now := time.Now().UTC().Truncate(time.Second)
	clock := venueTestClock{now: now}
	teams := venueTestTeams{managers: map[[2]int64]bool{}}
	publisher := seedMatchUser(t, pool)
	creator := application.NewCreateMatch(repo, teams, defaults.Service{}, clock).
		WithVenueAccess(venueTestAccess{venues: map[int64]bool{publisher: true}})
	result, err := creator.Execute(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: publisher}, application.CreateMatchCommand{
		Name: "场馆组局", PublicationMode: domain.VenueHosted, PlayersPerTeam: 2, Location: "测试球场",
		StartTime: now.Add(24 * time.Hour), EndTime: now.Add(26 * time.Hour),
		FeeType: domain.FeeOfflineAA,
	})
	if err != nil {
		t.Fatalf("create venue match: %v", err)
	}
	notifier := &venueTestNotifier{}
	limits, err := defaults.Service{}.Resolve(ctx, 2)
	if err != nil {
		t.Fatal(err)
	}
	return &venueFixture{
		t: t, pool: pool, repo: repo, teams: teams, notifier: notifier, publisher: publisher, limits: limits,
		sides:         application.NewVenueSideService(repo, teams, defaults.Service{}, notifier, clock),
		registrations: application.NewUserRegistrationService(repo, clock),
		match:         result.Match, sideA: result.Groups[0], sideB: result.Groups[1],
	}
}

func venueUser(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func (f *venueFixture) seedTeam(role string) (manager, team int64) {
	f.t.Helper()
	manager, team = seedMatchOwner(f.t, f.pool)
	f.addMember(team, manager, role)
	f.teams.managers[[2]int64{team, manager}] = true
	return manager, team
}

func (f *venueFixture) addMember(team, user int64, role string) {
	f.t.Helper()
	if _, err := f.pool.Exec(context.Background(), `INSERT INTO team_members (team_id,user_id,role,status) VALUES ($1,$2,$3,'active')`, team, user, role); err != nil {
		f.t.Fatalf("seed member: %v", err)
	}
}

func (f *venueFixture) register(user int64, groupID uuid.UUID, count int) (domain.Registration, error) {
	return f.registrations.Put(context.Background(), venueUser(user), f.match.ID, groupID, application.PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: count,
	})
}

func (f *venueFixture) activeGroups() []domain.RegistrationGroup {
	f.t.Helper()
	_, groups, found, err := f.repo.FindByID(context.Background(), f.match.ID)
	if err != nil || !found {
		f.t.Fatalf("find match: %v found=%v", err, found)
	}
	active := make([]domain.RegistrationGroup, 0, 2)
	for _, group := range groups {
		if group.Status != domain.GroupCancelled {
			active = append(active, group)
		}
	}
	return active
}

func isErrKind(err error, kind sharederror.Kind) bool {
	var target *sharederror.Error
	return errors.As(err, &target) && target.Kind == kind
}

func TestVenueIndividualsFillSideAFirstEvenWhenClientPicksSideB(t *testing.T) {
	f := newVenueFixture(t)
	registration, err := f.register(seedMatchUser(t, f.pool), f.sideB.ID, 1)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if registration.GroupID != f.sideA.ID {
		t.Fatalf("expected side a, got %s", registration.GroupID)
	}
	if _, err := f.register(seedMatchUser(t, f.pool), f.sideA.ID, f.limits.MaxPlayers-1); err != nil {
		t.Fatalf("fill side a: %v", err)
	}
	overflow, err := f.register(seedMatchUser(t, f.pool), f.sideA.ID, 1)
	if err != nil {
		t.Fatalf("register overflow: %v", err)
	}
	if overflow.GroupID != f.sideB.ID {
		t.Fatalf("expected side b after side a is full, got %s", overflow.GroupID)
	}
}

func TestVenueRegisteredIndividualStaysOnOwnSideWhenUpdated(t *testing.T) {
	f := newVenueFixture(t)
	first := seedMatchUser(t, f.pool)
	if _, err := f.register(first, f.sideA.ID, 1); err != nil {
		t.Fatal(err)
	}
	updated, err := f.register(first, f.sideB.ID, 2)
	if err != nil {
		t.Fatalf("update count: %v", err)
	}
	if updated.GroupID != f.sideA.ID || updated.RegistrationCount != 2 {
		t.Fatalf("expected update on side a, got %+v", updated)
	}
}

func TestVenueTeamClaimsEmptySideAndMembersRegister(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	if _, err := f.register(seedMatchUser(t, f.pool), f.sideA.ID, 1); err != nil {
		t.Fatal(err)
	}
	manager, team := f.seedTeam("leader")
	claimed, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team)
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if claimed.Side == nil || *claimed.Side != domain.SideB || claimed.Kind != domain.GroupGuestTeam {
		t.Fatalf("expected team group on side b, got %+v", claimed)
	}
	if _, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team); !isErrKind(err, sharederror.KindConflict) {
		t.Fatalf("team must not claim both sides, got %v", err)
	}
	otherManager, otherTeam := f.seedTeam("captain")
	if _, err := f.sides.Claim(ctx, venueUser(otherManager), f.match.ID, otherTeam); !isErrKind(err, sharederror.KindConflict) {
		t.Fatalf("no empty side should remain, got %v", err)
	}

	member, outsider := seedMatchUser(t, f.pool), seedMatchUser(t, f.pool)
	f.addMember(team, member, "member")
	if _, err := f.register(member, claimed.ID, 1); err != nil {
		t.Fatalf("member register: %v", err)
	}
	if _, err := f.register(outsider, claimed.ID, 1); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("outsider must not join the team side, got %v", err)
	}
	if _, err := f.register(member, f.sideA.ID, 1); !isErrKind(err, sharederror.KindConflict) {
		t.Fatalf("team member must not register as an individual, got %v", err)
	}
	if _, err := f.register(outsider, f.sideA.ID, 1); err != nil {
		t.Fatalf("outsider registers as an individual: %v", err)
	}
}

func TestVenueNonManagerCannotClaim(t *testing.T) {
	f := newVenueFixture(t)
	_, team := f.seedTeam("captain")
	if _, err := f.sides.Claim(context.Background(), venueUser(seedMatchUser(t, f.pool)), f.match.ID, team); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestVenueRemovedTeamReopensSideAndNotifies(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	manager, team := f.seedTeam("captain")
	claimed, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team)
	if err != nil {
		t.Fatal(err)
	}
	member := seedMatchUser(t, f.pool)
	f.addMember(team, member, "member")
	if _, err := f.register(member, claimed.ID, 1); err != nil {
		t.Fatal(err)
	}
	if err := f.sides.Remove(ctx, venueUser(manager), f.match.ID, claimed.ID); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("only the publisher can remove a team, got %v", err)
	}
	if err := f.sides.Remove(ctx, venueUser(f.publisher), f.match.ID, claimed.ID); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if len(f.notifier.users) != 2 {
		t.Fatalf("expected captain and registered member notified, got %v", f.notifier.users)
	}
	groups := f.activeGroups()
	if len(groups) != 2 || groups[0].Kind != domain.GroupIndividualOpponent || groups[1].Kind != domain.GroupIndividualOpponent {
		t.Fatalf("both sides should be open again: %+v", groups)
	}
	// 队员报名已随组失效，可以重新以散人身份报名。
	registration, err := f.register(member, groups[0].ID, 1)
	if err != nil {
		t.Fatalf("member registers as individual after removal: %v", err)
	}
	if registration.GroupID == claimed.ID {
		t.Fatal("registration must not stay on the cancelled group")
	}
}

func TestVenueTeamWithdrawsAndCannotReleaseAfterStart(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	manager, team := f.seedTeam("captain")
	claimed, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team)
	if err != nil {
		t.Fatal(err)
	}
	started := application.NewVenueSideService(f.repo, f.teams, defaults.Service{}, f.notifier, venueTestClock{now: f.match.StartTime.Add(time.Minute)})
	if err := started.Withdraw(ctx, venueUser(manager), f.match.ID, claimed.ID); !isErrKind(err, sharederror.KindConflict) {
		t.Fatalf("withdraw after start must conflict, got %v", err)
	}
	if err := f.sides.Withdraw(ctx, venueUser(seedMatchUser(t, f.pool)), f.match.ID, claimed.ID); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("outsider must not withdraw, got %v", err)
	}
	if err := f.sides.Withdraw(ctx, venueUser(manager), f.match.ID, claimed.ID); err != nil {
		t.Fatalf("withdraw: %v", err)
	}
	if len(f.notifier.users) != 0 {
		t.Fatalf("withdrawal must not notify, got %v", f.notifier.users)
	}
	if _, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team); err != nil {
		t.Fatalf("team can claim again after withdrawing: %v", err)
	}
}

func TestVenueSidesEmptyAgainBecomeClaimable(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	first, second := seedMatchUser(t, f.pool), seedMatchUser(t, f.pool)
	if _, err := f.register(first, f.sideA.ID, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := f.registrations.Delete(ctx, venueUser(first), f.match.ID, f.sideA.ID); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if _, err := f.register(second, f.sideA.ID, 1); err != nil {
		t.Fatal(err)
	}
	manager, team := f.seedTeam("captain")
	claimed, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team)
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if *claimed.Side != domain.SideB {
		t.Fatalf("expected side b, got %s", *claimed.Side)
	}
}

func TestVenueMatchConfirmedOnlyWhenBothSidesReady(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	if _, err := f.register(seedMatchUser(t, f.pool), f.sideA.ID, 2); err != nil {
		t.Fatal(err)
	}
	manager, team := f.seedTeam("captain")
	claimed, err := f.sides.Claim(ctx, venueUser(manager), f.match.ID, team)
	if err != nil {
		t.Fatal(err)
	}
	state := func() domain.OpponentState {
		match, _, _, err := f.repo.FindByID(ctx, f.match.ID)
		if err != nil {
			t.Fatal(err)
		}
		return match.OpponentState
	}
	if state() != domain.OpponentRecruiting {
		t.Fatal("team side has not reached the minimum yet")
	}
	for range 2 {
		member := seedMatchUser(t, f.pool)
		f.addMember(team, member, "member")
		if _, err := f.register(member, claimed.ID, 1); err != nil {
			t.Fatal(err)
		}
	}
	if state() != domain.OpponentConfirmed {
		t.Fatal("both sides reached the minimum")
	}
}

func TestVenueConcurrentClaimAndRegistrationNeverShareASide(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	managerA, teamA := f.seedTeam("captain")
	managerB, teamB := f.seedTeam("captain")
	individual := seedMatchUser(t, f.pool)
	var wait sync.WaitGroup
	wait.Add(3)
	go func() { defer wait.Done(); _, _ = f.sides.Claim(ctx, venueUser(managerA), f.match.ID, teamA) }()
	go func() { defer wait.Done(); _, _ = f.sides.Claim(ctx, venueUser(managerB), f.match.ID, teamB) }()
	go func() { defer wait.Done(); _, _ = f.register(individual, f.sideA.ID, 1) }()
	wait.Wait()

	groups := f.activeGroups()
	if len(groups) != 2 {
		t.Fatalf("each side must keep exactly one active group: %+v", groups)
	}
	for _, group := range groups {
		if group.Kind != domain.GroupGuestTeam {
			continue
		}
		var count int
		if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM match_registrations WHERE group_id=$1 AND status<>'cancelled' AND user_id=$2`, group.ID, individual).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("individual must never land on a team side")
		}
	}
}

func TestVenueMatchHiddenFromListsWithoutExplicitMode(t *testing.T) {
	f := newVenueFixture(t)
	ctx := context.Background()
	queries := application.NewUserMatchQueryService(f.repo)
	viewer := venueUser(seedMatchUser(t, f.pool))
	legacy, err := queries.List(ctx, viewer, application.UserMatchListQuery{Scope: application.MatchScopeAll})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range legacy.Items {
		if item.Match.ID == f.match.ID {
			t.Fatal("legacy clients must not receive venue matches")
		}
	}
	explicit, err := queries.List(ctx, viewer, application.UserMatchListQuery{
		Scope: application.MatchScopeAll, PublicationModes: []domain.PublicationMode{domain.VenueHosted},
	})
	if err != nil {
		t.Fatal(err)
	}
	if explicit.Total != 1 {
		t.Fatalf("expected the venue match, got %d", explicit.Total)
	}
	// 旧版通过分享链接打开详情也必须能读到完整的两边。
	detail, err := queries.Get(ctx, viewer, f.match.ID)
	if err != nil {
		t.Fatalf("detail: %v", err)
	}
	if len(detail.Groups) != 2 {
		t.Fatalf("expected two groups, got %d", len(detail.Groups))
	}
}

func TestOnlyVenueUsersCanPublishVenueMatches(t *testing.T) {
	f := newVenueFixture(t)
	now := time.Now().UTC()
	command := application.CreateMatchCommand{
		Name: "场馆组局", PublicationMode: domain.VenueHosted, PlayersPerTeam: 5, Location: "球场",
		StartTime: now.Add(time.Hour), EndTime: now.Add(2 * time.Hour),
	}
	creator := application.NewCreateMatch(f.repo, f.teams, defaults.Service{}, venueTestClock{now: now}).
		WithVenueAccess(venueTestAccess{venues: map[int64]bool{}})
	if _, err := creator.Execute(context.Background(), venueUser(seedMatchUser(t, f.pool)), command); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := creator.Execute(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, command); !isErrKind(err, sharederror.KindForbidden) {
		t.Fatalf("admins must not publish venue matches, got %v", err)
	}
}
