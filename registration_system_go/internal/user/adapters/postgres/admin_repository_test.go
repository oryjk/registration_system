package postgres

import (
	"context"
	"testing"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	userapplication "github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

// TestAdminUserRepositorySearchAndMatchAdmin 覆盖管理端用户搜索、
// 比赛管理员过滤与设置/取消标记的持久化。
func TestAdminUserRepositoryFiltersByActivity(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()
	now := time.Now().UTC()

	seed := func(openID, nickname string) domain.User {
		t.Helper()
		user, err := repository.Create(ctx, domain.User{OpenID: openID, Nickname: nickname, Status: domain.StatusActive})
		if err != nil {
			t.Fatalf("create user %s: %v", nickname, err)
		}
		return user
	}
	active := seed("activity-active", "最近活跃")
	inactive := seed("activity-inactive", "长期未活跃")
	never := seed("activity-never", "从未活跃")

	activeAt := now.Add(-24 * time.Hour)
	inactiveAt := now.Add(-31 * 24 * time.Hour)
	if err := repository.TouchLastActive(ctx, active.ID, activeAt, now); err != nil {
		t.Fatalf("touch active user: %v", err)
	}
	if err := repository.TouchLastActive(ctx, inactive.ID, inactiveAt, now); err != nil {
		t.Fatalf("touch inactive user: %v", err)
	}

	adminActor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	service := userapplication.NewAdminUserService(repository)
	assertIDs := func(activity string, want ...int64) {
		t.Helper()
		result, err := service.List(ctx, adminActor, userapplication.AdminUserListQuery{Activity: activity, PageSize: 100})
		if err != nil {
			t.Fatalf("list activity=%s: %v", activity, err)
		}
		if len(result.Items) != len(want) {
			t.Fatalf("activity=%s items=%d, want=%d: %+v", activity, len(result.Items), len(want), result.Items)
		}
		for index, userID := range want {
			if result.Items[index].ID != userID {
				t.Fatalf("activity=%s item[%d]=%d, want=%d", activity, index, result.Items[index].ID, userID)
			}
		}
	}

	assertIDs("active_7d", active.ID)
	assertIDs("inactive_30d", inactive.ID)
	assertIDs("never", never.ID)
	assertIDs("all", active.ID, inactive.ID, never.ID)
}

// TestAdminUserRepositorySorting 验证最近活跃/注册时间的升降序，
// 从未活跃（last_active_at 为 NULL）在任何方向都排最后。
func TestAdminUserRepositorySorting(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()
	now := time.Now().UTC()

	seed := func(openID string) domain.User {
		t.Helper()
		user, err := repository.Create(ctx, domain.User{OpenID: openID, Nickname: openID, Status: domain.StatusActive})
		if err != nil {
			t.Fatalf("create user %s: %v", openID, err)
		}
		return user
	}
	recent := seed("sort-recent")
	earlier := seed("sort-earlier")
	never := seed("sort-never")

	// created_at 由数据库默认值生成（同事务时间接近），这里显式设定以便断言注册时间排序。
	createdRecent := now.Add(-72 * time.Hour)
	createdEarlier := now.Add(-24 * time.Hour)
	createdNever := now.Add(-48 * time.Hour)
	for _, seedTime := range []struct {
		id int64
		at time.Time
	}{{recent.ID, createdRecent}, {earlier.ID, createdEarlier}, {never.ID, createdNever}} {
		if _, err := pool.Exec(ctx, `UPDATE users SET created_at=$1 WHERE id=$2`, seedTime.at, seedTime.id); err != nil {
			t.Fatalf("set created_at for %d: %v", seedTime.id, err)
		}
	}
	if err := repository.TouchLastActive(ctx, recent.ID, now.Add(-1*time.Hour), now); err != nil {
		t.Fatalf("touch recent: %v", err)
	}
	if err := repository.TouchLastActive(ctx, earlier.ID, now.Add(-2*time.Hour), now); err != nil {
		t.Fatalf("touch earlier: %v", err)
	}

	adminActor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	service := userapplication.NewAdminUserService(repository)
	assertOrder := func(sort string, want ...int64) {
		t.Helper()
		result, err := service.List(ctx, adminActor, userapplication.AdminUserListQuery{Sort: sort, PageSize: 100})
		if err != nil {
			t.Fatalf("list sort=%s: %v", sort, err)
		}
		if len(result.Items) != len(want) {
			t.Fatalf("sort=%s items=%d, want=%d: %+v", sort, len(result.Items), len(want), result.Items)
		}
		for index, userID := range want {
			if result.Items[index].ID != userID {
				t.Fatalf("sort=%s item[%d]=%d, want=%d", sort, index, result.Items[index].ID, userID)
			}
		}
	}

	// 默认与历史行为一致：最近活跃倒序、从未活跃最后。
	assertOrder("", recent.ID, earlier.ID, never.ID)
	assertOrder("last_active_desc", recent.ID, earlier.ID, never.ID)
	assertOrder("last_active_asc", earlier.ID, recent.ID, never.ID)
	assertOrder("created_desc", earlier.ID, never.ID, recent.ID)
	assertOrder("created_asc", recent.ID, never.ID, earlier.ID)
}

// TestAdminUserRepositoryFiltersByStatusAndIdentity 验证账号状态与身份筛选，计数与列表一致。
func TestAdminUserRepositoryFiltersByStatusAndIdentity(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	seed := func(openID string, frozen bool) domain.User {
		t.Helper()
		user, err := repository.Create(ctx, domain.User{OpenID: openID, Nickname: openID, Status: domain.StatusActive})
		if err != nil {
			t.Fatalf("create user %s: %v", openID, err)
		}
		if frozen {
			if _, err := pool.Exec(ctx, `UPDATE users SET status='frozen' WHERE id=$1`, user.ID); err != nil {
				t.Fatalf("freeze user %s: %v", openID, err)
			}
		}
		return user
	}
	normalActive := seed("filter-normal-active", false)
	normalFrozen := seed("filter-normal-frozen", true)
	adminActive := seed("filter-admin-active", false)
	adminFrozen := seed("filter-admin-frozen", true)

	adminActor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	service := userapplication.NewAdminUserService(repository)
	if _, err := service.SetMatchAdmin(ctx, adminActor, adminActive.ID, true); err != nil {
		t.Fatalf("set match admin: %v", err)
	}
	if _, err := service.SetMatchAdmin(ctx, adminActor, adminFrozen.ID, true); err != nil {
		t.Fatalf("set match admin frozen: %v", err)
	}

	assertResult := func(identity, status string, want ...int64) {
		t.Helper()
		result, err := service.List(ctx, adminActor, userapplication.AdminUserListQuery{Identity: identity, StatusFilter: status, PageSize: 100})
		if err != nil {
			t.Fatalf("list identity=%s status=%s: %v", identity, status, err)
		}
		if result.Total != int64(len(want)) {
			t.Fatalf("identity=%s status=%s total=%d, want %d", identity, status, result.Total, len(want))
		}
		if len(result.Items) != len(want) {
			t.Fatalf("identity=%s status=%s items=%d, want %d", identity, status, len(result.Items), len(want))
		}
		for index, userID := range want {
			if result.Items[index].ID != userID {
				t.Fatalf("identity=%s status=%s item[%d]=%d, want=%d", identity, status, index, result.Items[index].ID, userID)
			}
		}
	}

	assertResult("all", "all", adminFrozen.ID, adminActive.ID, normalFrozen.ID, normalActive.ID)
	assertResult("normal", "all", normalFrozen.ID, normalActive.ID)
	assertResult("match_admin", "all", adminFrozen.ID, adminActive.ID)
	assertResult("all", "frozen", adminFrozen.ID, normalFrozen.ID)
	assertResult("all", "active", adminActive.ID, normalActive.ID)
	assertResult("match_admin", "frozen", adminFrozen.ID)
	assertResult("normal", "active", normalActive.ID)
}

func TestAdminUserRepositorySearchAndMatchAdmin(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	repository := NewRepository(pool)
	ctx := context.Background()

	seed := func(openID, nickname, realName string) domain.User {
		t.Helper()
		user, err := repository.Create(ctx, domain.User{OpenID: openID, Nickname: nickname, Status: domain.StatusActive})
		if err != nil {
			t.Fatalf("create user %s: %v", nickname, err)
		}
		user.RealName = &realName
		updated, err := repository.UpdateProfile(ctx, user)
		if err != nil {
			t.Fatalf("update user %s: %v", nickname, err)
		}
		return updated
	}
	zhang := seed("admin-search-zhang", "张三", "张三丰")
	li := seed("admin-search-li", "李四", "李逍遥")
	adminActor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	service := userapplication.NewAdminUserService(repository)

	// 按昵称搜索。
	result, err := service.List(ctx, adminActor, userapplication.AdminUserListQuery{Search: "张"})
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if result.Total != 1 || len(result.Items) != 1 || result.Items[0].ID != zhang.ID {
		t.Fatalf("昵称搜索结果不符: %+v", result)
	}

	// 设置李四为比赛管理员后按过滤条件查询。
	if _, err := service.SetMatchAdmin(ctx, adminActor, li.ID, true); err != nil {
		t.Fatalf("set match admin: %v", err)
	}
	result, err = service.List(ctx, adminActor, userapplication.AdminUserListQuery{MatchAdminOnly: true})
	if err != nil {
		t.Fatalf("list match admins: %v", err)
	}
	if result.Total != 1 || result.Items[0].ID != li.ID || !result.Items[0].IsMatchAdmin {
		t.Fatalf("比赛管理员过滤结果不符: %+v", result)
	}

	// 用户端视角：李四是比赛管理员，张三不是。
	users := userapplication.NewAppService(repository)
	if err := users.EnsureMatchAdmin(ctx, li.ID); err != nil {
		t.Fatalf("李四应是比赛管理员: %v", err)
	}
	if err := users.EnsureMatchAdmin(ctx, zhang.ID); err == nil {
		t.Fatal("张三不应是比赛管理员")
	}

	// 取消后过滤与身份判定同步失效。
	if _, err := service.SetMatchAdmin(ctx, adminActor, li.ID, false); err != nil {
		t.Fatalf("unset match admin: %v", err)
	}
	items, err := repository.ListForAdmin(ctx, ports.AdminUserFilter{Identity: "match_admin"})
	if err != nil {
		t.Fatalf("list after unset: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("取消后不应再有比赛管理员: %+v", items)
	}

	// 不存在的用户设置身份应返回 NotFound。
	if _, err := service.SetMatchAdmin(ctx, adminActor, 999999, true); err == nil {
		t.Fatal("不存在用户的设置应失败")
	}
}
