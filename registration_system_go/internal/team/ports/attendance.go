package ports

import (
	"context"
	"time"
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
}
