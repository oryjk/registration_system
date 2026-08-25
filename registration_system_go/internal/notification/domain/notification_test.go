package domain

import (
	"errors"
	"testing"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestNewNotificationValidatesInput(t *testing.T) {
	now := time.Date(2026, 8, 23, 10, 0, 0, 0, time.UTC)
	if _, err := NewNotification(0, "kind", "标题", "内容", "", "", now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("userID=0 应返回校验错误，得到 %v", err)
	}
	if _, err := NewNotification(1, " ", "标题", "内容", "", "", now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("kind 空白应返回校验错误，得到 %v", err)
	}
	if _, err := NewNotification(1, "kind", "", "内容", "", "", now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("标题空白应返回校验错误，得到 %v", err)
	}
	if _, err := NewNotification(1, "kind", "标题", " ", "", "", now); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("内容空白应返回校验错误，得到 %v", err)
	}

	notification, err := NewNotification(1, "teamfund_depleted", " 标题 ", " 内容 ", " match ", " abc ", now)
	if err != nil {
		t.Fatal(err)
	}
	if notification.Title != "标题" || notification.Content != "内容" {
		t.Fatalf("标题/内容应去空白: %+v", notification)
	}
	if notification.RelatedType != "match" || notification.RelatedID != "abc" {
		t.Fatalf("关联字段应去空白: %+v", notification)
	}
	if !notification.CreatedAt.Equal(now) {
		t.Fatalf("创建时间应透传: %+v", notification)
	}
	if notification.IsRead() {
		t.Fatal("新通知应是未读状态")
	}
}
