package application

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	defaultCaptainThreadPageSize = 20
	maxCaptainThreadPageSize     = 50
)

// TeamManagerAuthorizer 校验用户是否为球队管理者（队长/领队），由 team 模块实现。
type TeamManagerAuthorizer interface {
	EnsureManager(ctx context.Context, teamID, userID int64) error
}

// CaptainMessageMatchLoader 读取比赛基础信息（含报名组，组数据此处不用）。
type CaptainMessageMatchLoader interface {
	FindByID(ctx context.Context, matchID uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
}

type CaptainMessageService struct {
	repository ports.CaptainMessageRepository
	matches    CaptainMessageMatchLoader
	authorizer TeamManagerAuthorizer
}

func NewCaptainMessageService(repository ports.CaptainMessageRepository, matches CaptainMessageMatchLoader,
	authorizer TeamManagerAuthorizer,
) *CaptainMessageService {
	return &CaptainMessageService{repository: repository, matches: matches, authorizer: authorizer}
}

type CaptainMessageListQuery struct {
	Page     int
	PageSize int
}

type CaptainMessageListResult struct {
	Items    []ports.CaptainMessageThread
	Total    int64
	Page     int
	PageSize int
}

type CaptainMessageThreadDetail struct {
	Thread          ports.CaptainMessage
	Messages        []ports.CaptainMessage
	ViewerIsManager bool
}

// Send 在比赛详情页发起/续写对主队队长的留言；同一用户对同一比赛只保留一串对话。
func (s *CaptainMessageService) Send(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, content string) (uuid.UUID, error) {
	if !actor.IsUser() {
		return uuid.Nil, sharederror.ErrForbidden
	}
	trimmed, err := domain.NewCaptainMessageContent(content)
	if err != nil {
		return uuid.Nil, err
	}
	match, _, found, err := s.matches.FindByID(ctx, matchID)
	if err != nil {
		return uuid.Nil, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return uuid.Nil, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if match.HostTeamID == nil {
		return uuid.Nil, sharederror.New(sharederror.KindValidation, "该比赛没有主队，无法联系队长")
	}
	if err := s.authorizer.EnsureManager(ctx, *match.HostTeamID, actor.ID); err == nil {
		return uuid.Nil, sharederror.New(sharederror.KindValidation, "自己球队的比赛无需给自己留言")
	}

	thread, found, err := s.repository.FindCaptainThreadByOwner(ctx, matchID, actor.ID)
	if err != nil {
		return uuid.Nil, sharederror.Wrap(sharederror.KindInternal, "查询留言对话失败", err)
	}
	// 新串时首条消息 id 即 thread_id；续写时追加消息用新 id，thread_id 沿用首条。
	var threadID, messageID uuid.UUID
	if found {
		threadID = thread.ID
		messageID = uuid.New()
	} else {
		threadID = uuid.New()
		messageID = threadID
	}
	if err := s.repository.AppendCaptainMessage(ctx, ports.CaptainMessage{
		ID: messageID, MatchID: matchID, TeamID: *match.HostTeamID,
		ThreadOwnerUserID: actor.ID, SenderUserID: actor.ID, Content: trimmed,
	}); err != nil {
		return uuid.Nil, sharederror.Wrap(sharederror.KindInternal, "保存留言失败", err)
	}

	return threadID, nil
}

// Reply 在既有对话串内追加一条：发送者必须是串发起人或主队队长/领队。
func (s *CaptainMessageService) Reply(ctx context.Context, actor sharedauth.Actor, threadID uuid.UUID, content string) (uuid.UUID, error) {
	if !actor.IsUser() {
		return uuid.Nil, sharederror.ErrForbidden
	}
	trimmed, err := domain.NewCaptainMessageContent(content)
	if err != nil {
		return uuid.Nil, err
	}
	head, found, err := s.repository.FindCaptainThreadHead(ctx, threadID)
	if err != nil {
		return uuid.Nil, sharederror.Wrap(sharederror.KindInternal, "查询留言对话失败", err)
	}
	if !found {
		return uuid.Nil, sharederror.New(sharederror.KindNotFound, "留言对话不存在")
	}
	isOwner := head.ThreadOwnerUserID == actor.ID
	if !isOwner {
		if err := s.authorizer.EnsureManager(ctx, head.TeamID, actor.ID); err != nil {
			return uuid.Nil, sharederror.ErrForbidden
		}
	}
	if err := s.repository.AppendCaptainMessage(ctx, ports.CaptainMessage{
		ID: uuid.New(), MatchID: head.MatchID, TeamID: head.TeamID,
		ThreadOwnerUserID: head.ThreadOwnerUserID, SenderUserID: actor.ID, Content: trimmed,
	}); err != nil {
		return uuid.Nil, sharederror.Wrap(sharederror.KindInternal, "保存留言失败", err)
	}

	return threadID, nil
}

// ListThreads 返回我的对话列表：我发起的串 ∪ 我任队长/领队球队收到的串。
func (s *CaptainMessageService) ListThreads(ctx context.Context, actor sharedauth.Actor, query CaptainMessageListQuery) (CaptainMessageListResult, error) {
	if !actor.IsUser() {
		return CaptainMessageListResult{}, sharederror.ErrForbidden
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = defaultCaptainThreadPageSize
	}
	if query.PageSize > maxCaptainThreadPageSize {
		query.PageSize = maxCaptainThreadPageSize
	}
	items, err := s.repository.ListMyCaptainMessageThreads(ctx, actor.ID, query.PageSize, (query.Page-1)*query.PageSize)
	if err != nil {
		return CaptainMessageListResult{}, sharederror.Wrap(sharederror.KindInternal, "查询留言列表失败", err)
	}
	total, err := s.repository.CountMyCaptainMessageThreads(ctx, actor.ID)
	if err != nil {
		return CaptainMessageListResult{}, sharederror.Wrap(sharederror.KindInternal, "统计留言失败", err)
	}
	return CaptainMessageListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

// GetThread 返回串内全部消息；仅串发起人与主队队长/领队可见。
func (s *CaptainMessageService) GetThread(ctx context.Context, actor sharedauth.Actor, threadID uuid.UUID) (CaptainMessageThreadDetail, error) {
	if !actor.IsUser() {
		return CaptainMessageThreadDetail{}, sharederror.ErrForbidden
	}
	head, found, err := s.repository.FindCaptainThreadHead(ctx, threadID)
	if err != nil {
		return CaptainMessageThreadDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询留言对话失败", err)
	}
	if !found {
		return CaptainMessageThreadDetail{}, sharederror.New(sharederror.KindNotFound, "留言对话不存在")
	}
	isOwner := head.ThreadOwnerUserID == actor.ID
	if !isOwner {
		if err := s.authorizer.EnsureManager(ctx, head.TeamID, actor.ID); err != nil {
			return CaptainMessageThreadDetail{}, sharederror.ErrForbidden
		}
	}
	messages, err := s.repository.ListCaptainMessagesByThread(ctx, head.MatchID, head.ThreadOwnerUserID)
	if err != nil {
		return CaptainMessageThreadDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询留言消息失败", err)
	}
	// 打开对话即视为读到最新：推进阅读进度（只前进不回退），未读数随之清零。
	if len(messages) > 0 {
		if err := s.repository.MarkCaptainThreadRead(ctx, threadID, actor.ID, messages[len(messages)-1].CreatedAt); err != nil {
			log.Printf("captainmessage: 记录阅读进度失败 thread=%s user=%d: %v", threadID, actor.ID, err)
		}
	}
	return CaptainMessageThreadDetail{Thread: head, Messages: messages, ViewerIsManager: !isOwner}, nil
}

// UnreadCount 返回我的留言未读总数（对方发送且尚未读到的消息）。
func (s *CaptainMessageService) UnreadCount(ctx context.Context, actor sharedauth.Actor) (int64, error) {
	if !actor.IsUser() {
		return 0, sharederror.ErrForbidden
	}
	return s.repository.CountMyUnreadCaptainMessages(ctx, actor.ID)
}
