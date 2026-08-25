package postgres

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	notificationports "github.com/oryjk/registration_system/registration_system_go/internal/notification/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestNotificationRepositoryLifecycle(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedNotificationUser(t, pool)
	repository := NewRepository(pool)

	created := make([]notificationdomain.Notification, 0, 3)
	for index := 0; index < 3; index++ {
		notification, err := repository.Create(ctx, notificationdomain.Notification{
			UserID: userID, Kind: "teamfund_depleted", Title: fmt.Sprintf("通知 %d", index),
			Content: "余额不足", RelatedType: "match", RelatedID: "abc",
			CreatedAt: time.Now(),
		})
		if err != nil {
			t.Fatal(err)
		}
		if notification.ID == 0 {
			t.Fatal("创建后应带回数据库 ID")
		}
		created = append(created, notification)
	}

	unread, err := repository.CountUnread(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if unread != 3 {
		t.Fatalf("未读数应为 3，得到 %d", unread)
	}

	all, err := repository.List(ctx, notificationports.ListFilter{UserID: userID, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 3 || all[0].ID < all[1].ID {
		t.Fatalf("列表应按 id 倒序: %+v", all)
	}
	if all[0].RelatedType != "match" || all[0].RelatedID != "abc" {
		t.Fatalf("关联字段应往返一致: %+v", all[0])
	}

	unreadOnly, err := repository.List(ctx, notificationports.ListFilter{UserID: userID, UnreadOnly: true, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if len(unreadOnly) != 3 {
		t.Fatalf("未读过滤应返回 3 条，得到 %d", len(unreadOnly))
	}

	affected, err := repository.MarkAllRead(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if affected != 3 {
		t.Fatalf("标记已读应影响 3 条，得到 %d", affected)
	}
	unread, err = repository.CountUnread(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	if unread != 0 {
		t.Fatalf("全部已读后未读数应为 0，得到 %d", unread)
	}
	unreadOnly, err = repository.List(ctx, notificationports.ListFilter{UserID: userID, UnreadOnly: true, Limit: 50})
	if err != nil {
		t.Fatal(err)
	}
	if len(unreadOnly) != 0 {
		t.Fatalf("全部已读后未读过滤应为空，得到 %d", len(unreadOnly))
	}
}

func seedNotificationUser(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	var userID int64
	openid := fmt.Sprintf("notify-%d", time.Now().UnixNano())
	if err := pool.QueryRow(context.Background(), `INSERT INTO users (openid) VALUES ($1) RETURNING id`, openid).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	return userID
}

func TestNotificationRepositoryMarkReadIsScopedAndIdempotent(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedNotificationUser(t, pool)
	otherUser := seedNotificationUser(t, pool)
	repository := NewRepository(pool)

	created, err := repository.Create(ctx, notificationdomain.Notification{
		UserID: userID, Kind: "match_captain_message", Title: "球队留言",
		Content: "「阿东」给你留言", RelatedType: "captain_message", RelatedID: "t-1",
		CreatedAt: time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}

	// 他人不能替我把通知标为已读。
	read, err := repository.MarkRead(ctx, otherUser, created.ID)
	if err != nil || read {
		t.Fatalf("他人标记应无效: read=%t err=%v", read, err)
	}
	// 本人标记生效。
	read, err = repository.MarkRead(ctx, userID, created.ID)
	if err != nil || !read {
		t.Fatalf("本人标记应生效: read=%t err=%v", read, err)
	}
	// 重复标记幂等返回 false，不再重复计数。
	read, err = repository.MarkRead(ctx, userID, created.ID)
	if err != nil || read {
		t.Fatalf("重复标记应返回 false: read=%t err=%v", read, err)
	}
	unread, err := repository.CountUnread(ctx, userID)
	if err != nil || unread != 0 {
		t.Fatalf("标记后未读应为 0，得到 %d err=%v", unread, err)
	}
	// 不存在的通知 id 静默返回 false。
	read, err = repository.MarkRead(ctx, userID, 999999)
	if err != nil || read {
		t.Fatalf("不存在的通知应返回 false: read=%t err=%v", read, err)
	}
}
