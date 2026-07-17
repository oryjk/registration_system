package legacymatches

import (
	"context"
	"time"
)

// LegacyMatch 是旧库里一场历史比赛（rs_activity）在导入边界的投影。
// 仅保留目标 Go Match 能承接的字段，丢弃 cover/color/holding_date 等装饰字段。
type LegacyMatch struct {
	// SourceID 是旧库 rs_activity.id（CHAR(36)），仅用于源内排序与日志，不写入目标。
	SourceID string
	Name     string
	// Opposing 是旧库 opposing 文本：真实对手名、空串或“待定”等占位。
	Opposing         string
	Status           int
	PlayersPerTeam   int
	StartTime        time.Time
	EndTime          time.Time
	Location         string
	Latitude         *float64
	Longitude        *float64
	Description      *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
	HomeTeamSourceID int64
}

// LegacyRegistration 是旧库一条报名记录（rs_user_activity）的投影。
// OpenID 用于把旧用户映射到目标 users.id；Stand 用 0/1/2/3 表达，由 importer 翻译。
type LegacyRegistration struct {
	ActivitySourceID  string
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
	Registrations []LegacyRegistration
}

// Source 抽象只读源库，便于测试用 fakeSource 替换。
type Source interface {
	Load(context.Context) (Snapshot, error)
}

// Report 汇总一次导入的写入与跳过情况，供命令行输出与对账。
type Report struct {
	MatchesInserted       int
	MatchesUpdated        int
	RegistrationsInserted int
	RegistrationsUpdated  int
	PendingTeamCreated    bool
	// UnmappedOpenIDs 是报名引用但目标库 users 不存在的 openid 数量；
	// 大于 0 时 Run 在写入前中止并返回错误，由调用方定夺。
	UnmappedOpenIDs int
}
