package postgres

import (
	"context"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
	userapplication "github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

// TestAdminUserRepositorySearchAndMatchAdmin 覆盖管理端用户搜索、
// 比赛管理员过滤与设置/取消标记的持久化。
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
	items, err := repository.ListForAdmin(ctx, ports.AdminUserFilter{MatchAdminOnly: true})
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
