package domain

import (
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// Notification 站内通知；kind 由业务方定义（如 teamfund_depleted）。
type Notification struct {
	ID          int64
	UserID      int64
	Kind        string
	Title       string
	Content     string
	RelatedType string
	RelatedID   string
	ReadAt      *time.Time
	CreatedAt   time.Time
}

func (n Notification) IsRead() bool { return n.ReadAt != nil }

func NewNotification(userID int64, kind, title, content, relatedType, relatedID string, now time.Time) (Notification, error) {
	kind = strings.TrimSpace(kind)
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	if userID <= 0 || kind == "" || title == "" || content == "" {
		return Notification{}, sharederror.New(sharederror.KindValidation, "通知参数无效")
	}
	return Notification{
		UserID: userID, Kind: kind, Title: title, Content: content,
		RelatedType: strings.TrimSpace(relatedType), RelatedID: strings.TrimSpace(relatedID),
		CreatedAt: now,
	}, nil
}
