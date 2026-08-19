package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
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

func TestRepositoryUpdateDetailsPersistsHostCapacity(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	hostGroup := groups[0]
	if err := hostGroup.UpdateHostCapacity(12, time.Date(2026, 8, 17, 10, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("update capacity: %v", err)
	}
	if err := repository.UpdateDetails(ctx, match, &hostGroup); err != nil {
		t.Fatalf("update details: %v", err)
	}

	_, persistedGroups, _, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("find match: %v", err)
	}
	if len(persistedGroups) != 1 || persistedGroups[0].MaxPlayers == nil || *persistedGroups[0].MaxPlayers != 12 {
		t.Fatalf("expected host group capacity 12, got %+v", persistedGroups)
	}
}

func TestRepositoryUpdateDetailsPersistsOpponentName(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	start := time.Date(2026, 8, 20, 18, 0, 0, 0, time.UTC)
	opponent := "老对手联"
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "线下约球", PublicationMode: domain.OfflineConfirmed, HostTeamID: &teamID,
		CreatedByUserID: int64Pointer(userID), OpponentName: &opponent, PlayersPerTeam: 8,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "东安球场",
		CreatedAt: start.Add(-24 * time.Hour),
	}, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	renamed := "新对手队"
	if err := match.UpdateDetails(domain.UpdateMatchDetails{
		Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime,
		Location: match.Location, OpponentName: &renamed,
	}, time.Date(2026, 8, 19, 9, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("update details: %v", err)
	}
	if err := repository.UpdateDetails(ctx, match, nil); err != nil {
		t.Fatalf("persist details: %v", err)
	}

	persisted, _, _, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("find match: %v", err)
	}
	if persisted.OpponentName == nil || *persisted.OpponentName != "新对手队" {
		t.Fatalf("opponent name not persisted: %+v", persisted.OpponentName)
	}

	// 传空串表示清除；线下已约比赛禁止清空，由 domain 校验拦截。
	empty := ""
	if err := persisted.UpdateDetails(domain.UpdateMatchDetails{
		Name: persisted.Name, StartTime: persisted.StartTime, EndTime: persisted.EndTime,
		Location: persisted.Location, OpponentName: &empty,
	}, time.Date(2026, 8, 19, 9, 30, 0, 0, time.UTC)); err == nil {
		t.Fatal("expected clearing opponent on offline match to be rejected")
	}
}

func TestRepositoryPersistsJerseyColors(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)

	input := validOnlineTeamInput(t, ownerID, teamID)
	host, away := "#2F6BFF", "#C8FF00"
	input.HostColor, input.AwayColor = &host, &away
	match, groups, err := domain.NewMatch(input, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create: %v", err)
	}

	loaded, _, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found {
		t.Fatalf("find: %v found=%v", err, found)
	}
	if loaded.HostColor != "#2f6bff" || loaded.AwayColor != "#c8ff00" {
		t.Fatalf("colors not round-tripped: %q %q", loaded.HostColor, loaded.AwayColor)
	}

	// HTTP 详情/列表响应共用这些读侧映射，颜色必须原样带出。
	detail, _, detailFound, err := repository.FindForAdmin(ctx, match.ID)
	if err != nil || !detailFound {
		t.Fatalf("find for admin: %v found=%v", err, detailFound)
	}
	if detail.Match.HostColor != "#2f6bff" || detail.Match.AwayColor != "#c8ff00" {
		t.Fatalf("detail colors not mapped: %q %q", detail.Match.HostColor, detail.Match.AwayColor)
	}
	adminItems, err := repository.ListForAdmin(ctx, ports.AdminMatchFilter{Limit: 20})
	if err != nil {
		t.Fatalf("list for admin: %v", err)
	}
	if !matchItemInList(adminItems, match.ID, "#2f6bff", "#c8ff00") {
		t.Fatalf("admin list colors not mapped for %s", match.ID)
	}
	userItems, err := repository.ListForUser(ctx, ports.MatchListFilter{Scope: ports.MatchScopeAll, UserID: ownerID, Limit: 20})
	if err != nil {
		t.Fatalf("list for user: %v", err)
	}
	if !matchItemInList(userItems, match.ID, "#2f6bff", "#c8ff00") {
		t.Fatalf("user list colors not mapped for %s", match.ID)
	}

	clear := ""
	loaded.HostColor = ""
	loaded.AwayColor = ""
	if err := loaded.UpdateDetails(domain.UpdateMatchDetails{
		Name: loaded.Name, StartTime: loaded.StartTime, EndTime: loaded.EndTime,
		Location: loaded.Location, HostColor: &clear, AwayColor: &clear,
	}, time.Now().UTC()); err != nil {
		t.Fatalf("clear colors: %v", err)
	}
	if err := repository.UpdateDetails(ctx, loaded, nil); err != nil {
		t.Fatalf("update: %v", err)
	}
	reloaded, _, _, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("refind: %v", err)
	}
	if reloaded.HostColor != "" || reloaded.AwayColor != "" {
		t.Fatalf("cleared colors should be empty, got %q %q", reloaded.HostColor, reloaded.AwayColor)
	}
}

// matchItemInList 校验列表项中目标比赛的颜色已从数据库行映射到领域对象。
func matchItemInList(items []ports.MatchItem, matchID uuid.UUID, hostColor, awayColor string) bool {
	for _, item := range items {
		if item.Match.ID != matchID {
			continue
		}
		return item.Match.HostColor == hostColor && item.Match.AwayColor == awayColor
	}
	return false
}

// validOnlineTeamInput 返回可持久化的线上约队比赛输入（字段对齐 domain 包测试的 validInput，
// 起止时间晚于 now），供需要直接操作 NewMatchInput 的用例在设置额外字段后构造比赛。
func validOnlineTeamInput(t *testing.T, ownerID, teamID int64) domain.NewMatchInput {
	t.Helper()
	start := time.Now().UTC().Add(48 * time.Hour)
	hostCapacity := 12
	return domain.NewMatchInput{
		Name:              "周末友谊赛",
		PublicationMode:   domain.OnlineTeam,
		HostTeamID:        &teamID,
		CreatedByUserID:   &ownerID,
		PlayersPerTeam:    8,
		HostCapacityLimit: &hostCapacity,
		StartTime:         start,
		EndTime:           start.Add(2 * time.Hour),
		Location:          "东安球场",
		CreatedAt:         time.Now().UTC(),
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
		HostTeamID:      &teamID,
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
		Name: "散人约球", PublicationMode: domain.OnlineIndividual, HostTeamID: &teamID,
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

func newPersistablePickupMatch(t *testing.T, userID int64, minPlayers, maxPlayers int, paymentMode domain.PaymentMode, feeCents int64) (domain.Match, []domain.RegistrationGroup) {
	t.Helper()
	start := time.Date(2026, 8, 25, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "散人约球多人局", PublicationMode: domain.OnlinePickup,
		CreatedByUserID: int64Pointer(userID), PlayersPerTeam: minPlayers,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "东安球场", CreatedAt: start.Add(-24 * time.Hour),
		PaymentMode: paymentMode, FeePerPersonCents: feeCents,
	}, domain.IndividualLimits{MinPlayers: minPlayers, MaxPlayers: maxPlayers})
	if err != nil {
		t.Fatalf("new pickup match: %v", err)
	}
	return match, groups
}

func TestRepositoryFindForUserReturnsPickupMatchWithPaymentFields(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, _ := seedMatchOwner(t, pool)
	viewerID := seedMatchUser(t, pool)
	match, groups := newPersistablePickupMatch(t, ownerID, 4, 12, domain.PaymentPrepaid, 2500)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create pickup match: %v", err)
	}

	item, _, found, err := repository.FindForUser(ctx, match.ID, viewerID)
	if err != nil || !found || item.Match.ID != match.ID {
		t.Fatalf("pickup match must be visible: found=%t item=%+v err=%v", found, item, err)
	}
	if item.Match.PaymentMode != domain.PaymentPrepaid || item.Match.FeePerPersonCents != 2500 {
		t.Fatalf("payment fields must be mapped: %+v", item.Match)
	}
	if item.HostTeamName != "" {
		t.Fatalf("pickup match has no host team name, got %q", item.HostTeamName)
	}
}

func TestMapAdminDetailMatchIncludesPaymentFields(t *testing.T) {
	row := matchsqlc.GetMatchForAdminRow{
		PublicationMode: string(domain.OnlinePickup), PaymentMode: string(domain.PaymentPrepaid),
		FeePerPersonCents: 2500, IsFree: false,
	}
	match := mapAdminDetailMatch(row)
	if match.PaymentMode != domain.PaymentPrepaid || match.FeePerPersonCents != 2500 || match.IsFree {
		t.Fatalf("payment fields must be mapped: %+v", match)
	}
}

func TestMapUserParticipantsCarriesRegistrationCount(t *testing.T) {
	attending := domain.RegistrationAttending
	participants := mapUserParticipants([]ports.AdminRosterEntry{
		{UserID: 11, Nickname: "张三", Status: &attending, RegistrationCount: 3},
		{UserID: 12, Nickname: "李四", Status: &attending, RegistrationCount: 1},
	})
	if len(participants) != 2 || participants[0].RegistrationCount != 3 || participants[1].RegistrationCount != 1 {
		t.Fatalf("participants should carry registration count: %+v", participants)
	}
}

func TestMapUserParticipantsFiltersNonAttendingAndDeduplicates(t *testing.T) {
	attending := domain.RegistrationAttending
	leave := domain.RegistrationLeave
	firstAvatar := "https://cdn.example.com/first.png"
	secondAvatar := "https://cdn.example.com/second.png"
	participants := mapUserParticipants([]ports.AdminRosterEntry{
		{UserID: 11, Nickname: "阿一", AvatarURL: &firstAvatar, Status: &attending},
		{UserID: 11, Nickname: "阿一重复", AvatarURL: &firstAvatar, Status: &attending},
		{UserID: 12, Nickname: "阿二", AvatarURL: &secondAvatar, Status: &leave},
		{UserID: 13, Nickname: "未报名", Status: nil},
	})

	if len(participants) != 1 || participants[0].UserID != 11 || participants[0].Nickname != "阿一" || participants[0].AvatarURL == nil || *participants[0].AvatarURL != firstAvatar || participants[0].Status != domain.RegistrationAttending {
		t.Fatalf("unexpected user participants: %+v", participants)
	}
}

func TestRepositoryFindForUserIncludesAttendingParticipants(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	secondUserID := seedMatchUser(t, pool)
	leaveUserID := seedMatchUser(t, pool)
	for id, profile := range map[int64][2]string{
		userID:       [2]string{"队长", "https://cdn.example.com/captain.png"},
		secondUserID: [2]string{"阿东", "https://cdn.example.com/dong.png"},
		leaveUserID:  [2]string{"请假队员", "https://cdn.example.com/leave.png"},
	} {
		if _, err := pool.Exec(ctx, `UPDATE users SET nickname = $2, avatar_url = $3 WHERE id = $1`, id, profile[0], profile[1]); err != nil {
			t.Fatalf("seed participant profile: %v", err)
		}
	}

	match, groups := newPersistableIndividualMatch(t, userID, teamID, 1, 8)
	// participants 基于报名记录；队员身份不影响是否展示，这里补齐成员关系模拟真实球队场景。
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'captain', 'active'),
		       ($1, $3, 'member', 'active'),
		       ($1, $4, 'member', 'active')`,
		teamID, userID, secondUserID, leaveUserID); err != nil {
		t.Fatalf("seed team memberships: %v", err)
	}
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	for user, status := range map[int64]domain.RegistrationStatus{
		userID:       domain.RegistrationAttending,
		secondUserID: domain.RegistrationAttending,
		leaveUserID:  domain.RegistrationLeave,
	} {
		registration, err := domain.NewRegistration(groups[0].ID, user, status, 1, now)
		if err != nil {
			t.Fatalf("new registration: %v", err)
		}
		if err := repository.CreateRegistration(ctx, registration); err != nil {
			t.Fatalf("create registration: %v", err)
		}
	}

	_, states, found, err := repository.FindForUser(ctx, match.ID, userID)
	if err != nil || !found {
		t.Fatalf("find user match detail: found=%t err=%v", found, err)
	}
	// 详情会返回比赛全部报名组：主队组带花名册 participants，散人组无人报名。
	statesByKind := make(map[domain.GroupKind]ports.UserGroupState, len(states))
	for _, state := range states {
		statesByKind[state.Group.Kind] = state
	}
	hostState, ok := statesByKind[domain.GroupHostTeam]
	if !ok || len(hostState.Participants) != 2 {
		t.Fatalf("expected two attending participants on host group, got %+v", states)
	}
	if individualState, ok := statesByKind[domain.GroupIndividualOpponent]; !ok ||
		len(individualState.Participants) != 0 || individualState.MyRegistration != nil {
		t.Fatalf("expected untouched individual group, got %+v", individualState)
	}
	participantsByID := make(map[int64]ports.UserParticipant, len(hostState.Participants))
	for _, participant := range hostState.Participants {
		participantsByID[participant.UserID] = participant
	}
	for id, expectedAvatar := range map[int64]string{
		userID:       "https://cdn.example.com/captain.png",
		secondUserID: "https://cdn.example.com/dong.png",
	} {
		participant, ok := participantsByID[id]
		if !ok || participant.Status != domain.RegistrationAttending || participant.AvatarURL == nil || *participant.AvatarURL != expectedAvatar {
			t.Fatalf("unexpected participant %d: %+v", id, participant)
		}
		// registered_at 来自报名记录的 created_at，小程序端靠它按报名先后排序。
		if participant.RegisteredAt == nil || !participant.RegisteredAt.Equal(now) {
			t.Fatalf("participant %d missing registration time: %+v", id, participant)
		}
	}
}

func TestRepositoryFindForUserIncludesNonMemberAttendingParticipants(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	userID, teamID := seedMatchOwner(t, pool)
	// 非本队成员（如 legacy 迁移的个人报名者）只报名、不入队：详情 participants 仍必须包含他们。
	outsiderID := seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `UPDATE users SET nickname = $2, avatar_url = $3 WHERE id = $1`,
		outsiderID, "散客", "https://cdn.example.com/guest.png"); err != nil {
		t.Fatalf("seed outsider profile: %v", err)
	}

	match, groups := newPersistableMatch(t, userID, teamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registration, err := domain.NewRegistration(groups[0].ID, outsiderID, domain.RegistrationAttending, 1, now)
	if err != nil {
		t.Fatalf("new registration: %v", err)
	}
	if err := repository.CreateRegistration(ctx, registration); err != nil {
		t.Fatalf("create registration: %v", err)
	}

	_, states, found, err := repository.FindForUser(ctx, match.ID, userID)
	if err != nil || !found {
		t.Fatalf("find user match detail: found=%t err=%v", found, err)
	}
	if len(states) != 1 || states[0].Group.Kind != domain.GroupHostTeam {
		t.Fatalf("expected single host group, got %+v", states)
	}
	participants := states[0].Participants
	if len(participants) != 1 || participants[0].UserID != outsiderID ||
		participants[0].Nickname != "散客" || participants[0].Status != domain.RegistrationAttending ||
		participants[0].AvatarURL == nil || *participants[0].AvatarURL != "https://cdn.example.com/guest.png" {
		t.Fatalf("expected non-member attending participant, got %+v", participants)
	}
	if participants[0].RegisteredAt == nil || !participants[0].RegisteredAt.Equal(now) {
		t.Fatalf("participant missing registration time: %+v", participants[0])
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

func TestRepositoryListsUserMatchesWithPublicationAndDateFilters(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	viewerID := seedHomeUser(t, pool)

	// start_time 落库为 UTC 时刻；date_start 语义是"该时刻起的 24 小时窗口"，
	// 覆盖跨 UTC 日期的本地日期场景（如东八区 8/16 全天 = UTC 8/15 16:00 起 24h）。
	dayStart := time.Now().UTC().Truncate(24 * time.Hour).Add(16 * time.Hour)
	seedHallMatch(t, pool, ownerID, teamID, "昨天线下已约", domain.OfflineConfirmed, dayStart.Add(-2*time.Hour))
	seedHallMatch(t, pool, ownerID, teamID, "今天线上约队", domain.OnlineTeam, dayStart.Add(10*time.Hour))
	individualID, _ := seedHallMatch(t, pool, ownerID, teamID, "今天散人约局", domain.OnlineIndividual, dayStart.Add(15*time.Hour))
	seedHallMatch(t, pool, ownerID, teamID, "明天散人约局", domain.OnlineIndividual, dayStart.Add(26*time.Hour))

	individualGroupID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (id, match_id, kind, team_id, min_players, max_players, status)
		VALUES ($1, $2, 'individual_opponent', NULL, 4, 8, 'open')`,
		individualGroupID, individualID); err != nil {
		t.Fatalf("seed individual group: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, cancelled_at)
		VALUES ($1, $2, $3, 'attending', 1, NULL),
		       ($4, $2, $5, 'attending', 2, NULL),
		       ($6, $2, $7, 'cancelled', 5, NOW())`,
		uuid.New(), individualGroupID, seedHomeUser(t, pool),
		uuid.New(), seedHomeUser(t, pool),
		uuid.New(), viewerID); err != nil {
		t.Fatalf("seed individual registrations: %v", err)
	}

	repository := NewRepository(pool)
	items, err := repository.ListForUser(ctx, ports.MatchListFilter{
		Scope: ports.MatchScopeAll, UserID: viewerID,
		PublicationModes: []domain.PublicationMode{domain.OnlineTeam, domain.OnlineIndividual},
		DateStart:        &dayStart,
		Limit:            20,
	})
	if err != nil {
		t.Fatalf("list hall matches: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected two filtered matches, got %d: %+v", len(items), items)
	}
	if items[0].Match.ID != individualID || items[1].Match.Name != "今天线上约队" {
		t.Fatalf("expected start_time descending order: %+v", items)
	}
	individual := items[0]
	if len(individual.RegistrationGroups) != 2 {
		t.Fatalf("expected host and individual summaries, got %+v", individual.RegistrationGroups)
	}
	for _, group := range individual.RegistrationGroups {
		switch group.Kind {
		case domain.GroupIndividualOpponent:
			if group.AttendingCount != 3 || group.MinPlayers == nil || *group.MinPlayers != 4 || group.MaxPlayers == nil || *group.MaxPlayers != 8 {
				t.Fatalf("unexpected individual summary: %+v", group)
			}
		case domain.GroupHostTeam:
			if group.AttendingCount != 0 || group.TeamID == nil || *group.TeamID != teamID {
				t.Fatalf("unexpected host summary: %+v", group)
			}
		default:
			t.Fatalf("unexpected group kind: %+v", group)
		}
	}

	total, err := repository.CountForUser(ctx, ports.MatchListFilter{
		Scope: ports.MatchScopeAll, UserID: viewerID,
		PublicationModes: []domain.PublicationMode{domain.OnlineTeam, domain.OnlineIndividual},
		DateStart:        &dayStart,
	})
	if err != nil {
		t.Fatalf("count hall matches: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}

	unfiltered, err := repository.ListForUser(ctx, ports.MatchListFilter{Scope: ports.MatchScopeAll, UserID: viewerID, Limit: 20})
	if err != nil {
		t.Fatalf("list unfiltered matches: %v", err)
	}
	if len(unfiltered) != 4 {
		t.Fatalf("expected all four matches without filters, got %d", len(unfiltered))
	}
}

func seedHallMatch(
	t *testing.T,
	pool *pgxpool.Pool,
	createdByUserID, teamID int64,
	name string,
	publicationMode domain.PublicationMode,
	startTime time.Time,
) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	matchID := uuid.New()
	groupID := uuid.New()
	opponentState := "recruiting"
	opponentName := any(nil)
	if publicationMode == domain.OfflineConfirmed {
		opponentState = "no_recruitment"
		opponentName = "测试对手"
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO matches (
			id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
			players_per_team, start_time, end_time, location, created_by_user_id
		) VALUES ($1, $2, $3, $4, 'registering', $5, $6, 8, $7, $8, '测试球场', $9)`,
		matchID, name, string(publicationMode), opponentState, teamID, opponentName, startTime, startTime.Add(2*time.Hour), createdByUserID); err != nil {
		t.Fatalf("seed hall match: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (id, match_id, kind, team_id, max_players, status)
		VALUES ($1, $2, 'host_team', $3, 10, 'open')`, groupID, matchID, teamID); err != nil {
		t.Fatalf("seed hall host group: %v", err)
	}
	return matchID, groupID
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

	now := time.Now().UTC()
	staleRegisteringID, _ := seedHomeMatch(t, pool, actorID, actorTeamID, "已过期报名中", domain.MatchRegistering, now.Add(-3*time.Hour))
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

	endedIDs := []uuid.UUID{registrationOnlyEndedID, staleRegisteringID}
	for day := 1; day <= 6; day++ {
		matchID, _ := seedHomeMatch(t, pool, actorID, actorTeamID, "已结束比赛", domain.MatchEnded, now.AddDate(0, 0, -day))
		endedIDs = append(endedIDs, matchID)
	}

	repository := NewRepository(pool)
	actions, err := repository.ListHomeActionItems(ctx, actorID, 4)
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

	ended, err := repository.ListHomeEndedItems(ctx, actorID, 8)
	if err != nil {
		t.Fatalf("list home ended matches: %v", err)
	}
	if len(ended) != 8 {
		t.Fatalf("expected eight ended matches, got %d: %+v", len(ended), ended)
	}
	for index := range endedIDs {
		if ended[index].Match.ID != endedIDs[index] {
			t.Fatalf("ended order mismatch at %d: got %s want %s", index, ended[index].Match.ID, endedIDs[index])
		}
	}
}

func TestRepositoryListsHomeActionParticipantsIncludesAllAttending(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	actorID, teamID := seedMatchOwner(t, pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'member', 'active')`, teamID, actorID); err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	now := time.Now().UTC()
	_, groupID := seedHomeMatch(t, pool, actorID, teamID, "头像列表", domain.MatchRegistering, now.Add(2*time.Hour))

	// 7 个 attending + 1 个更早报名的 leave：首页返回该组全部 attending 报名者（不做数量截断），按报名先后排序。
	attendingIDs := make([]int64, 0, 7)
	for index := 0; index < 7; index++ {
		userID := seedHomeUser(t, pool)
		attendingIDs = append(attendingIDs, userID)
		nickname := fmt.Sprintf("报名%d", index)
		avatarURL := fmt.Sprintf("https://cdn.example.com/p%d.png", index)
		if _, err := pool.Exec(ctx, `UPDATE users SET nickname = $2, avatar_url = $3 WHERE id = $1`, userID, nickname, avatarURL); err != nil {
			t.Fatalf("seed participant profile: %v", err)
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, created_at)
			VALUES ($1, $2, $3, 'attending', 1, $4)`,
			uuid.New(), groupID, userID, now.Add(time.Duration(index)*time.Minute)); err != nil {
			t.Fatalf("seed attending registration: %v", err)
		}
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, created_at)
		VALUES ($1, $2, $3, 'leave', 1, $4)`,
		uuid.New(), groupID, seedHomeUser(t, pool), now.Add(-time.Hour)); err != nil {
		t.Fatalf("seed leave registration: %v", err)
	}

	repository := NewRepository(pool)
	items, err := repository.ListHomeActionItems(ctx, actorID, 4)
	if err != nil {
		t.Fatalf("list home action matches: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one home action match, got %+v", items)
	}
	participants := items[0].Group.Participants
	if len(participants) != 7 {
		t.Fatalf("expected all seven attending participants, got %+v", participants)
	}
	for index, participant := range participants {
		if participant.UserID != attendingIDs[index] ||
			participant.Nickname != fmt.Sprintf("报名%d", index) ||
			participant.AvatarURL == nil ||
			*participant.AvatarURL != fmt.Sprintf("https://cdn.example.com/p%d.png", index) ||
			participant.Status != domain.RegistrationAttending {
			t.Fatalf("unexpected participant at %d: %+v", index, participant)
		}
	}
}

func TestRepositoryListsHomeEndedParticipantsIncludesAllAttending(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	actorID, teamID := seedMatchOwner(t, pool)
	_, guestTeamID := seedMatchOwner(t, pool)
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role, status)
		VALUES ($1, $2, 'member', 'active')`, teamID, actorID); err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	now := time.Now().UTC()
	matchID, hostGroupID := seedHomeMatch(t, pool, actorID, teamID, "已结束头像", domain.MatchEnded, now.Add(-3*time.Hour))
	guestGroupID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (id, match_id, kind, team_id, max_players, status)
		VALUES ($1, $2, 'guest_team', $3, 8, 'open')`, guestGroupID, matchID, guestTeamID); err != nil {
		t.Fatalf("seed guest group: %v", err)
	}

	// 主队/客队两个报名组交替分布 7 个 attending + 1 个最早报名的 leave：
	// 已结束比赛合并全部报名组后返回全部 attending 报名者（不做数量截断），按报名先后排序。
	attendingIDs := make([]int64, 0, 7)
	for index := 0; index < 7; index++ {
		userID := seedHomeUser(t, pool)
		attendingIDs = append(attendingIDs, userID)
		nickname := fmt.Sprintf("结束%d", index)
		avatarURL := fmt.Sprintf("https://cdn.example.com/e%d.png", index)
		if _, err := pool.Exec(ctx, `UPDATE users SET nickname = $2, avatar_url = $3 WHERE id = $1`, userID, nickname, avatarURL); err != nil {
			t.Fatalf("seed participant profile: %v", err)
		}
		groupID := hostGroupID
		if index%2 == 1 {
			groupID = guestGroupID
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, created_at)
			VALUES ($1, $2, $3, 'attending', 1, $4)`,
			uuid.New(), groupID, userID, now.Add(time.Duration(index)*time.Minute)); err != nil {
			t.Fatalf("seed attending registration: %v", err)
		}
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, created_at)
		VALUES ($1, $2, $3, 'leave', 1, $4)`,
		uuid.New(), hostGroupID, seedHomeUser(t, pool), now.Add(-time.Hour)); err != nil {
		t.Fatalf("seed leave registration: %v", err)
	}

	repository := NewRepository(pool)
	items, err := repository.ListHomeEndedItems(ctx, actorID, 8)
	if err != nil {
		t.Fatalf("list home ended matches: %v", err)
	}
	if len(items) != 1 || items[0].Match.ID != matchID {
		t.Fatalf("expected the seeded ended match, got %+v", items)
	}
	participants := items[0].Participants
	if len(participants) != 7 {
		t.Fatalf("expected all seven attending participants, got %+v", participants)
	}
	for index, participant := range participants {
		if participant.UserID != attendingIDs[index] ||
			participant.Nickname != fmt.Sprintf("结束%d", index) ||
			participant.AvatarURL == nil ||
			*participant.AvatarURL != fmt.Sprintf("https://cdn.example.com/e%d.png", index) ||
			participant.Status != domain.RegistrationAttending {
			t.Fatalf("unexpected participant at %d: %+v", index, participant)
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

func (a repositoryTestTeamAccess) EnsureCaptain(ctx context.Context, teamID, userID int64) error {
	return a.EnsureManager(ctx, teamID, userID)
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

func TestRepositoryFinishUpdateStatusOnlyWritesNonTerminalMatches(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, hostTeamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, ownerID, hostTeamID)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	// 非终态（registering）首次收尾：条件更新命中。
	match.Status = domain.MatchEnded
	updated, err := repository.FinishUpdateStatus(ctx, match)
	if err != nil || !updated {
		t.Fatalf("expected conditional update to land, updated=%v err=%v", updated, err)
	}
	loaded, _, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found || loaded.Status != domain.MatchEnded {
		t.Fatalf("expected ended status persisted, got %s (found=%v err=%v)", loaded.Status, found, err)
	}

	// 库内已是终态后并发收尾：条件更新 0 行，不覆盖先到的终态。
	match.Status = domain.MatchCancelled
	updated, err = repository.FinishUpdateStatus(ctx, match)
	if err != nil || updated {
		t.Fatalf("expected conditional update to miss on terminal status, updated=%v err=%v", updated, err)
	}
	loaded, _, found, err = repository.FindByID(ctx, match.ID)
	if err != nil || !found || loaded.Status != domain.MatchEnded {
		t.Fatalf("expected ended status preserved after conflicting finish, got %s", loaded.Status)
	}
}
