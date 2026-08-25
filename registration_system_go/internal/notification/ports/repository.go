package ports

import (
	"context"

	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
)

type ListFilter struct {
	UserID     int64
	UnreadOnly bool
	Limit      int
}

type Repository interface {
	Create(ctx context.Context, notification notificationdomain.Notification) (notificationdomain.Notification, error)
	List(ctx context.Context, filter ListFilter) ([]notificationdomain.Notification, error)
	CountUnread(ctx context.Context, userID int64) (int64, error)
	MarkAllRead(ctx context.Context, userID int64) (int64, error)
}
