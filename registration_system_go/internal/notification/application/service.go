package application

import (
	"context"
	"time"

	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	notificationports "github.com/oryjk/registration_system/registration_system_go/internal/notification/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// SystemNotification 系统事件通知入参（无用户会话，由各业务模块调用）。
type SystemNotification struct {
	UserID      int64
	Kind        string
	Title       string
	Content     string
	RelatedType string
	RelatedID   string
}

type ListQuery struct {
	UnreadOnly bool
	Limit      int
}

type Service struct {
	repository notificationports.Repository
	now        func() time.Time
}

func NewService(repository notificationports.Repository) *Service {
	return &Service{repository: repository, now: time.Now}
}

// Notify 写入一条系统通知；参数校验失败返回校验错误，由调用方决定是否忽略。
func (s *Service) Notify(ctx context.Context, message SystemNotification) error {
	notification, err := notificationdomain.NewNotification(message.UserID, message.Kind, message.Title,
		message.Content, message.RelatedType, message.RelatedID, s.now())
	if err != nil {
		return err
	}
	_, err = s.repository.Create(ctx, notification)
	return err
}

func (s *Service) List(ctx context.Context, actor sharedauth.Actor, query ListQuery) ([]notificationdomain.Notification, error) {
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	limit := query.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repository.List(ctx, notificationports.ListFilter{UserID: actor.ID, UnreadOnly: query.UnreadOnly, Limit: limit})
}

func (s *Service) UnreadCount(ctx context.Context, actor sharedauth.Actor) (int64, error) {
	if !actor.IsUser() {
		return 0, sharederror.ErrForbidden
	}
	return s.repository.CountUnread(ctx, actor.ID)
}

func (s *Service) MarkAllRead(ctx context.Context, actor sharedauth.Actor) (int64, error) {
	if !actor.IsUser() {
		return 0, sharederror.ErrForbidden
	}
	return s.repository.MarkAllRead(ctx, actor.ID)
}
