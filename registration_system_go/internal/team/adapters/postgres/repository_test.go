package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryMapsActiveLeaderMembership(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('openid-1') RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('东安联队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'leader')`, teamID, userID); err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	membership, ok, err := NewRepository(pool).FindActiveMember(ctx, teamID, userID)
	if err != nil {
		t.Fatalf("find membership: %v", err)
	}
	if !ok || membership.Role != domain.RoleLeader || membership.Status != domain.MemberActive {
		t.Fatalf("unexpected membership: %+v, ok=%v", membership, ok)
	}
}

func TestRepositorySearchesMemberCandidatesByProfile(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var teamID, userID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('候选搜索球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname, real_name, phone_number) VALUES ('candidate-openid', '小明', '王小明', '13800138000') RETURNING id`).Scan(&userID); err != nil {
		t.Fatalf("seed candidate: %v", err)
	}
	repository := NewRepository(pool)
	for _, search := range []string{"王小明", "13800138000"} {
		candidates, err := repository.ListMemberCandidates(ctx, teamID, search, 50)
		if err != nil || len(candidates) != 1 || candidates[0].UserID != userID {
			t.Fatalf("search %q: candidates=%+v err=%v", search, candidates, err)
		}
		if candidates[0].RealName == nil || *candidates[0].RealName != "王小明" || candidates[0].PhoneNumber == nil {
			t.Fatalf("missing profile fields: %+v", candidates[0])
		}
	}
}

func TestRepositoryManagesMembersAndCaptain(t *testing.T) {
	// testsupport 提供独立 schema（自动迁移、测试后清理）；不要直连共享库靠事务回滚。
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()

	var teamID, firstUserID, secondUserID, candidateUserID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('成员仓储测试球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	for nickname, target := range map[string]*int64{
		"王一": &firstUserID, "李二": &secondUserID, "张三": &candidateUserID,
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname) VALUES ($1, $2) RETURNING id`, "member-test-"+nickname, nickname).Scan(target); err != nil {
			t.Fatalf("seed user %s: %v", nickname, err)
		}
	}

	repository := NewRepository(pool)
	if err := repository.AddMember(ctx, teamID, firstUserID, domain.RoleLeader); err != nil {
		t.Fatalf("add first member: %v", err)
	}
	if err := repository.AddMember(ctx, teamID, secondUserID, domain.RoleMember); err != nil {
		t.Fatalf("add second member: %v", err)
	}

	members, err := repository.ListMembers(ctx, teamID)
	if err != nil || len(members) != 2 {
		t.Fatalf("list members: members=%+v err=%v", members, err)
	}
	candidates, err := repository.ListMemberCandidates(ctx, teamID, "张", 50)
	if err != nil || len(candidates) != 1 || candidates[0].UserID != candidateUserID {
		t.Fatalf("list candidates: candidates=%+v err=%v", candidates, err)
	}

	if err := repository.SetCaptain(ctx, teamID, &firstUserID); err != nil {
		t.Fatalf("set captain: %v", err)
	}
	team, found, err := repository.FindByID(ctx, teamID)
	if err != nil || !found || team.CaptainID == nil || *team.CaptainID != firstUserID {
		t.Fatalf("captain was not set: team=%+v found=%t err=%v", team, found, err)
	}

	updated, err := repository.UpdateMember(ctx, teamID, secondUserID, domain.RoleMember, domain.MemberInactive)
	if err != nil || !updated {
		t.Fatalf("freeze second member: updated=%t err=%v", updated, err)
	}
	if err := repository.SetCaptain(ctx, teamID, &secondUserID); !errors.Is(err, ports.ErrMemberNotFound) {
		t.Fatalf("expected inactive captain rejection, got %v", err)
	}
	team, _, err = repository.FindByID(ctx, teamID)
	if err != nil || team.CaptainID == nil || *team.CaptainID != firstUserID {
		t.Fatalf("failed captain change modified current captain: team=%+v err=%v", team, err)
	}
	members, err = repository.ListMembers(ctx, teamID)
	if err != nil || memberRole(members, firstUserID) != domain.RoleCaptain {
		t.Fatalf("failed captain change demoted current captain: members=%+v err=%v", members, err)
	}

	if err := repository.SetCaptain(ctx, teamID, nil); err != nil {
		t.Fatalf("clear captain: %v", err)
	}
	team, _, err = repository.FindByID(ctx, teamID)
	if err != nil || team.CaptainID != nil {
		t.Fatalf("captain was not cleared: team=%+v err=%v", team, err)
	}
	removed, err := repository.RemoveMember(ctx, teamID, secondUserID)
	if err != nil || !removed {
		t.Fatalf("remove member: removed=%t err=%v", removed, err)
	}
	if err := repository.AddMember(ctx, teamID, firstUserID, domain.RoleMember); !errors.Is(err, ports.ErrMemberAlreadyExists) {
		t.Fatalf("expected duplicate member error, got %v", err)
	}
}

func memberRole(members []domain.MemberDetails, userID int64) domain.Role {
	for _, member := range members {
		if member.UserID == userID {
			return member.Role
		}
	}
	return ""
}

func TestRepositoryAttendanceQueriesCountFinishedMatchesOnly(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)

	var captainID, memberID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('att-captain') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('att-member') RETURNING id`).Scan(&memberID); err != nil {
		t.Fatalf("seed member: %v", err)
	}
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('出勤统计球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain'), ($1, $3, 'member')`, teamID, captainID, memberID); err != nil {
		t.Fatalf("seed members: %v", err)
	}
	var departedID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('att-departed') RETURNING id`).Scan(&departedID); err != nil {
		t.Fatalf("seed departed: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'inactive')`, teamID, departedID); err != nil {
		t.Fatalf("seed departed member: %v", err)
	}

	seedMatch := func(name, status string, startOffsetDays int) (string, error) {
		var matchID string
		err := pool.QueryRow(ctx, `
			INSERT INTO matches (id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
				players_per_team, start_time, end_time, location, created_by_user_id)
			VALUES (gen_random_uuid(), $1, 'offline_confirmed', 'no_recruitment', $2, $3, '对手', 8,
				NOW() - make_interval(days => $4::int), NOW() - make_interval(days => $4::int) + interval '2 hours',
				'出勤球场', $5)
			RETURNING id`, name, status, teamID, startOffsetDays, captainID).Scan(&matchID)
		if err != nil {
			return "", err
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO match_registration_groups (id, match_id, kind, team_id)
			VALUES (gen_random_uuid(), $1, 'host_team', $2)`, matchID, teamID)
		return matchID, err
	}

	endedID, err := seedMatch("已结束赛", "ended", 7)
	if err != nil {
		t.Fatalf("seed ended match: %v", err)
	}
	if _, err := seedMatch("过期未收尾赛", "ongoing", 3); err != nil {
		t.Fatalf("seed expired match: %v", err)
	}
	if _, err := seedMatch("未开赛", "ongoing", -3); err != nil {
		t.Fatalf("seed upcoming match: %v", err)
	}
	if _, err := seedMatch("已取消赛", "cancelled", 5); err != nil {
		t.Fatalf("seed cancelled match: %v", err)
	}

	var endedGroupID string
	if err := pool.QueryRow(ctx, `
		SELECT g.id FROM match_registration_groups g JOIN matches m ON m.id = g.match_id
		WHERE m.id::text = $1 AND g.kind = 'host_team'`, endedID).Scan(&endedGroupID); err != nil {
		t.Fatalf("load ended group: %v", err)
	}
	// 队长出席已结束赛；队员撤销后又没再报（另一场 cancelled 报名不应计入）。
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registrations (id, group_id, user_id, status, registration_count)
		VALUES (gen_random_uuid(), $1, $2, 'attending', 1)`, endedGroupID, captainID); err != nil {
		t.Fatalf("seed captain registration: %v", err)
	}

	// 明细：只包含已结束/已过期的 2 场；队长在已结束赛有出席记录。
	captainRecords, err := repository.ListMemberAttendanceRecords(ctx, teamID, captainID, nil, nil)
	if err != nil {
		t.Fatalf("captain records: %v", err)
	}
	if len(captainRecords) != 2 {
		t.Fatalf("expected 2 finished matches, got %d: %+v", len(captainRecords), captainRecords)
	}
	attended := 0
	for _, record := range captainRecords {
		if record.ActivityID == endedID {
			attended++
			if record.Stand != "attending" || !record.Registered || record.RegistrationCount != 1 {
				t.Fatalf("unexpected ended record: %+v", record)
			}
		} else if record.Stand != "unknown" || record.Registered {
			t.Fatalf("expected unregistered row for expired match, got %+v", record)
		}
	}
	if attended != 1 {
		t.Fatalf("ended match record missing: %+v", captainRecords)
	}

	// 排名：2 名队员 × 2 场有效比赛；队长 1 出席 1 未报名，队员 2 场全未报名。
	ranking, err := repository.ListAttendanceRanking(ctx, teamID, nil, nil)
	if err != nil {
		t.Fatalf("ranking: %v", err)
	}
	byUser := map[int64]ports.AttendanceRankingItem{}
	for _, item := range ranking {
		byUser[item.UserID] = item
	}
	if len(byUser) != 2 {
		t.Fatalf("expected 2 ranked members, got %+v", ranking)
	}
	if item := byUser[captainID]; item.TotalCount != 2 || item.AttendedCount != 1 || item.UnregisteredCount != 1 {
		t.Fatalf("unexpected captain ranking: %+v", item)
	}
	if item := byUser[memberID]; item.TotalCount != 2 || item.AttendedCount != 0 || item.UnregisteredCount != 2 {
		t.Fatalf("unexpected member ranking: %+v", item)
	}

	// 日期过滤：窗口落在 [8 天前, 4 天前] 只覆盖 7 天前的已结束赛，
	// 排除 3 天前的过期未收尾赛与未来的未开赛。
	start := time.Now().AddDate(0, 0, -8)
	end := time.Now().AddDate(0, 0, -4)
	filtered, err := repository.ListMemberAttendanceRecords(ctx, teamID, captainID, &start, &end)
	if err != nil {
		t.Fatalf("filtered records: %v", err)
	}
	if len(filtered) != 1 || filtered[0].ActivityID != endedID {
		t.Fatalf("expected only the ended match in range, got %+v", filtered)
	}
}

func TestRepositoryMatchAttendanceIncludesActiveMembersOnly(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)

	var captainID, departedID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('mt-captain') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('mt-departed') RETURNING id`).Scan(&departedID); err != nil {
		t.Fatalf("seed departed: %v", err)
	}
	var teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('单场出勤球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain')
		`, teamID, captainID); err != nil {
		t.Fatalf("seed captain membership: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'inactive')`, teamID, departedID); err != nil {
		t.Fatalf("seed departed membership: %v", err)
	}

	var matchID uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO matches (id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
			players_per_team, start_time, end_time, location, created_by_user_id)
		VALUES (gen_random_uuid(), '单场出勤赛', 'offline_confirmed', 'no_recruitment', 'ended', $1, '对手', 8,
			NOW() - interval '7 days', NOW() - interval '7 days' + interval '2 hours', '出勤球场', $2)
		RETURNING id`, teamID, captainID).Scan(&matchID); err != nil {
		t.Fatalf("seed match: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_registration_groups (id, match_id, kind, team_id)
		VALUES (gen_random_uuid(), $1, 'host_team', $2)`, matchID, teamID); err != nil {
		t.Fatalf("seed group: %v", err)
	}

	header, members, found, err := repository.ListMatchAttendance(ctx, teamID, matchID)
	if err != nil || !found {
		t.Fatalf("match attendance: found=%v err=%v", found, err)
	}
	if header.ActivityName != "单场出勤赛" {
		t.Fatalf("unexpected header: %+v", header)
	}
	if len(members) != 1 || members[0].UserID != captainID {
		t.Fatalf("expected only the active captain, got %+v", members)
	}

	// 不属于该队 / 不在统计范围的比赛返回 found=false。
	_, _, found, err = repository.ListMatchAttendance(ctx, teamID+999, matchID)
	if err != nil || found {
		t.Fatalf("expected not found for other team, found=%v err=%v", found, err)
	}
}

func TestRepositorySelfServiceTeamFlow(t *testing.T) {
	// testsupport 提供独立 schema；本用例覆盖用户自服务球队的数据库流程：
	// 建队成队长、重名冲突、口令哈希、加入/重复加入/inactive 重新加入、搜索附信用分。
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)

	var creatorID, joinerID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('self-flow-creator') RETURNING id`).Scan(&creatorID); err != nil {
		t.Fatalf("seed creator: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('self-flow-joiner') RETURNING id`).Scan(&joinerID); err != nil {
		t.Fatalf("seed joiner: %v", err)
	}

	exists, err := repository.TeamNameExists(ctx, "自服务联队")
	if err != nil || exists {
		t.Fatalf("team name should not exist: exists=%v err=%v", exists, err)
	}

	team, err := repository.CreateWithCaptain(ctx, "自服务联队", nil, nil, creatorID)
	if err != nil {
		t.Fatalf("create with captain: %v", err)
	}
	if team.CaptainID == nil || *team.CaptainID != creatorID {
		t.Fatalf("captain not set: %+v", team)
	}
	captain, found, err := repository.FindActiveMember(ctx, team.ID, creatorID)
	if err != nil || !found || captain.Role != domain.RoleCaptain {
		t.Fatalf("creator should be captain: %+v found=%v err=%v", captain, found, err)
	}

	if exists, _ := repository.TeamNameExists(ctx, "自服务联队"); !exists {
		t.Fatal("duplicate name should be detected")
	}

	hash := "$2a$10$invalidhashinvalidhashinvalidhash"
	if _, err := repository.CreateWithCaptain(ctx, "带口令球队", nil, &hash, creatorID); err != nil {
		t.Fatalf("create with password hash: %v", err)
	}
	stored, found, err := repository.FindJoinPasswordHash(ctx, team.ID)
	if err != nil || !found || stored != nil {
		t.Fatalf("no-password team should have nil hash: %v found=%v err=%v", stored, found, err)
	}

	if err := repository.AddMember(ctx, team.ID, joinerID, domain.RoleMember); err != nil {
		t.Fatalf("add member: %v", err)
	}
	if err := repository.AddMember(ctx, team.ID, joinerID, domain.RoleMember); !errors.Is(err, ports.ErrMemberAlreadyExists) {
		t.Fatalf("duplicate member should conflict, got: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE team_members SET status='inactive' WHERE team_id=$1 AND user_id=$2`, team.ID, joinerID); err != nil {
		t.Fatalf("deactivate joiner: %v", err)
	}
	reactivated, err := repository.ReactivateMember(ctx, team.ID, joinerID)
	if err != nil || !reactivated {
		t.Fatalf("reactivate: %v reactivated=%v", err, reactivated)
	}
	restored, found, err := repository.FindActiveMember(ctx, team.ID, joinerID)
	if err != nil || !found || restored.Role != domain.RoleMember {
		t.Fatalf("restored member: %+v found=%v err=%v", restored, found, err)
	}

	results, err := repository.SearchByKeyword(ctx, "自服务")
	if err != nil || len(results) != 1 {
		t.Fatalf("search: %+v err=%v", results, err)
	}
	if results[0].MemberCount != 2 || results[0].CreditScore != 90 {
		t.Fatalf("search summary fields: %+v", results[0])
	}
}

func TestRepositoryUpdatesJoinPasswordHash(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var creatorID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('join-password-updater') RETURNING id`).Scan(&creatorID); err != nil {
		t.Fatalf("seed creator: %v", err)
	}
	repository := NewRepository(pool)
	team, err := repository.CreateWithCaptain(ctx, "口令更新联队", nil, nil, creatorID)
	if err != nil {
		t.Fatalf("create team: %v", err)
	}

	hash := "$2a$10$invalidhashinvalidhashinvalidhash"
	found, err := repository.UpdateJoinPasswordHash(ctx, team.ID, &hash)
	if err != nil || !found {
		t.Fatalf("set hash: found=%v err=%v", found, err)
	}
	stored, hashFound, err := repository.FindJoinPasswordHash(ctx, team.ID)
	if err != nil || !hashFound || stored == nil || *stored != hash {
		t.Fatalf("hash not stored: %v found=%v err=%v", stored, hashFound, err)
	}

	if found, err = repository.UpdateJoinPasswordHash(ctx, team.ID, nil); err != nil || !found {
		t.Fatalf("clear hash: found=%v err=%v", found, err)
	}
	stored, hashFound, err = repository.FindJoinPasswordHash(ctx, team.ID)
	if err != nil || !hashFound || stored != nil {
		t.Fatalf("hash not cleared: %v found=%v err=%v", stored, hashFound, err)
	}

	found, err = repository.UpdateJoinPasswordHash(ctx, team.ID+9999, &hash)
	if err != nil || found {
		t.Fatalf("missing team should return found=false, got found=%v err=%v", found, err)
	}
}

func TestRepositoryDissolveTeamAndBlockers(t *testing.T) {
	// 覆盖用户侧解散球队的软删除与引用校验：
	// 未结束比赛（主/客队）与进行中申请阻塞；已结束/已取消比赛上的引用不阻塞。
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)

	var captainID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('dissolve-captain') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	var teamID, otherTeamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('解散校验本队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('解散校验对方') RETURNING id`).Scan(&otherTeamID); err != nil {
		t.Fatalf("seed other team: %v", err)
	}

	seedMatch := func(name, status, opponentState string, host, away int64) (string, error) {
		var matchID string
		err := pool.QueryRow(ctx, `
			INSERT INTO matches (id, name, publication_mode, opponent_state, status, host_team_id, away_team_id,
				players_per_team, start_time, end_time, location, created_by_user_id)
			VALUES (gen_random_uuid(), $1, 'online_team', $2, $3, $4, NULLIF($5, 0), 8,
				NOW() + interval '2 hours', NOW() + interval '4 hours', '解散校验球场', $6)
			RETURNING id`, name, opponentState, status, host, away, captainID).Scan(&matchID)
		return matchID, err
	}

	hostUnfinishedID, err := seedMatch("本队发起报名中", "registering", "recruiting", teamID, 0)
	if err != nil {
		t.Fatalf("seed host unfinished match: %v", err)
	}
	awayOngoingID, err := seedMatch("客队进行中", "ongoing", "confirmed", otherTeamID, teamID)
	if err != nil {
		t.Fatalf("seed away ongoing match: %v", err)
	}
	if _, err := seedMatch("已结束赛", "ended", "confirmed", teamID, otherTeamID); err != nil {
		t.Fatalf("seed ended match: %v", err)
	}
	if _, err := seedMatch("已取消赛", "cancelled", "confirmed", otherTeamID, teamID); err != nil {
		t.Fatalf("seed cancelled match: %v", err)
	}
	pendingMatchID, err := seedMatch("待处理约队赛", "registering", "recruiting", otherTeamID, 0)
	if err != nil {
		t.Fatalf("seed pending application match: %v", err)
	}
	endedRecruitID, err := seedMatch("历史约队赛", "ended", "recruiting", otherTeamID, 0)
	if err != nil {
		t.Fatalf("seed ended application match: %v", err)
	}

	seedApplication := func(matchID string) error {
		_, err := pool.Exec(ctx, `
			INSERT INTO match_team_applications (id, match_id, applicant_team_id, introduction, status, created_by_user_id)
			VALUES (gen_random_uuid(), $1, $2, '约战', 'pending', $3)`, matchID, teamID, captainID)
		return err
	}
	if err := seedApplication(pendingMatchID); err != nil {
		t.Fatalf("seed pending application: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO match_team_applications (id, match_id, applicant_team_id, introduction, status, created_by_user_id, selected_at)
		VALUES (gen_random_uuid(), $1, $2, '历史约战', 'selected', $3, NOW())`, endedRecruitID, teamID, captainID); err != nil {
		t.Fatalf("seed ended application: %v", err)
	}

	blockers, err := repository.FindDissolveBlockers(ctx, teamID)
	if err != nil {
		t.Fatalf("find blockers: %v", err)
	}
	if len(blockers.Matches) != 2 {
		t.Fatalf("expected 2 blocking matches, got %d: %+v", len(blockers.Matches), blockers.Matches)
	}
	isHostByID := map[string]bool{}
	for _, match := range blockers.Matches {
		isHostByID[match.ID.String()] = match.IsHost
	}
	if !isHostByID[hostUnfinishedID] {
		t.Fatalf("host unfinished match must block with IsHost=true: %+v", blockers.Matches)
	}
	if isHostByID[awayOngoingID] {
		t.Fatalf("away ongoing match must block with IsHost=false: %+v", blockers.Matches)
	}
	if len(blockers.Applications) != 1 || blockers.Applications[0].MatchID.String() != pendingMatchID {
		t.Fatalf("expected only the pending application to block: %+v", blockers.Applications)
	}

	// 解散后其他球队的引用不受影响；软删除只改本队状态。
	if dissolved, err := repository.Dissolve(ctx, teamID); err != nil || !dissolved {
		t.Fatalf("dissolve active team: dissolved=%v err=%v", dissolved, err)
	}
	team, found, err := repository.FindByID(ctx, teamID)
	if err != nil || !found || team.Status != domain.TeamDissolved {
		t.Fatalf("team should be dissolved: %+v found=%v err=%v", team, found, err)
	}
	if dissolved, err := repository.Dissolve(ctx, teamID); err != nil || dissolved {
		t.Fatalf("re-dissolve must be rejected: dissolved=%v err=%v", dissolved, err)
	}
	otherBlockers, err := repository.FindDissolveBlockers(ctx, otherTeamID)
	if err != nil {
		t.Fatalf("other team blockers: %v", err)
	}
	if len(otherBlockers.Matches) != 2 || len(otherBlockers.Applications) != 0 {
		t.Fatalf("other team should only see unfinished matches: %+v", otherBlockers)
	}
}

func TestRemoveMemberCancelsUpcomingTeamRegistrations(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)

	var captainID, memberID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('rm-captain') RETURNING id`).Scan(&captainID); err != nil {
		t.Fatalf("seed captain: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('rm-member') RETURNING id`).Scan(&memberID); err != nil {
		t.Fatalf("seed member: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('移除联动球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain'), ($1, $3, 'member')`, teamID, captainID, memberID); err != nil {
		t.Fatalf("seed members: %v", err)
	}

	// startOffsetHours 为正表示未来（未开始），为负表示已开赛。
	seedRegistration := func(name, status string, startOffsetHours int, groupKind string, paid bool) {
		var matchID string
		if err := pool.QueryRow(ctx, `
			INSERT INTO matches (id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
				players_per_team, start_time, end_time, location, created_by_user_id)
			VALUES (gen_random_uuid(), $1, 'offline_confirmed', 'no_recruitment', $2, $3, '对手', 8,
				NOW() + make_interval(hours => $4::int), NOW() + make_interval(hours => $4::int) + interval '2 hours',
				'联动球场', $5)
			RETURNING id`, name, status, teamID, startOffsetHours, captainID).Scan(&matchID); err != nil {
			t.Fatalf("seed match %s: %v", name, err)
		}
		var groupTeamID *int64
		var minPlayers, maxPlayers *int
		if groupKind != "individual_opponent" {
			groupTeamID = &teamID
		} else {
			// 散人组 shape check 要求 min/max_players 均非空。
			one, eight := 1, 8
			minPlayers, maxPlayers = &one, &eight
		}
		var groupID string
		if err := pool.QueryRow(ctx, `
			INSERT INTO match_registration_groups (id, match_id, kind, team_id, min_players, max_players)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
			RETURNING id`, matchID, groupKind, groupTeamID, minPlayers, maxPlayers).Scan(&groupID); err != nil {
			t.Fatalf("seed group %s: %v", name, err)
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, paid)
			VALUES (gen_random_uuid(), $1, $2, 'attending', 1, $3)`, groupID, memberID, paid); err != nil {
			t.Fatalf("seed registration %s: %v", name, err)
		}
	}

	seedRegistration("未开始报名中", "registering", 72, "host_team", false)            // 期望：取消
	seedRegistration("进行中已开赛", "ongoing", -1, "host_team", false)                // 期望：保留
	seedRegistration("已完赛", "ended", -72, "host_team", false)                    // 期望：保留
	seedRegistration("未开始已支付", "registering", 96, "guest_team", true)            // 期望：保留（paid 资金保护）
	seedRegistration("未开始散人组", "registering", 120, "individual_opponent", false) // 期望：保留（非本队球队组）

	removed, err := repository.RemoveMember(ctx, teamID, memberID)
	if err != nil || !removed {
		t.Fatalf("remove member: removed=%t err=%v", removed, err)
	}

	var memberRows int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND user_id = $2`, teamID, memberID).Scan(&memberRows); err != nil {
		t.Fatalf("count member rows: %v", err)
	}
	if memberRows != 0 {
		t.Fatalf("expected member row deleted, got %d", memberRows)
	}

	statusByMatch := map[string]string{}
	rows, err := pool.Query(ctx, `
		SELECT m.name, r.status
		FROM match_registrations r
		JOIN match_registration_groups g ON g.id = r.group_id
		JOIN matches m ON m.id = g.match_id
		WHERE r.user_id = $1`, memberID)
	if err != nil {
		t.Fatalf("load registrations: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var name, status string
		if err := rows.Scan(&name, &status); err != nil {
			t.Fatalf("scan registration: %v", err)
		}
		statusByMatch[name] = status
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate registrations: %v", err)
	}

	expected := map[string]string{
		"未开始报名中": "cancelled",
		"进行中已开赛": "attending",
		"已完赛":    "attending",
		"未开始已支付": "attending",
		"未开始散人组": "attending",
	}
	for name, want := range expected {
		if got := statusByMatch[name]; got != want {
			t.Fatalf("match %s registration status=%s, want %s", name, got, want)
		}
	}
}
