package postgres

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	teampassword "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/password"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	teamapplication "github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

type recordingNotifier struct {
	messages []notificationapplication.SystemNotification
}

func (r *recordingNotifier) Notify(_ context.Context, message notificationapplication.SystemNotification) error {
	r.messages = append(r.messages, message)
	return nil
}

func (r *recordingNotifier) find(userID int64, kind string) *notificationapplication.SystemNotification {
	for index := range r.messages {
		if r.messages[index].UserID == userID && r.messages[index].Kind == kind {
			return &r.messages[index]
		}
	}
	return nil
}

// newCaptainMessageService 组装集成测试环境：真仓储 + 真 team 授权 + 内存通知收集器。
func newCaptainMessageService(t *testing.T, pool *pgxpool.Pool) (*matchapplication.CaptainMessageService, *recordingNotifier) {
	t.Helper()
	repository := NewRepository(pool)
	teamService := teamapplication.NewQueryService(teampostgres.NewRepository(pool), teampassword.Bcrypt{})
	notifier := &recordingNotifier{}
	return matchapplication.NewCaptainMessageService(repository, repository, teamService, notifier), notifier
}

func seedCaptainWithTeam(t *testing.T, pool *pgxpool.Pool, teamName string) (captainID, teamID int64) {
	t.Helper()
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname) VALUES ($1, $2) RETURNING id`,
		"captain-"+uuid.NewString(), teamName+"队长").Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ($1, $2) RETURNING id`,
		teamName, captainID).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'captain', 'active')`,
		teamID, captainID); err != nil {
		t.Fatalf("seed captain membership: %v", err)
	}
	return captainID, teamID
}

func userActor(userID int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: userID}
}

func TestCaptainMessageSendCreatesThreadAndNotifiesManagers(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	service, notifier := newCaptainMessageService(t, pool)
	captainID, teamID := seedCaptainWithTeam(t, pool, "东安联队")
	leaderID := seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'leader', 'active')`,
		teamID, leaderID); err != nil {
		t.Fatalf("seed leader: %v", err)
	}
	match, groups := newPersistableMatch(t, captainID, teamID)
	if err := NewRepository(pool).CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}

	player := seedMatchUser(t, pool)
	threadID, err := service.Send(ctx, userActor(player), match.ID, "你好，想约一场友谊赛")
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if threadID == uuid.Nil {
		t.Fatal("thread id must not be nil")
	}
	for _, managerID := range []int64{captainID, leaderID} {
		notification := notifier.find(managerID, "match_captain_message")
		if notification == nil {
			t.Fatalf("manager %d must be notified", managerID)
		}
		if notification.RelatedID != threadID.String() || notification.RelatedType != "captain_message" {
			t.Fatalf("notification must link thread: %+v", notification)
		}
	}

	again, err := service.Send(ctx, userActor(player), match.ID, "补充：我们大概 10 个人")
	if err != nil || again != threadID {
		t.Fatalf("second send must reuse thread: again=%v first=%v err=%v", again, threadID, err)
	}
	detail, err := service.GetThread(ctx, userActor(player), threadID)
	if err != nil {
		t.Fatalf("get thread: %v", err)
	}
	if len(detail.Messages) != 2 || detail.ViewerIsManager {
		t.Fatalf("thread must hold 2 messages for owner view: %+v", detail)
	}
	if detail.Messages[0].Content != "你好，想约一场友谊赛" || detail.Messages[1].SenderIsCaptainSide {
		t.Fatalf("unexpected messages: %+v", detail.Messages)
	}
}

func TestCaptainMessageReplyVisibilityAndPermission(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	service, notifier := newCaptainMessageService(t, pool)
	captainID, teamID := seedCaptainWithTeam(t, pool, "北岸竞技")
	match, groups := newPersistableMatch(t, captainID, teamID)
	if err := NewRepository(pool).CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	player := seedMatchUser(t, pool)
	stranger := seedMatchUser(t, pool)
	threadID, err := service.Send(ctx, userActor(player), match.ID, "可以约一场吗？")
	if err != nil {
		t.Fatalf("send: %v", err)
	}

	if _, err := service.Reply(ctx, userActor(stranger), threadID, "路人插话"); err == nil {
		t.Fatal("stranger reply must be rejected")
	}
	if _, err := service.Reply(ctx, userActor(captainID), threadID, "欢迎，周六下午可以"); err != nil {
		t.Fatalf("captain reply: %v", err)
	}
	if notification := notifier.find(player, "match_captain_message"); notification == nil {
		t.Fatal("owner must be notified about captain reply")
	}
	if _, err := service.Reply(ctx, userActor(player), threadID, "好的，我们报名"); err != nil {
		t.Fatalf("owner reply: %v", err)
	}

	if _, err := service.GetThread(ctx, userActor(stranger), threadID); err == nil {
		t.Fatal("stranger must not read the thread")
	}
	captainView, err := service.GetThread(ctx, userActor(captainID), threadID)
	if err != nil || !captainView.ViewerIsManager || len(captainView.Messages) != 3 {
		t.Fatalf("captain view: %+v err=%v", captainView, err)
	}
	if captainView.Messages[1].SenderIsCaptainSide != true || captainView.Messages[2].SenderIsCaptainSide != false {
		t.Fatalf("captain side flags wrong: %+v", captainView.Messages)
	}

	ownerList, err := service.ListThreads(ctx, userActor(player), matchapplication.CaptainMessageListQuery{})
	if err != nil || ownerList.Total != 1 {
		t.Fatalf("owner list: %+v err=%v", ownerList, err)
	}
	captainList, err := service.ListThreads(ctx, userActor(captainID), matchapplication.CaptainMessageListQuery{})
	if err != nil || captainList.Total != 1 || captainList.Items[0].ThreadOwnerUserID != player {
		t.Fatalf("captain list: %+v err=%v", captainList, err)
	}
	strangerList, err := service.ListThreads(ctx, userActor(stranger), matchapplication.CaptainMessageListQuery{})
	if err != nil || strangerList.Total != 0 || len(strangerList.Items) != 0 {
		t.Fatalf("stranger must see nothing: %+v err=%v", strangerList, err)
	}
	if captainList.Items[0].LatestSenderIsCaptainSide || captainList.Items[0].LatestContent != "好的，我们报名" {
		t.Fatalf("latest message summary wrong: %+v", captainList.Items[0])
	}
}

func TestCaptainMessageSendValidations(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	service, _ := newCaptainMessageService(t, pool)
	captainID, teamID := seedCaptainWithTeam(t, pool, "南山fc")
	match, groups := newPersistableMatch(t, captainID, teamID)
	if err := NewRepository(pool).CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	player := seedMatchUser(t, pool)

	cases := []struct {
		name    string
		matchID uuid.UUID
		content string
	}{
		{"match not found", uuid.New(), "你好"},
		{"blank content", match.ID, "   "},
		{"too long content", match.ID, strings.Repeat("字", 201)},
	}
	for _, testCase := range cases {
		if _, err := service.Send(ctx, userActor(player), testCase.matchID, testCase.content); err == nil {
			t.Fatalf("%s must fail", testCase.name)
		}
	}

	if _, err := service.Send(ctx, userActor(captainID), match.ID, "给自己留言"); err == nil {
		t.Fatal("host manager must not message own team match")
	}

	pickupOwner := seedMatchUser(t, pool)
	pickup, pickupGroups := newPersistablePickupMatch(t, pickupOwner, 4, 12, domain.PaymentPostpaid, 0)
	if err := NewRepository(pool).CreateWithGroups(ctx, pickup, pickupGroups); err != nil {
		t.Fatalf("create pickup match: %v", err)
	}
	if _, err := service.Send(ctx, userActor(player), pickup.ID, "无主队比赛"); err == nil {
		t.Fatal("match without host team must be rejected")
	}

	if _, err := service.Reply(ctx, userActor(player), uuid.New(), "不存在的串"); err == nil {
		t.Fatal("reply to missing thread must fail")
	}
}

func TestUserMatchListFilterEndsAfterAndHostTeamOnly(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	captainID, teamID := seedCaptainWithTeam(t, pool, "滨河联")
	repository := NewRepository(pool)
	viewer := seedMatchUser(t, pool)

	past, pastGroups := newPersistableMatch(t, captainID, teamID)
	past.StartTime = time.Date(2026, 8, 20, 18, 0, 0, 0, time.UTC)
	past.EndTime = past.StartTime.Add(2 * time.Hour)
	if err := repository.CreateWithGroups(ctx, past, pastGroups); err != nil {
		t.Fatalf("create past match: %v", err)
	}
	future, futureGroups := newPersistableMatch(t, captainID, teamID)
	future.StartTime = time.Date(2026, 9, 20, 18, 0, 0, 0, time.UTC)
	future.EndTime = future.StartTime.Add(2 * time.Hour)
	if err := repository.CreateWithGroups(ctx, future, futureGroups); err != nil {
		t.Fatalf("create future match: %v", err)
	}
	pickupOwner := seedMatchUser(t, pool)
	pickup, pickupGroups := newPersistablePickupMatch(t, pickupOwner, 4, 12, domain.PaymentPostpaid, 0)
	pickup.StartTime = time.Date(2026, 9, 21, 18, 0, 0, 0, time.UTC)
	pickup.EndTime = pickup.StartTime.Add(2 * time.Hour)
	if err := repository.CreateWithGroups(ctx, pickup, pickupGroups); err != nil {
		t.Fatalf("create pickup match: %v", err)
	}

	now := time.Date(2026, 8, 25, 12, 0, 0, 0, time.UTC)
	hostOnly := true
	endsAfterFilter := ports.MatchListFilter{Scope: ports.MatchScopeAll, UserID: viewer, EndsAfter: &now, Limit: 50}
	endsAfterItems, err := repository.ListForUser(ctx, endsAfterFilter)
	if err != nil {
		t.Fatalf("list ends_after: %v", err)
	}
	if len(endsAfterItems) != 2 {
		t.Fatalf("ends_after must keep 2 unfinished matches, got %d", len(endsAfterItems))
	}
	hostTeamFilter := endsAfterFilter
	hostTeamFilter.HostTeamOnly = &hostOnly
	hostTeamItems, err := repository.ListForUser(ctx, hostTeamFilter)
	if err != nil {
		t.Fatalf("list host_team_only: %v", err)
	}
	if len(hostTeamItems) != 1 || hostTeamItems[0].Match.ID != future.ID {
		t.Fatalf("host_team_only must keep only the future host match: %+v", hostTeamItems)
	}
	count, err := repository.CountForUser(ctx, hostTeamFilter)
	if err != nil || count != 1 {
		t.Fatalf("count host_team_only: count=%d err=%v", count, err)
	}

	// 不带新参数时行为与旧版一致：三场都可见。
	legacyItems, err := repository.ListForUser(ctx, ports.MatchListFilter{Scope: ports.MatchScopeAll, UserID: viewer, Limit: 50})
	if err != nil || len(legacyItems) != 3 {
		t.Fatalf("legacy list must keep all 3 matches, got %d err=%v", len(legacyItems), err)
	}
}

func TestRepositoryFindForUserIncludesHostCaptain(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	captainID, teamID := seedCaptainWithTeam(t, pool, "队长资料队")
	match, groups := newPersistableMatch(t, captainID, teamID)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	viewer := seedMatchUser(t, pool)
	item, _, found, err := repository.FindForUser(ctx, match.ID, viewer)
	if err != nil || !found {
		t.Fatalf("find for user: found=%t err=%v", found, err)
	}
	if item.HostCaptain == nil || item.HostCaptain.UserID != captainID || item.HostCaptain.Nickname == "" {
		t.Fatalf("host captain must be attached: %+v", item.HostCaptain)
	}

	pickupOwner := seedMatchUser(t, pool)
	pickup, pickupGroups := newPersistablePickupMatch(t, pickupOwner, 4, 12, domain.PaymentPostpaid, 0)
	if err := repository.CreateWithGroups(ctx, pickup, pickupGroups); err != nil {
		t.Fatalf("create pickup match: %v", err)
	}
	pickupItem, _, found, err := repository.FindForUser(ctx, pickup.ID, viewer)
	if err != nil || !found || pickupItem.HostCaptain != nil {
		t.Fatalf("pickup match must have nil captain: %+v found=%t err=%v", pickupItem.HostCaptain, found, err)
	}
}

func TestCaptainMessageUnreadFlow(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	service, _ := newCaptainMessageService(t, pool)
	captainID, teamID := seedCaptainWithTeam(t, pool, "未读测试联")
	match, groups := newPersistableMatch(t, captainID, teamID)
	if err := NewRepository(pool).CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
	player := seedMatchUser(t, pool)
	emptyUser := seedMatchUser(t, pool)

	threadID, err := service.Send(ctx, userActor(player), match.ID, "第一条约球")
	if err != nil {
		t.Fatalf("send: %v", err)
	}

	// 队长侧收到 1 条未读；发起人与无关用户都是 0（自己发的消息不算未读）。
	if count, err := service.UnreadCount(ctx, userActor(captainID)); err != nil || count != 1 {
		t.Fatalf("captain unread: count=%d err=%v", count, err)
	}
	if count, err := service.UnreadCount(ctx, userActor(player)); err != nil || count != 0 {
		t.Fatalf("owner unread must be 0: count=%d err=%v", count, err)
	}
	if count, err := service.UnreadCount(ctx, userActor(emptyUser)); err != nil || count != 0 {
		t.Fatalf("stranger unread must be 0: count=%d err=%v", count, err)
	}

	threads, err := service.ListThreads(ctx, userActor(captainID), matchapplication.CaptainMessageListQuery{})
	if err != nil || threads.Total != 1 || threads.Items[0].UnreadCount != 1 {
		t.Fatalf("captain thread list unread: %+v err=%v", threads, err)
	}

	// 队长打开对话即读到最新，未读清零。
	if _, err := service.GetThread(ctx, userActor(captainID), threadID); err != nil {
		t.Fatalf("captain open thread: %v", err)
	}
	if count, err := service.UnreadCount(ctx, userActor(captainID)); err != nil || count != 0 {
		t.Fatalf("captain unread after read: count=%d err=%v", count, err)
	}

	// 队长回复后发起人产生 1 条未读；再次打开清零。
	if _, err := service.Reply(ctx, userActor(captainID), threadID, "周六可以"); err != nil {
		t.Fatalf("captain reply: %v", err)
	}
	if count, err := service.UnreadCount(ctx, userActor(player)); err != nil || count != 1 {
		t.Fatalf("owner unread after reply: count=%d err=%v", count, err)
	}
	if _, err := service.GetThread(ctx, userActor(player), threadID); err != nil {
		t.Fatalf("owner open thread: %v", err)
	}
	if count, err := service.UnreadCount(ctx, userActor(player)); err != nil || count != 0 {
		t.Fatalf("owner unread after read: count=%d err=%v", count, err)
	}
}
