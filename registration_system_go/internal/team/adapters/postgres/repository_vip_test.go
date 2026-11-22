package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryVipStatusConsumeCreditAndShareBackgrounds(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()

	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid, nickname) VALUES ('vip-repo-user', '测试队长') RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	vipUntil := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Microsecond)
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, vip_until, vip_credits) VALUES ('会员测试队', $1, 2) RETURNING id`, vipUntil).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'captain', 'active')`, teamID, userID); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(pool)

	// 查询会员状态与各现有球队查询中的 vip_credits 字段。
	status, found, err := repo.FindVipStatus(ctx, teamID)
	if err != nil || !found || !status.IsVip || status.VipCredits != 2 || status.VipUntil == nil || !status.VipUntil.Equal(vipUntil) {
		t.Fatalf("FindVipStatus: status=%+v found=%v err=%v", status, found, err)
	}
	membershipState, err := repo.GetTeamMembershipState(ctx, teamID, userID)
	if err != nil || membershipState.VipCredits != 2 {
		t.Fatalf("GetTeamMembershipState: state=%+v err=%v", membershipState, err)
	}
	myTeams, err := repo.ListByUser(ctx, userID)
	if err != nil || len(myTeams) != 1 || myTeams[0].VipCredits != 2 {
		t.Fatalf("ListByUser: teams=%+v err=%v", myTeams, err)
	}
	searched, err := repo.SearchByKeyword(ctx, "会员测试队")
	if err != nil || len(searched) != 1 || searched[0].VipCredits != 2 {
		t.Fatalf("SearchByKeyword: searched=%+v err=%v", searched, err)
	}

	// 条件扣减单次权益：2 -> 1 -> 0 -> 拒绝。
	for i, want := range []bool{true, true, false} {
		consumed, err := repo.ConsumeVipCredit(ctx, teamID)
		if err != nil || consumed != want {
			t.Fatalf("ConsumeVipCredit step %d: consumed=%v want=%v err=%v", i, consumed, want, err)
		}
	}
	status, found, err = repo.FindVipStatus(ctx, teamID)
	if err != nil || !found || status.VipCredits != 0 {
		t.Fatalf("after consume: status=%+v found=%v err=%v", status, found, err)
	}

	// 球队分享背景资源库写入、去重、默认背景同步与存在性校验。
	url1 := "https://cdn.example.com/match-share-bgs/bg1.jpg"
	url2 := "https://cdn.example.com/match-share-bgs/bg2.jpg"
	if err := repo.RecordShareBackground(ctx, teamID, url1, &userID); err != nil {
		t.Fatal(err)
	}
	if err := repo.RecordShareBackground(ctx, teamID, url2, &userID); err != nil {
		t.Fatal(err)
	}
	// 重复写入 url1：不产生重复记录，但默认背景更新为 url1。
	if err := repo.RecordShareBackground(ctx, teamID, url1, &userID); err != nil {
		t.Fatal(err)
	}

	items, defaultURL, err := repo.ListShareBackgrounds(ctx, teamID)
	if err != nil {
		t.Fatal(err)
	}
	if defaultURL != url1 || len(items) != 2 {
		t.Fatalf("ListShareBackgrounds: default=%q items=%+v", defaultURL, items)
	}
	has1, err := repo.HasTeamShareBackground(ctx, teamID, url1)
	if err != nil || !has1 {
		t.Fatalf("HasTeamShareBackground(url1): has=%v err=%v", has1, err)
	}
	hasMissing, err := repo.HasTeamShareBackground(ctx, teamID, "https://cdn.example.com/other.jpg")
	if err != nil || hasMissing {
		t.Fatalf("HasTeamShareBackground(other): has=%v err=%v", hasMissing, err)
	}
}
