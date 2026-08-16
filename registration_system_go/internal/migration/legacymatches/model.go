package legacymatches

import (
	"context"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

type LoadOptions struct {
	Mode                  mapping.Mode
	Since                 *time.Time
	TrackedMatchSourceIDs []string
}

type LegacyUser struct {
	SourceID    int64
	OpenID      string
	Nickname    string
	RealName    string
	AvatarURL   string
	PhoneNumber string
	Status      int
	UpdatedAt   time.Time
}

// LegacyMatch 是旧库里一场历史比赛（rs_activity）在导入边界的投影。
// 仅保留目标 Go Match 能承接的字段；cover/color 等装饰字段由脚本层统计警告。
type LegacyMatch struct {
	// SourceID 是旧库 rs_activity.id（CHAR(36)），仅用于源内排序与日志，不写入目标。
	SourceID string
	Name     string
	// Opposing 是旧库 opposing 文本：真实对手名、空串或“待定”等占位。
	Opposing string
	Status   int
	// PlayersPerTeam 是旧库 players_per_team。
	PlayersPerTeam int
	// HoldingDate 是旧库 holding_date：比赛开始时间（写入目标 matches.start_time）。
	// 旧库 start_time/end_time 是报名窗口，Go 新系统没有对应字段，导入时丢弃。
	HoldingDate time.Time
	Location    string
	Latitude    *float64
	Longitude   *float64
	Description *string
	// HostCapacityLimit 是旧库 team_capacity_limit：主队报名组满员上限（host 组 max_players）。
	HostCapacityLimit *int
	CreatedAt         time.Time
	UpdatedAt         time.Time
	HomeTeamSourceID  int64
}

// LegacyRegistration 是旧库一条报名记录（rs_user_activity）的投影。
// UserSourceID 是 Rust PostgreSQL 用户主键；OpenID 只用于首次唯一匹配。
type LegacyRegistration struct {
	ActivitySourceID  string
	UserSourceID      int64
	OpenID            string
	Stand             int
	RegistrationCount int
	OperationTime     time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// Snapshot 是只读源库加载结果，由 importer 消费。
type Snapshot struct {
	Matches       []LegacyMatch
	Users         []LegacyUser
	Registrations []LegacyRegistration
}

// Source 抽象只读源库，便于测试用 fakeSource 替换。
type Source interface {
	Load(context.Context, LoadOptions) (Snapshot, error)
}

// Report 汇总一次导入的写入与跳过情况，供命令行输出与对账。
type Report struct {
	UsersInserted               int
	UsersUpdated                int
	UsersSkipped                int
	UsersTargetModified         int
	MatchesInserted             int
	MatchesUpdated              int
	MatchesSkipped              int
	MatchesTargetModified       int
	RegistrationsInserted       int
	RegistrationsUpdated        int
	RegistrationsSkipped        int
	RegistrationsTargetModified int
	RegistrationsCancelled      int
	PendingTeamCreated          bool
	OrphanReferences            int
	Conflicts                   int
}

type RunOptions struct {
	DryRun           bool
	Mode             mapping.Mode
	Since            *time.Time
	ExplicitMappings mapping.Config
}
