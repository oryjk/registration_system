package ports

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// AttendanceRecord 是一场已结束比赛中某队员的出勤行：未报名也保留一行
// （Stand=unknown、Registered=false），与旧后端的成员出勤语义一致。
type AttendanceRecord struct {
	ActivityID        string
	ActivityName      string
	HoldingDate       time.Time
	Location          string
	Stand             string // attending / leave / absent / unknown
	RegistrationCount int
	OperationTime     *time.Time
	Registered        bool
}

type AttendanceRankingItem struct {
	UserID            int64
	UserName          string
	AvatarURL         *string
	TotalCount        int64
	AttendedCount     int64
	LeaveCount        int64
	LateCount         int64
	UnregisteredCount int64
}

type AttendanceQueryRepository interface {
	ListMemberAttendanceRecords(ctx context.Context, teamID, userID int64, startDate, endDate *time.Time) ([]AttendanceRecord, error)
	ListAttendanceRanking(ctx context.Context, teamID int64, startDate, endDate *time.Time) ([]AttendanceRankingItem, error)
	// ListMatchAttendance 返回单场比赛的全队出勤；found=false 表示比赛不属于该队或不在出勤统计范围。
	ListMatchAttendance(ctx context.Context, teamID int64, matchID uuid.UUID) (MatchAttendanceHeader, []MatchAttendanceMember, bool, error)
}

// MatchAttendanceHeader 是单场出勤的比赛信息头。
type MatchAttendanceHeader struct {
	ActivityID   string
	ActivityName string
	HoldingDate  time.Time
	Location     string
}

// MatchAttendanceMember 是单场比赛中一名成员的出勤行。
type MatchAttendanceMember struct {
	UserID            int64
	Nickname          string
	AvatarURL         *string
	Stand             string
	RegistrationCount int
	OperationTime     *time.Time
	Registered        bool
}
