package notificationhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	notificationapplication "github.com/oryjk/registration_system/registration_system_go/internal/notification/application"
	notificationdomain "github.com/oryjk/registration_system/registration_system_go/internal/notification/domain"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type NotificationService interface {
	List(ctx context.Context, actor sharedauth.Actor, query notificationapplication.ListQuery) ([]notificationdomain.Notification, error)
	UnreadCount(ctx context.Context, actor sharedauth.Actor) (int64, error)
	MarkAllRead(ctx context.Context, actor sharedauth.Actor) (int64, error)
}

type Handler struct {
	service NotificationService
}

func NewHandler(service NotificationService) *Handler { return &Handler{service: service} }

// NotificationResponse 字段与小程序 BackendNotification 对齐（related_* 为 null 表示无关联）。
type NotificationResponse struct {
	ID          int64      `json:"id"`
	UserID      int64      `json:"user_id"`
	Kind        string     `json:"kind"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	RelatedType *string    `json:"related_type"`
	RelatedID   *string    `json:"related_id"`
	ReadAt      *time.Time `json:"read_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (h *Handler) RegisterAppRoutes(group *gin.RouterGroup) {
	group.GET("/notifications", h.List)
	group.GET("/notifications/unread-count", h.UnreadCount)
	group.POST("/notifications/read-all", h.MarkAllRead)
}

func (h *Handler) List(c *gin.Context) {
	actor, ok := notificationActor(c)
	if !ok {
		return
	}
	unreadOnly, err := strconv.ParseBool(c.DefaultQuery("unread_only", "false"))
	if err != nil {
		unreadOnly = false
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	notifications, err := h.service.List(c.Request.Context(), actor, notificationapplication.ListQuery{UnreadOnly: unreadOnly, Limit: limit})
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]NotificationResponse, 0, len(notifications))
	for _, notification := range notifications {
		items = append(items, mapNotification(notification))
	}
	sharedhttpapi.WriteSuccess(c, items)
}

func (h *Handler) UnreadCount(c *gin.Context) {
	actor, ok := notificationActor(c)
	if !ok {
		return
	}
	count, err := h.service.UnreadCount(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"unread_count": count})
}

func (h *Handler) MarkAllRead(c *gin.Context) {
	actor, ok := notificationActor(c)
	if !ok {
		return
	}
	affected, err := h.service.MarkAllRead(c.Request.Context(), actor)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, gin.H{"affected": affected})
}

func notificationActor(c *gin.Context) (sharedauth.Actor, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
	}
	return actor, ok
}

func mapNotification(notification notificationdomain.Notification) NotificationResponse {
	response := NotificationResponse{
		ID: notification.ID, UserID: notification.UserID, Kind: notification.Kind,
		Title: notification.Title, Content: notification.Content,
		ReadAt: notification.ReadAt, CreatedAt: notification.CreatedAt,
	}
	if notification.RelatedType != "" {
		relatedType := notification.RelatedType
		response.RelatedType = &relatedType
	}
	if notification.RelatedID != "" {
		relatedID := notification.RelatedID
		response.RelatedID = &relatedID
	}
	return response
}
