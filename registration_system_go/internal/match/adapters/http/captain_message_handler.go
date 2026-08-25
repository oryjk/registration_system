package matchhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// CaptainMessageUseCase 「联系队长」留言的应用能力，由 CaptainMessageService 实现。
type CaptainMessageUseCase interface {
	Send(context.Context, sharedauth.Actor, uuid.UUID, string) (uuid.UUID, error)
	Reply(context.Context, sharedauth.Actor, uuid.UUID, string) (uuid.UUID, error)
	ListThreads(context.Context, sharedauth.Actor, application.CaptainMessageListQuery) (application.CaptainMessageListResult, error)
	GetThread(context.Context, sharedauth.Actor, uuid.UUID) (application.CaptainMessageThreadDetail, error)
}

type CaptainMessageHandler struct {
	service CaptainMessageUseCase
}

func NewCaptainMessageHandler(service CaptainMessageUseCase) *CaptainMessageHandler {
	return &CaptainMessageHandler{service: service}
}

type CaptainMessageContentRequest struct {
	Content string `json:"content" binding:"required"`
}

type CaptainThreadSummaryResponse struct {
	ID                        uuid.UUID                  `json:"id"`
	MatchID                   uuid.UUID                  `json:"match_id"`
	TeamID                    int64                      `json:"team_id"`
	ThreadOwnerUserID         int64                      `json:"thread_owner_user_id"`
	MatchName                 string                     `json:"match_name"`
	HostTeamName              string                     `json:"host_team_name"`
	Owner                     CaptainParticipantResponse `json:"owner"`
	LatestContent             string                     `json:"latest_content"`
	LatestSenderIsCaptainSide bool                       `json:"latest_sender_is_captain_side"`
	LatestCreatedAt           time.Time                  `json:"latest_created_at"`
}

type CaptainParticipantResponse struct {
	UserID    int64   `json:"user_id"`
	Nickname  string  `json:"nickname"`
	AvatarURL *string `json:"avatar_url"`
}

type CaptainMessageResponse struct {
	ID                  uuid.UUID                  `json:"id"`
	SenderUserID        int64                      `json:"sender_user_id"`
	SenderIsCaptainSide bool                       `json:"sender_is_captain_side"`
	Content             string                     `json:"content"`
	CreatedAt           time.Time                  `json:"created_at"`
	Sender              CaptainParticipantResponse `json:"sender"`
}

type CaptainThreadListResponse struct {
	Items    []CaptainThreadSummaryResponse `json:"items"`
	Total    int64                          `json:"total"`
	Page     int                            `json:"page"`
	PageSize int                            `json:"page_size"`
}

type CaptainThreadDetailResponse struct {
	ID              uuid.UUID                `json:"id"`
	MatchID         uuid.UUID                `json:"match_id"`
	TeamID          int64                    `json:"team_id"`
	MatchName       string                   `json:"match_name"`
	HostTeamName    string                   `json:"host_team_name"`
	ViewerIsManager bool                     `json:"viewer_is_manager"`
	Messages        []CaptainMessageResponse `json:"messages"`
}

type CaptainThreadCreatedResponse struct {
	ThreadID uuid.UUID `json:"thread_id"`
}

// List GET /captain-messages：我的留言对话列表。
func (h *CaptainMessageHandler) List(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	query := application.CaptainMessageListQuery{}
	var err error
	if raw := c.Query("page"); raw != "" {
		query.Page, err = strconv.Atoi(raw)
		if err != nil {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "页码无效"))
			return
		}
	}
	if raw := c.Query("page_size"); raw != "" {
		query.PageSize, err = strconv.Atoi(raw)
		if err != nil {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "分页大小无效"))
			return
		}
	}
	result, err := h.service.ListThreads(c.Request.Context(), actor, query)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	items := make([]CaptainThreadSummaryResponse, 0, len(result.Items))
	for _, thread := range result.Items {
		items = append(items, mapCaptainThreadSummary(thread))
	}
	sharedhttpapi.WriteSuccess(c, CaptainThreadListResponse{
		Items: items, Total: result.Total, Page: result.Page, PageSize: result.PageSize,
	})
}

// GetThread GET /captain-messages/:threadId：对话详情（串内全部消息）。
func (h *CaptainMessageHandler) GetThread(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	threadID, err := uuid.Parse(c.Param("threadId"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "留言对话 ID 无效"))
		return
	}
	detail, err := h.service.GetThread(c.Request.Context(), actor, threadID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	messages := make([]CaptainMessageResponse, 0, len(detail.Messages))
	for _, message := range detail.Messages {
		messages = append(messages, CaptainMessageResponse{
			ID: message.ID, SenderUserID: message.SenderUserID, SenderIsCaptainSide: message.SenderIsCaptainSide,
			Content: message.Content, CreatedAt: message.CreatedAt,
			Sender: CaptainParticipantResponse{
				UserID: message.SenderUserID, Nickname: message.SenderNickname, AvatarURL: message.SenderAvatarURL,
			},
		})
	}
	sharedhttpapi.WriteSuccess(c, CaptainThreadDetailResponse{
		ID: detail.Thread.ID, MatchID: detail.Thread.MatchID, TeamID: detail.Thread.TeamID,
		MatchName: detail.Thread.MatchName, HostTeamName: detail.Thread.HostTeamName,
		ViewerIsManager: detail.ViewerIsManager, Messages: messages,
	})
}

// Send POST /matches/:id/captain-messages：在比赛详情页发起/续写对主队队长的留言。
func (h *CaptainMessageHandler) Send(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	matchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "比赛 ID 无效"))
		return
	}
	var request CaptainMessageContentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "留言内容不完整"))
		return
	}
	threadID, err := h.service.Send(c.Request.Context(), actor, matchID, request.Content)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CaptainThreadCreatedResponse{ThreadID: threadID})
}

// Reply POST /captain-messages/:threadId/reply：在既有对话串内追加留言。
func (h *CaptainMessageHandler) Reply(c *gin.Context) {
	actor, ok := userActor(c)
	if !ok {
		return
	}
	threadID, err := uuid.Parse(c.Param("threadId"))
	if err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "留言对话 ID 无效"))
		return
	}
	var request CaptainMessageContentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "留言内容不完整"))
		return
	}
	resultThreadID, err := h.service.Reply(c.Request.Context(), actor, threadID, request.Content)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, CaptainThreadCreatedResponse{ThreadID: resultThreadID})
}

func (h *CaptainMessageHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/captain-messages", h.List)
	group.GET("/captain-messages/:threadId", h.GetThread)
	group.POST("/captain-messages/:threadId/reply", h.Reply)
	group.POST("/matches/:id/captain-messages", h.Send)
}

func mapCaptainThreadSummary(thread ports.CaptainMessageThread) CaptainThreadSummaryResponse {
	return CaptainThreadSummaryResponse{
		ID: thread.ID, MatchID: thread.MatchID, TeamID: thread.TeamID,
		ThreadOwnerUserID: thread.ThreadOwnerUserID, MatchName: thread.MatchName,
		HostTeamName: thread.HostTeamName,
		Owner: CaptainParticipantResponse{
			UserID: thread.ThreadOwnerUserID, Nickname: thread.OwnerNickname, AvatarURL: thread.OwnerAvatarURL,
		},
		LatestContent:             thread.LatestContent,
		LatestSenderIsCaptainSide: thread.LatestSenderIsCaptainSide,
		LatestCreatedAt:           thread.LatestCreatedAt,
	}
}
