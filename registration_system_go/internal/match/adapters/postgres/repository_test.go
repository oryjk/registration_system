package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryCreatesAndFindsMatchWithGroups(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)

	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	found, foundGroups, ok, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("find match: %v", err)
	}
	if !ok || found.ID != match.ID || len(foundGroups) != len(groups) {
		t.Fatalf("unexpected persisted aggregate: match=%+v groups=%+v ok=%v", found, foundGroups, ok)
	}
}

func TestRepositoryRollsBackMatchWhenGroupInsertFails(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	duplicate := groups[0]
	duplicate.ID = uuid.New()
	groups = append(groups, duplicate)
	repository := NewRepository(pool)

	if err := repository.CreateWithGroups(ctx, match, groups); err == nil {
		t.Fatal("expected duplicate group insert to fail")
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE id = $1`, match.ID).Scan(&count); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected transaction rollback, found %d match rows", count)
	}
}

func TestRepositoryDeletesMatchAndCascadesBusinessData(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id)
		VALUES ($1, $2, $3)`, uuid.New(), groups[0].ID, userID); err != nil {
		t.Fatalf("seed registration: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_team_applications (id, match_id, applicant_team_id, introduction, created_by_user_id)
		VALUES ($1, $2, $3, '申请参赛', $4)`, uuid.New(), match.ID, teamID, userID); err != nil {
		t.Fatalf("seed team application: %v", err)
	}

	deleted, err := repository.Delete(ctx, match.ID)
	if err != nil {
		t.Fatalf("delete match: %v", err)
	}
	if !deleted {
		t.Fatal("expected match to be deleted")
	}

	checks := []struct {
		table string
		query string
		id    uuid.UUID
	}{
		{table: "matches", query: `SELECT COUNT(*) FROM matches WHERE id = $1`, id: match.ID},
		{table: "match_registration_groups", query: `SELECT COUNT(*) FROM match_registration_groups WHERE match_id = $1`, id: match.ID},
		{table: "match_registrations", query: `SELECT COUNT(*) FROM match_registrations WHERE group_id = $1`, id: groups[0].ID},
		{table: "match_team_applications", query: `SELECT COUNT(*) FROM match_team_applications WHERE match_id = $1`, id: match.ID},
	}
	for _, check := range checks {
		var count int
		if err := pool.QueryRow(ctx, check.query, check.id).Scan(&count); err != nil {
			t.Fatalf("count %s: %v", check.table, err)
		}
		if count != 0 {
			t.Fatalf("expected %s to be deleted, found %d rows", check.table, count)
		}
	}
}

func seedMatchOwner(t *testing.T, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) (int64, int64) {
	t.Helper()
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, "owner-"+uuid.NewString()).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('东安联队', $1) RETURNING id`, userID).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	return userID, teamID
}

func newPersistableMatch(t *testing.T, userID, teamID int64) (domain.Match, []domain.RegistrationGroup) {
	t.Helper()
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name:            "周末约球",
		PublicationMode: domain.OnlineTeam,
		HostTeamID:      teamID,
		CreatedByUserID: int64Pointer(userID),
		PlayersPerTeam:  8,
		StartTime:       start,
		EndTime:         start.Add(2 * time.Hour),
		Location:        "东安球场",
		CreatedAt:       start.Add(-24 * time.Hour),
	}, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	return match, groups
}

func int64Pointer(value int64) *int64 { return &value }

func TestRepositoryListsTeamGroupRoster(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	var memberID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname, real_name) VALUES ($1, $2, $3) RETURNING id`,
		"member-"+uuid.NewString(), "阿东", "李东").Scan(&memberID); err != nil {
		t.Fatalf("seed member user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain'), ($1, $3, 'member')`,
		teamID, userID, memberID); err != nil {
		t.Fatalf("seed team members: %v", err)
	}

	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registration, err := domain.NewRegistration(groups[0].ID, userID, domain.RegistrationAttending, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	entries, err := repository.ListRosterForGroup(ctx, groups[0])
	if err != nil {
		t.Fatalf("list roster: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 roster entries, got %d: %+v", len(entries), entries)
	}
	attending := entries[0]
	if attending.UserID != userID || attending.Status == nil || *attending.Status != domain.RegistrationAttending {
		t.Fatalf("unexpected attending entry: %+v", attending)
	}
	if attending.MemberRole == nil || *attending.MemberRole != "captain" {
		t.Fatalf("expected captain role, got %+v", attending.MemberRole)
	}
	unregistered := entries[1]
	if unregistered.UserID != memberID || unregistered.Status != nil {
		t.Fatalf("expected unregistered member without status, got %+v", unregistered)
	}
	if unregistered.Nickname != "阿东" || unregistered.RealName == nil || *unregistered.RealName != "李东" {
		t.Fatalf("unexpected member profile: %+v", unregistered)
	}
}

func TestRepositoryListsIndividualGroupRegistrations(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	now := time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)
	individual := domain.NewIndividualGroup(match.ID, domain.IndividualLimits{MinPlayers: 8, MaxPlayers: 10}, now)
	groups = append(groups, individual)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	registration, err := domain.NewRegistration(individual.ID, userID, domain.RegistrationLeave, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	entries, err := repository.ListRosterForGroup(ctx, individual)
	if err != nil {
		t.Fatalf("list roster: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 roster entry, got %d: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.UserID != userID || entry.Status == nil || *entry.Status != domain.RegistrationLeave {
		t.Fatalf("unexpected individual entry: %+v", entry)
	}
	if entry.MemberRole != nil {
		t.Fatalf("individual entry must not carry member role, got %+v", entry.MemberRole)
	}

	item, states, found, err := repository.FindForUser(ctx, match.ID, userID)
	if err != nil || !found || item.Match.ID != match.ID {
		t.Fatalf("find user match detail: found=%t item=%+v err=%v", found, item, err)
	}
	var individualState *ports.UserGroupState
	for index := range states {
		if states[index].Group.ID == individual.ID {
			individualState = &states[index]
			break
		}
	}
	if individualState == nil || individualState.MyRegistration == nil {
		t.Fatalf("missing current user registration state: %+v", states)
	}
	if individualState.MyRegistration.Status != domain.RegistrationLeave || individualState.AttendingCount != 0 {
		t.Fatalf("leave must not count as attending: %+v", individualState)
	}
}

func TestRepositoryCreatesRegistration(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registration, err := domain.NewRegistration(groups[0].ID, userID, domain.RegistrationAttending, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	var status string
	var count int
	err = pool.QueryRow(ctx,
		`SELECT status, registration_count FROM match_registrations WHERE group_id=$1 AND user_id=$2`,
		groups[0].ID, userID).Scan(&status, &count)
	if err != nil {
		t.Fatalf("query registration: %v", err)
	}
	if status != string(domain.RegistrationAttending) || count != 1 {
		t.Fatalf("unexpected registration: status=%s count=%d", status, count)
	}
}

func TestRepositoryPersistsTeamApplicationSelectionAndWithdrawalAtomically(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	hostUserID, hostTeamID := seedMatchOwner(t, pool)
	firstUserID, firstTeamID := seedApplicationTeam(t, pool, "候选一队")
	secondUserID, secondTeamID := seedApplicationTeam(t, pool, "候选二队")
	match, groups := newPersistableMatch(t, hostUserID, hostTeamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	access := repositoryTestTeamAccess{managers: map[int64]int64{
		hostTeamID: hostUserID, firstTeamID: firstUserID, secondTeamID: secondUserID,
	}}
	service := matchapplication.NewTeamApplicationService(repository, access, repositoryTestClock{now: match.CreatedAt.Add(time.Hour)})
	first, err := service.Apply(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: firstUserID}, match.ID, firstTeamID, "第一队申请")
	if err != nil {
		t.Fatalf("first application: %v", err)
	}
	second, err := service.Apply(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: secondUserID}, match.ID, secondTeamID, "第二队申请")
	if err != nil {
		t.Fatalf("second application: %v", err)
	}

	selected, err := service.Select(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: hostUserID}, match.ID, second.ID)
	if err != nil {
		t.Fatalf("select application: %v", err)
	}
	if selected.Status != domain.ApplicationSelected {
		t.Fatalf("unexpected selected application: %+v", selected)
	}
	persistedMatch, persistedGroups, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found {
		t.Fatalf("find selected match: found=%t err=%v", found, err)
	}
	if persistedMatch.AwayTeamID == nil || *persistedMatch.AwayTeamID != secondTeamID || persistedMatch.OpponentState != domain.OpponentConfirmed {
		t.Fatalf("opponent selection not persisted: %+v", persistedMatch)
	}
	if len(persistedGroups) != 2 || persistedGroups[1].Kind != domain.GroupGuestTeam || persistedGroups[1].TeamID == nil || *persistedGroups[1].TeamID != secondTeamID {
		t.Fatalf("guest group not persisted: %+v", persistedGroups)
	}
	applications, err := repository.ListApplications(ctx, match.ID)
	if err != nil {
		t.Fatalf("list applications: %v", err)
	}
	statuses := map[uuid.UUID]domain.ApplicationStatus{}
	for _, item := range applications {
		statuses[item.Application.ID] = item.Application.Status
	}
	if statuses[first.ID] != domain.ApplicationRejected || statuses[second.ID] != domain.ApplicationSelected {
		t.Fatalf("application decisions not persisted: %+v", statuses)
	}

	withdrawn, err := service.Withdraw(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: secondUserID}, match.ID, second.ID)
	if err != nil {
		t.Fatalf("withdraw selected application: %v", err)
	}
	if withdrawn.Status != domain.ApplicationWithdrawn {
		t.Fatalf("unexpected withdrawn application: %+v", withdrawn)
	}
	persistedMatch, persistedGroups, found, err = repository.FindByID(ctx, match.ID)
	if err != nil || !found || persistedMatch.AwayTeamID != nil || persistedMatch.OpponentState != domain.OpponentRecruiting {
		t.Fatalf("reopened match not persisted: found=%t match=%+v err=%v", found, persistedMatch, err)
	}
	if persistedGroups[1].Status != domain.GroupCancelled || persistedGroups[1].CancelledAt == nil {
		t.Fatalf("guest group cancellation not persisted: %+v", persistedGroups[1])
	}
}

func seedApplicationTeam(t *testing.T, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, name string) (int64, int64) {
	t.Helper()
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, "applicant-"+uuid.NewString()).Scan(&userID); err != nil {
		t.Fatalf("seed applicant user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ($1) RETURNING id`, name).Scan(&teamID); err != nil {
		t.Fatalf("seed applicant team: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'leader') RETURNING id`, teamID, userID).Scan(new(int64)); err != nil {
		t.Fatalf("seed applicant manager: %v", err)
	}
	return userID, teamID
}

type repositoryTestTeamAccess struct {
	managers map[int64]int64
}

func (a repositoryTestTeamAccess) EnsureManager(_ context.Context, teamID, userID int64) error {
	if a.managers[teamID] != userID {
		return sharederror.ErrForbidden
	}
	return nil
}

func (repositoryTestTeamAccess) EnsureExists(context.Context, int64) error { return nil }
func (repositoryTestTeamAccess) EnsureActive(context.Context, int64) error { return nil }

type repositoryTestClock struct {
	now time.Time
}

func (c repositoryTestClock) Now() time.Time { return c.now }

var _ ports.TeamAccess = repositoryTestTeamAccess{}
