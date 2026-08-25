package application

import (
	"context"
	"errors"
	"testing"

	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	notificationports "github.com/oryjk/registration_system/registration_system_go/internal/notification/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeRepository struct {
	created []notificationdomain.Notification
}

func (f *fakeRepository) Create(_ context.Context, notification notificationdomain.Notification) (notificationdomain.Notification, error) {
	notification.ID = int64(len(f.created) + 1)
	f.created = append(f.created, notification)
	return notification, nil
}

func (f *fakeRepository) List(_ context.Context, filter notificationports.ListFilter) ([]notificationdomain.Notification, error) {
	return nil, nil
}

func (f *fakeRepository) CountUnread(_ context.Context, _ int64) (int64, error) { return 0, nil }

func (f *fakeRepository) MarkAllRead(_ context.Context, _ int64) (int64, error) { return 0, nil }

func TestNotifyRejectsInvalidMessage(t *testing.T) {
	service := NewService(&fakeRepository{})
	err := service.Notify(context.Background(), SystemNotification{UserID: 1, Kind: "", Title: "t", Content: "c"})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("kind 为空应返回校验错误，得到 %v", err)
	}
}

func TestNotifyPersistsNotification(t *testing.T) {
	repository := &fakeRepository{}
	service := NewService(repository)
	err := service.Notify(context.Background(), SystemNotification{
		UserID: 7, Kind: "teamfund_depleted", Title: "队费余额不足",
		Content: "「周末球局」已扣费 ¥30.00", RelatedType: "match", RelatedID: "m-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repository.created) != 1 || repository.created[0].UserID != 7 || repository.created[0].Kind != "teamfund_depleted" {
		t.Fatalf("应写入一条通知: %+v", repository.created)
	}
}

func TestUserEndpointsRejectAdminActor(t *testing.T) {
	service := NewService(&fakeRepository{})
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	if _, err := service.List(context.Background(), admin, ListQuery{}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("List 应拒绝管理员 actor，得到 %v", err)
	}
	if _, err := service.UnreadCount(context.Background(), admin); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("UnreadCount 应拒绝管理员 actor，得到 %v", err)
	}
	if _, err := service.MarkAllRead(context.Background(), admin); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("MarkAllRead 应拒绝管理员 actor，得到 %v", err)
	}
}
