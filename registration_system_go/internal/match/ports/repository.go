package ports

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Repository interface {
	CreateWithGroups(context.Context, domain.Match, []domain.RegistrationGroup) error
	CreateRegistration(context.Context, domain.Registration) error
	FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
	FindForAdmin(context.Context, uuid.UUID) (AdminMatchItem, []domain.RegistrationGroup, bool, error)
	ListForAdmin(context.Context, AdminMatchFilter) ([]AdminMatchItem, error)
	CountForAdmin(context.Context, AdminMatchFilter) (int64, error)
	ListRosterForGroup(context.Context, domain.RegistrationGroup) ([]AdminRosterEntry, error)
	// UpdateDetails 更新比赛基础信息；hostGroup 非 nil 时在同一事务内
	// 一并更新该报名组的满员上限，保证两条写入要么同时生效要么同时回滚。
	UpdateDetails(context.Context, domain.Match, *domain.RegistrationGroup) error
	UpdateStatus(context.Context, domain.Match) error
	// FinishUpdateStatus 用户端收尾专用条件更新：仅当库内状态仍是非终态时写入，
	// 返回是否更新到行；false 表示并发收尾已被他人先行落终态。
	FinishUpdateStatus(context.Context, domain.Match) (bool, error)
	Delete(context.Context, uuid.UUID) (bool, error)
}

type MatchListFilter struct {
	Scope       MatchScope
	UserID      int64
	Status      *domain.MatchStatus
	Search      string
	StartsAfter *time.Time
	// EndsAfter 非空时只保留 end_time 晚于该时刻且未取消的比赛（「未结束」过滤）。
	EndsAfter *time.Time
	// HostTeamOnly 为 true 时只保留有主队的比赛（散人约球无主队，无法联系队长）。
	HostTeamOnly     *bool
	DateStart        *time.Time
	PublicationModes []domain.PublicationMode
	Limit            int
	Offset           int
}

type MatchScope string

const (
	MatchScopeAll    MatchScope = "all"
	MatchScopeMine   MatchScope = "mine"
	MatchScopeOthers MatchScope = "others"
)

type AdminMatchFilter = MatchListFilter

type MatchItem struct {
	Match              domain.Match
	HostTeamName       string
	AwayTeamName       *string
	RegistrationGroups []RegistrationGroupSummary
	// Participants 目前只在首页已结束比赛场景填充：
	// 合并该比赛全部报名组后，按报名先后返回全部 attending 报名者。
	Participants []UserParticipant
	// HostCaptain 主队队长资料；无主队或未设置队长时为 nil（详情场景填充）。
	HostCaptain *CaptainProfile
}

type AdminMatchItem = MatchItem

// RegistrationGroupSummary 是列表场景下报名组的进度摘要：
// 只带 kind、所属球队与人数规则，用于约队大厅等列表进度展示。
type RegistrationGroupSummary struct {
	MatchID        uuid.UUID
	Kind           domain.GroupKind
	TeamID         *int64
	MinPlayers     *int
	MaxPlayers     *int
	AttendingCount int
}

type UserGroupState struct {
	Group          domain.RegistrationGroup
	AttendingCount int
	MyRegistration *domain.Registration
	Participants   []UserParticipant
}

type UserParticipant struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
	Status    domain.RegistrationStatus
	// RegistrationCount 是该成员本次报名占用的人数；散人约球一人代多人时大于 1，其余恒为 1。
	RegistrationCount int
	// RegisteredAt 是该成员本次报名的落库时间；小程序端用它把已报名队员按报名先后排序。
	RegisteredAt *time.Time
}

type HomeMatchItem struct {
	Item  MatchItem
	Group UserGroupState
}

type UserMatchRepository interface {
	ListForUser(context.Context, MatchListFilter) ([]MatchItem, error)
	CountForUser(context.Context, MatchListFilter) (int64, error)
	FindForUser(context.Context, uuid.UUID, int64) (MatchItem, []UserGroupState, bool, error)
	ListHomeActionItems(context.Context, int64, int) ([]HomeMatchItem, error)
	ListHomeEndedItems(context.Context, int64, int) ([]MatchItem, error)
}

// CaptainProfile 是用户端展示用的球队队长资料。
type CaptainProfile struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
}

// CaptainMessage 是一条队长留言；串以 (MatchID, ThreadOwnerUserID) 标识，
// ThreadID 为串首条消息 id，作为对外 URL 标识。
type CaptainMessage struct {
	ID                uuid.UUID
	MatchID           uuid.UUID
	TeamID            int64
	ThreadOwnerUserID int64
	SenderUserID      int64
	Content           string
	CreatedAt         time.Time
	MatchName         string
	HostTeamName      string
	SenderNickname    string
	SenderAvatarURL   *string
	// SenderIsCaptainSide 发送方是否为队长/领队侧（非串发起人即队长侧）。
	SenderIsCaptainSide bool
}

// CaptainMessageThread 是消息中心「留言」列表中的一串对话摘要。
type CaptainMessageThread struct {
	ID                        uuid.UUID
	MatchID                   uuid.UUID
	TeamID                    int64
	ThreadOwnerUserID         int64
	MatchName                 string
	HostTeamName              string
	OwnerNickname             string
	OwnerAvatarURL            *string
	LatestContent             string
	LatestSenderIsCaptainSide bool
	LatestCreatedAt           time.Time
	// UnreadCount 串内对方发送且晚于我阅读进度的消息数。
	UnreadCount int64
}

// CaptainMessageRepository 承载「联系队长」留言的读写；
// 可见性与权限规则在 application 层，仓储只做数据装配。
type CaptainMessageRepository interface {
	AppendCaptainMessage(context.Context, CaptainMessage) error
	FindCaptainThreadHead(context.Context, uuid.UUID) (CaptainMessage, bool, error)
	FindCaptainThreadByOwner(context.Context, uuid.UUID, int64) (CaptainMessage, bool, error)
	ListCaptainMessagesByThread(context.Context, uuid.UUID, int64) ([]CaptainMessage, error)
	ListMyCaptainMessageThreads(context.Context, int64, int, int) ([]CaptainMessageThread, error)
	CountMyCaptainMessageThreads(context.Context, int64) (int64, error)
	CountMyUnreadCaptainMessages(context.Context, int64) (int64, error)
	MarkCaptainThreadRead(context.Context, uuid.UUID, int64, time.Time) error
	ListTeamManagerUserIDs(context.Context, int64) ([]int64, error)
	FindTeamCaptainProfile(context.Context, int64) (CaptainProfile, bool, error)
	FindUserBrief(context.Context, int64) (CaptainProfile, bool, error)
}

// AdminRosterEntry 是管理端报名组花名册中的一行：球队组包含全部成员
// （Status 为 nil 表示尚未报名），散人组只包含已有报名记录的用户。
type AdminRosterEntry struct {
	UserID     int64
	Nickname   string
	RealName   *string
	AvatarURL  *string
	MemberRole *string
	Status     *domain.RegistrationStatus
	// RegistrationCount 是该行报名占用的人数；散人约球一人代多人时大于 1，其余恒为 1。
	RegistrationCount int
	// Paid 报名费是否已支付（散人约球赛前支付场景）。
	Paid bool
	// RegisteredAt 为 nil 表示该成员尚未报名（球队组未报名成员）。
	RegisteredAt *time.Time
}
