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
			INSERT INTO matches (name, publication_mode, opponent_state, status, host_team_id, opponent_name,
				players_per_team, start_time, end_time, location, created_by_user_id)
			VALUES ($1, 'offline_confirmed', 'no_recruitment', $2, $3, '对手', 8,
				NOW() - ($4 || ' days')::interval, NOW() - ($4 || ' days')::interval + interval '2 hours',
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

	// 日期过滤：只看已结束赛当天以后的窗口可把过期未收尾赛排除。
	start := time.Now().AddDate(0, 0, -4)
	end := time.Now()
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
		INSERT INTO matches (name, publication_mode, opponent_state, status, host_team_id, opponent_name,
			players_per_team, start_time, end_time, location, created_by_user_id)
		VALUES ('单场出勤赛', 'offline_confirmed', 'no_recruitment', 'ended', $1, '对手', 8,
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
