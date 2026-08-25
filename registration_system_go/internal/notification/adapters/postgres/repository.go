package postgres

import (
	"context"

	notificationsqlc "github.com/oryjk/registration_system/registration_system_go/internal/notification/adapters/postgres/sqlc"
	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	notificationports "github.com/oryjk/registration_system/registration_system_go/internal/notification/ports"
)

type database interface {
	notificationsqlc.DBTX
}

type Repository struct {
	database database
	queries  *notificationsqlc.Queries
}

func NewRepository(database database) *Repository {
	return &Repository{database: database, queries: notificationsqlc.New(database)}
}

func (r *Repository) Create(ctx context.Context, notification notificationdomain.Notification) (notificationdomain.Notification, error) {
	row, err := r.queries.CreateNotification(ctx, notificationsqlc.CreateNotificationParams{
		UserID: notification.UserID, Kind: notification.Kind, Title: notification.Title, Content: notification.Content,
		RelatedType: &notification.RelatedType, RelatedID: &notification.RelatedID,
	})
	if err != nil {
		return notificationdomain.Notification{}, err
	}
	return mapNotification(row), nil
}

func (r *Repository) List(ctx context.Context, filter notificationports.ListFilter) ([]notificationdomain.Notification, error) {
	rows, err := r.queries.ListNotifications(ctx, notificationsqlc.ListNotificationsParams{
		UserID: filter.UserID, UnreadOnly: filter.UnreadOnly, LimitRows: int32(filter.Limit),
	})
	if err != nil {
		return nil, err
	}
	items := make([]notificationdomain.Notification, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNotification(row))
	}
	return items, nil
}

func (r *Repository) CountUnread(ctx context.Context, userID int64) (int64, error) {
	return r.queries.CountUnreadNotifications(ctx, userID)
}

func (r *Repository) MarkAllRead(ctx context.Context, userID int64) (int64, error) {
	return r.queries.MarkAllNotificationsRead(ctx, userID)
}

func (r *Repository) MarkRead(ctx context.Context, userID int64, id int64) (bool, error) {
	affected, err := r.queries.MarkNotificationRead(ctx, notificationsqlc.MarkNotificationReadParams{
		ID: id, UserID: userID,
	})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func mapNotification(row notificationsqlc.Notification) notificationdomain.Notification {
	notification := notificationdomain.Notification{
		ID: row.ID, UserID: row.UserID, Kind: row.Kind, Title: row.Title, Content: row.Content,
		CreatedAt: row.CreatedAt.Time,
	}
	if row.RelatedType != nil {
		notification.RelatedType = *row.RelatedType
	}
	if row.RelatedID != nil {
		notification.RelatedID = *row.RelatedID
	}
	if row.ReadAt.Valid {
		readAt := row.ReadAt.Time
		notification.ReadAt = &readAt
	}
	return notification
}
