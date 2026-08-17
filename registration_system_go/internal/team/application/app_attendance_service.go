package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

// AppAttendanceService 提供球队比赛出勤查询：
// 逐队员出勤明细限队长/领队；全队摘要（我的记录 + 排名）对全体队员开放。
type AppAttendanceService struct {
	repository ports.AttendanceQueryRepository
	access     TeamAccessQueries
}

// TeamAccessQueries 是出勤服务需要的球队身份校验，由 QueryService 实现。
type TeamAccessQueries interface {
	EnsureManager(context.Context, int64, int64) error
	EnsureActiveMember(context.Context, int64, int64) error
	EnsureMember(context.Context, int64, int64) error
}

type AttendanceSummary struct {
	MyRecords []ports.AttendanceRecord
	Ranking   []ports.AttendanceRankingItem
}

// AttendanceQueryRecord / AttendanceQueryRankingItem 暴露给 http 层的出勤行类型。
type AttendanceQueryRecord = ports.AttendanceRecord
type AttendanceQueryRankingItem = ports.AttendanceRankingItem
type AttendanceQueryHeader = ports.MatchAttendanceHeader
type AttendanceQueryMember = ports.MatchAttendanceMember

func NewAppAttendanceService(repository ports.AttendanceQueryRepository, access TeamAccessQueries) AppAttendanceService {
	return AppAttendanceService{repository: repository, access: access}
}

func (s AppAttendanceService) MemberRecords(ctx context.Context, actor sharedauth.Actor, teamID, userID int64, startDate, endDate *time.Time) ([]ports.AttendanceRecord, error) {
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	if err := s.access.EnsureManager(ctx, teamID, actor.ID); err != nil {
		return nil, err
	}
	// 目标只要是本队成员即可（含离队成员）：管理页成员列表包含 inactive，
	// 离队成员的历史出勤也应该能查。
	if err := s.access.EnsureMember(ctx, teamID, userID); err != nil {
		return nil, sharederror.New(sharederror.KindNotFound, "该用户不是球队成员")
	}
	records, err := s.repository.ListMemberAttendanceRecords(ctx, teamID, userID, startDate, endDate)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询队员出勤失败", err)
	}
	return records, nil
}

func (s AppAttendanceService) Summary(ctx context.Context, actor sharedauth.Actor, teamID int64, startDate, endDate *time.Time) (AttendanceSummary, error) {
	if !actor.IsUser() {
		return AttendanceSummary{}, sharederror.ErrForbidden
	}
	if err := s.access.EnsureActiveMember(ctx, teamID, actor.ID); err != nil {
		return AttendanceSummary{}, err
	}
	myRecords, err := s.repository.ListMemberAttendanceRecords(ctx, teamID, actor.ID, startDate, endDate)
	if err != nil {
		return AttendanceSummary{}, sharederror.Wrap(sharederror.KindInternal, "查询出勤记录失败", err)
	}
	ranking, err := s.repository.ListAttendanceRanking(ctx, teamID, startDate, endDate)
	if err != nil {
		return AttendanceSummary{}, sharederror.Wrap(sharederror.KindInternal, "查询出勤排名失败", err)
	}
	return AttendanceSummary{MyRecords: myRecords, Ranking: ranking}, nil
}

// MatchAttendance 返回单场比赛的全队出勤明细，供管理端展开某场比赛时按需加载。
func (s AppAttendanceService) MatchAttendance(ctx context.Context, actor sharedauth.Actor, teamID int64, matchID uuid.UUID) (ports.MatchAttendanceHeader, []ports.MatchAttendanceMember, error) {
	if !actor.IsUser() {
		return ports.MatchAttendanceHeader{}, nil, sharederror.ErrForbidden
	}
	if err := s.access.EnsureManager(ctx, teamID, actor.ID); err != nil {
		return ports.MatchAttendanceHeader{}, nil, err
	}
	header, members, found, err := s.repository.ListMatchAttendance(ctx, teamID, matchID)
	if err != nil {
		return ports.MatchAttendanceHeader{}, nil, sharederror.Wrap(sharederror.KindInternal, "查询比赛出勤失败", err)
	}
	if !found {
		return ports.MatchAttendanceHeader{}, nil, sharederror.New(sharederror.KindNotFound, "比赛不存在或不在出勤统计范围")
	}
	return header, members, nil
}
