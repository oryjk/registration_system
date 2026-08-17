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
	Scope            MatchScope
	UserID           int64
	Status           *domain.MatchStatus
	Search           string
	StartsAfter      *time.Time
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

// AdminRosterEntry 是管理端报名组花名册中的一行：球队组包含全部成员
// （Status 为 nil 表示尚未报名），散人组只包含已有报名记录的用户。
type AdminRosterEntry struct {
	UserID     int64
	Nickname   string
	RealName   *string
	AvatarURL  *string
	MemberRole *string
	Status     *domain.RegistrationStatus
}
