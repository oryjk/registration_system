package postgres

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestUserRegistrationRepositoryPersistsCancellationAndReactivation(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	userID := seedMatchUser(t, pool)
	match, groups := newPersistableIndividualMatch(t, ownerID, teamID, 1, 2)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	service := matchapplication.NewUserRegistrationService(repository, repositoryTestClock{now: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)})

	created, err := service.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, match.ID, groups[1].ID, matchapplication.PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 1,
	})
	if err != nil {
		t.Fatalf("put registration: %v", err)
	}
	cancelled, err := service.Delete(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, match.ID, groups[1].ID)
	if err != nil || cancelled.ID != created.ID || cancelled.Status != domain.RegistrationCancelled {
		t.Fatalf("cancel registration: %+v err=%v", cancelled, err)
	}
	repeated, err := service.Delete(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, match.ID, groups[1].ID)
	if err != nil || repeated.ID != cancelled.ID || repeated.CancelledAt == nil || cancelled.CancelledAt == nil || !repeated.CancelledAt.Equal(*cancelled.CancelledAt) {
		t.Fatalf("repeat cancellation must preserve the row and timestamp: %+v err=%v", repeated, err)
	}
	reactivated, err := service.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, match.ID, groups[1].ID, matchapplication.PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 1,
	})
	if err != nil || reactivated.ID != created.ID || reactivated.CancelledAt != nil {
		t.Fatalf("reactivate registration: %+v err=%v", reactivated, err)
	}
}

func TestUserRegistrationRepositoryIgnoresRegistrationInCancelledGroup(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, hostTeamID := seedMatchOwner(t, pool)
	userID := seedMatchUser(t, pool)
	_, guestTeamID := seedApplicationTeam(t, pool, "已取消客队")
	match, groups := newPersistableMatch(t, ownerID, hostTeamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	cancelledGroupID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (
			id, match_id, kind, team_id, max_players, status, cancelled_at
		) VALUES ($1, $2, 'guest_team', $3, 8, 'cancelled', NOW())`,
		cancelledGroupID, match.ID, guestTeamID); err != nil {
		t.Fatalf("seed cancelled guest group: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count)
		VALUES ($1, $2, $3, 'attending', 1)`, uuid.New(), cancelledGroupID, userID); err != nil {
		t.Fatalf("seed registration in cancelled group: %v", err)
	}

	err := repository.WithinUserRegistrationTransaction(ctx, func(tx ports.UserRegistrationTransaction) error {
		registration, found, err := tx.FindActiveUserRegistrationInMatchForUpdate(ctx, match.ID, userID)
		if err != nil {
			return err
		}
		if found {
			t.Fatalf("cancelled group registration must not be active: %+v", registration)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("find active registration: %v", err)
	}
}

func TestUserRegistrationMembershipCheckUsesTransactionConnection(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	userID := seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'member', 'active')`, teamID, userID); err != nil {
		t.Fatalf("seed active member: %v", err)
	}
	match, groups := newPersistableMatch(t, ownerID, teamID)
	if err := NewRepository(pool).CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	config := pool.Config()
	config.MaxConns = 1
	config.MinConns = 0
	singleConnectionPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("open single-connection pool: %v", err)
	}
	t.Cleanup(singleConnectionPool.Close)
	service := matchapplication.NewUserRegistrationService(
		NewRepository(singleConnectionPool),
		repositoryTestClock{now: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)},
	)
	operationContext, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	registration, err := service.Put(
		operationContext,
		sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID},
		match.ID,
		groups[0].ID,
		matchapplication.PutMyRegistrationCommand{Status: domain.RegistrationAttending, RegistrationCount: 1},
	)
	if err != nil || registration.UserID != userID {
		t.Fatalf("put registration with one connection: %+v err=%v", registration, err)
	}
}

func TestUserRegistrationCapacityRaceAllowsExactlyOneCommit(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	userIDs := []int64{seedMatchUser(t, pool), seedMatchUser(t, pool)}
	match, groups := newPersistableIndividualMatch(t, ownerID, teamID, 1, 1)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	service := matchapplication.NewUserRegistrationService(repository, repositoryTestClock{now: time.Date(2026, 8, 8, 12, 0, 0, 0, time.UTC)})

	start := make(chan struct{})
	errorsByUser := make([]error, len(userIDs))
	var wait sync.WaitGroup
	for index, userID := range userIDs {
		wait.Add(1)
		go func(index int, userID int64) {
			defer wait.Done()
			<-start
			_, errorsByUser[index] = service.Put(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}, match.ID, groups[1].ID, matchapplication.PutMyRegistrationCommand{
				Status: domain.RegistrationAttending, RegistrationCount: 1,
			})
		}(index, userID)
	}
	close(start)
	wait.Wait()

	successes, conflicts := 0, 0
	for _, err := range errorsByUser {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, sharederror.ErrConflict):
			conflicts++
		default:
			t.Fatalf("unexpected registration result: %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("expected one success and one conflict, got success=%d conflict=%d errors=%v", successes, conflicts, errorsByUser)
	}
	var attending int
	if err := pool.QueryRow(ctx, `SELECT COALESCE(SUM(registration_count), 0) FROM match_registrations WHERE group_id = $1 AND status = 'attending'`, groups[1].ID).Scan(&attending); err != nil {
		t.Fatalf("count registrations: %v", err)
	}
	if attending != 1 {
		t.Fatalf("capacity exceeded: %d", attending)
	}
}

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

func seedMatchUser(t *testing.T, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}) int64 {
	t.Helper()
	var userID int64
	if err := pool.QueryRow(context.Background(), `INSERT INTO users (openid) VALUES ($1) RETURNING id`, "user-"+uuid.NewString()).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return userID
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

func newPersistableIndividualMatch(t *testing.T, userID, teamID int64, minPlayers, maxPlayers int) (domain.Match, []domain.RegistrationGroup) {
	t.Helper()
	start := time.Date(2026, 8, 20, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "散人约球", PublicationMode: domain.OnlineIndividual, HostTeamID: teamID,
		CreatedByUserID: int64Pointer(userID), PlayersPerTeam: minPlayers,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "东安球场", CreatedAt: start.Add(-24 * time.Hour),
	}, domain.IndividualLimits{MinPlayers: minPlayers, MaxPlayers: maxPlayers})
	if err != nil {
		t.Fatalf("new individual match: %v", err)
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

func TestRepositoryListsUserHomeMatches(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	actorID, actorTeamID := seedMatchOwner(t, pool)
	unrelatedUserID, unrelatedTeamID := seedMatchOwner(t, pool)
	inactiveOwnerID, inactiveTeamID := seedMatchOwner(t, pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'member', 'active'),
		       ($3, $4, 'member', 'active'),
		       ($5, $2, 'member', 'inactive')`,
		actorTeamID, actorID, unrelatedTeamID, unrelatedUserID, inactiveTeamID); err != nil {
		t.Fatalf("seed memberships: %v", err)
	}

	now := time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC)
	ongoingID, _ := seedHomeMatch(t, pool, actorID, actorTeamID, "正在进行", domain.MatchOngoing, now.Add(-time.Hour))
	registeringID, registeringGroupID := seedHomeMatch(t, pool, actorID, actorTeamID, "等待报名", domain.MatchRegistering, now.Add(2*time.Hour))
	registrationOnlyID, registrationOnlyGroupID := seedHomeMatch(t, pool, unrelatedUserID, unrelatedTeamID, "仅报名相关", domain.MatchRegistering, now.Add(time.Hour))
	seedHomeMatch(t, pool, unrelatedUserID, unrelatedTeamID, "无关比赛", domain.MatchRegistering, now.Add(30*time.Minute))
	seedHomeMatch(t, pool, inactiveOwnerID, inactiveTeamID, "失效成员比赛", domain.MatchRegistering, now.Add(45*time.Minute))

	leaveUserID := seedHomeUser(t, pool)
	absentUserID := seedHomeUser(t, pool)
	cancelledUserID := seedHomeUser(t, pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, cancelled_at)
		VALUES ($1, $2, $3, 'attending', 1, NULL),
		       ($4, $2, $5, 'attending', 2, NULL),
		       ($6, $2, $7, 'leave', 4, NULL),
		       ($8, $2, $9, 'absent', 5, NULL),
		       ($10, $2, $11, 'cancelled', 6, NOW()),
		       ($12, $13, $3, 'leave', 1, NULL),
		       ($14, $13, $5, 'attending', 2, NULL)`,
		uuid.New(), registeringGroupID, actorID,
		uuid.New(), unrelatedUserID,
		uuid.New(), leaveUserID,
		uuid.New(), absentUserID,
		uuid.New(), cancelledUserID,
		uuid.New(), registrationOnlyGroupID,
		uuid.New()); err != nil {
		t.Fatalf("seed home registration states: %v", err)
	}

	registrationOnlyEndedID, registrationOnlyEndedGroupID := seedHomeMatch(
		t, pool, unrelatedUserID, unrelatedTeamID, "仅报名相关历史", domain.MatchEnded, now.Add(-30*time.Minute),
	)
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count)
		VALUES ($1, $2, $3, 'leave', 1)`, uuid.New(), registrationOnlyEndedGroupID, actorID); err != nil {
		t.Fatalf("seed ended registration-only relation: %v", err)
	}
	seedHomeMatch(t, pool, inactiveOwnerID, inactiveTeamID, "失效成员历史", domain.MatchEnded, now.Add(-15*time.Minute))
	seedHomeMatch(t, pool, unrelatedUserID, unrelatedTeamID, "无关历史比赛", domain.MatchEnded, now)

	endedIDs := []uuid.UUID{registrationOnlyEndedID}
	for day := 1; day <= 6; day++ {
		matchID, _ := seedHomeMatch(t, pool, actorID, actorTeamID, "已结束比赛", domain.MatchEnded, now.AddDate(0, 0, -day))
		endedIDs = append(endedIDs, matchID)
	}

	repository := NewRepository(pool)
	actions, err := repository.ListHomeActionItems(ctx, actorID, 3)
	if err != nil {
		t.Fatalf("list home action matches: %v", err)
	}
	if len(actions) != 3 ||
		actions[0].Item.Match.ID != ongoingID ||
		actions[1].Item.Match.ID != registrationOnlyID ||
		actions[2].Item.Match.ID != registeringID {
		t.Fatalf("unexpected action matches: %+v", actions)
	}
	registrationOnlyState := actions[1].Group
	if registrationOnlyState.AttendingCount != 2 ||
		registrationOnlyState.MyRegistration == nil ||
		registrationOnlyState.MyRegistration.Status != domain.RegistrationLeave {
		t.Fatalf("unexpected registration-only state: %+v", registrationOnlyState)
	}
	registrationState := actions[2].Group
	if registrationState.AttendingCount != 3 || registrationState.MyRegistration == nil || registrationState.MyRegistration.UserID != actorID {
		t.Fatalf("unexpected registration state: %+v", registrationState)
	}
	if registrationState.MyRegistration.Status != domain.RegistrationAttending {
		t.Fatalf("unexpected current registration: %+v", registrationState.MyRegistration)
	}

	ended, err := repository.ListHomeEndedItems(ctx, actorID, 7)
	if err != nil {
		t.Fatalf("list home ended matches: %v", err)
	}
	if len(ended) != 7 {
		t.Fatalf("expected seven ended matches, got %d: %+v", len(ended), ended)
	}
	for index := range endedIDs {
		if ended[index].Match.ID != endedIDs[index] {
			t.Fatalf("ended order mismatch at %d: got %s want %s", index, ended[index].Match.ID, endedIDs[index])
		}
	}
}

func seedHomeUser(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	var userID int64
	if err := pool.QueryRow(
		context.Background(),
		`INSERT INTO users (openid) VALUES ($1) RETURNING id`,
		"home-user-"+uuid.NewString(),
	).Scan(&userID); err != nil {
		t.Fatalf("seed home user: %v", err)
	}
	return userID
}

func seedHomeMatch(
	t *testing.T,
	pool *pgxpool.Pool,
	createdByUserID, teamID int64,
	name string,
	status domain.MatchStatus,
	startTime time.Time,
) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	matchID := uuid.New()
	groupID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO matches (
			id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
			players_per_team, start_time, end_time, location, created_by_user_id
		) VALUES ($1, $2, 'offline_confirmed', 'no_recruitment', $3, $4, '测试对手', 8, $5, $6, '测试球场', $7)`,
		matchID, name, string(status), teamID, startTime, startTime.Add(2*time.Hour), createdByUserID); err != nil {
		t.Fatalf("seed home match: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (id, match_id, kind, team_id, max_players, status)
		VALUES ($1, $2, 'host_team', $3, 8, 'open')`, groupID, matchID, teamID); err != nil {
		t.Fatalf("seed home group: %v", err)
	}
	return matchID, groupID
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

func (a repositoryTestTeamAccess) EnsureActiveMember(ctx context.Context, teamID, userID int64) error {
	return a.EnsureManager(ctx, teamID, userID)
}

func (a repositoryTestTeamAccess) IsActiveMember(_ context.Context, teamID, userID int64) (bool, error) {
	return a.managers[teamID] == userID, nil
}

type repositoryTestClock struct {
	now time.Time
}

func (c repositoryTestClock) Now() time.Time { return c.now }

var _ ports.TeamAccess = repositoryTestTeamAccess{}
