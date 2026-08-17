package teamhttp

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedhttpapi "github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/httpapi"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type AppTeamQueries interface {
	GetTeam(context.Context, sharedauth.Actor, int64) (application.AppTeamDetail, error)
	ListMembers(context.Context, sharedauth.Actor, int64) ([]application.AppTeamMember, error)
}

type AppHandler struct {
	queries    AppTeamQueries
	attendance AppAttendanceQueries
}

type AppTeamDetailResponse struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Description *string           `json:"description"`
	LogoURL     *string           `json:"logo_url"`
	CaptainID   *int64            `json:"captain_id"`
	Status      domain.TeamStatus `json:"status"`
	MyRole      domain.Role       `json:"my_role"`
}

type AppTeamMemberResponse struct {
	UserID    int64               `json:"user_id"`
	Nickname  string              `json:"nickname"`
	AvatarURL *string             `json:"avatar_url"`
	RealName  *string             `json:"real_name"`
	Role      domain.Role         `json:"role"`
	Status    domain.MemberStatus `json:"status"`
	JoinedAt  time.Time           `json:"joined_at"`
}

func NewAppHandler(queries AppTeamQueries, attendance AppAttendanceQueries) *AppHandler {
	return &AppHandler{queries: queries, attendance: attendance}
}

func (h *AppHandler) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/teams/:id", h.GetTeam)
	group.GET("/teams/:id/members", h.ListMembers)
	group.GET("/teams/:id/members/:user_id/attendance", h.MemberAttendance)
	group.GET("/teams/:id/attendance-summary", h.AttendanceSummary)
}

func (h *AppHandler) GetTeam(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	detail, err := h.queries.GetTeam(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	team := detail.Team
	sharedhttpapi.WriteSuccess(c, AppTeamDetailResponse{
		ID: team.ID, Name: team.Name, Description: team.Description, LogoURL: team.LogoURL,
		CaptainID: team.CaptainID, Status: team.Status, MyRole: detail.MyRole,
	})
}

func (h *AppHandler) ListMembers(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	items, err := h.queries.ListMembers(c.Request.Context(), actor, teamID)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	response := make([]AppTeamMemberResponse, 0, len(items))
	for _, item := range items {
		response = append(response, AppTeamMemberResponse{
			UserID: item.UserID, Nickname: item.Nickname, AvatarURL: item.AvatarURL,
			RealName: item.RealName, Role: item.Role, Status: item.Status, JoinedAt: item.JoinedAt,
		})
	}
	sharedhttpapi.WriteSuccess(c, response)
}

func appActorAndTeamID(c *gin.Context) (sharedauth.Actor, int64, bool) {
	actor, ok := authhttp.ActorFromContext(c)
	if !ok {
		sharedhttpapi.WriteError(c, sharederror.ErrUnauthorized)
		return sharedauth.Actor{}, 0, false
	}
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "球队 ID 无效"))
		return sharedauth.Actor{}, 0, false
	}
	return actor, teamID, true
}

type AppAttendanceQueries interface {
	MemberRecords(context.Context, sharedauth.Actor, int64, int64, *time.Time, *time.Time) ([]application.AttendanceQueryRecord, error)
	Summary(context.Context, sharedauth.Actor, int64, *time.Time, *time.Time) (application.AttendanceSummary, error)
}

type AppAttendanceRecordResponse struct {
	ActivityID        string     `json:"activity_id"`
	ActivityName      string     `json:"activity_name"`
	HoldingDate       time.Time  `json:"holding_date"`
	Location          string     `json:"location"`
	Stand             int        `json:"stand"`
	RegistrationCount int        `json:"registration_count"`
	OperationTime     *time.Time `json:"operation_time"`
	Registered        bool       `json:"registered"`
}

type AppAttendanceRankingItemResponse struct {
	UserID            int64   `json:"user_id"`
	UserName          string  `json:"user_name"`
	AvatarURL         *string `json:"avatar_url"`
	TotalCount        int64   `json:"total_count"`
	AttendedCount     int64   `json:"attended_count"`
	LeaveCount        int64   `json:"leave_count"`
	LateCount         int64   `json:"late_count"`
	UnregisteredCount int64   `json:"unregistered_count"`
}

type AppAttendanceSummaryResponse struct {
	MyRecords []AppAttendanceRecordResponse      `json:"my_records"`
	Ranking   []AppAttendanceRankingItemResponse `json:"ranking"`
}

type AppMemberAttendanceResponse struct {
	Records []AppAttendanceRecordResponse `json:"records"`
}

// attendanceStand 把 Go 报名状态映射回旧端的 stand 数字：1 参加、2 请假、3 缺席、0 未表态。
func attendanceStand(status string) int {
	switch status {
	case "attending":
		return 1
	case "leave":
		return 2
	case "absent":
		return 3
	default:
		return 0
	}
}

func mapAttendanceRecords(records []application.AttendanceQueryRecord) []AppAttendanceRecordResponse {
	items := make([]AppAttendanceRecordResponse, 0, len(records))
	for _, record := range records {
		items = append(items, AppAttendanceRecordResponse{
			ActivityID: record.ActivityID, ActivityName: record.ActivityName,
			HoldingDate: record.HoldingDate, Location: record.Location,
			Stand: attendanceStand(record.Stand), RegistrationCount: record.RegistrationCount,
			OperationTime: record.OperationTime, Registered: record.Registered,
		})
	}
	return items
}

func (h *AppHandler) MemberAttendance(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, "用户 ID 无效"))
		return
	}
	startDate, endDate, ok := parseAttendanceDateRange(c)
	if !ok {
		return
	}
	records, err := h.attendance.MemberRecords(c.Request.Context(), actor, teamID, userID, startDate, endDate)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	sharedhttpapi.WriteSuccess(c, AppMemberAttendanceResponse{Records: mapAttendanceRecords(records)})
}

func (h *AppHandler) AttendanceSummary(c *gin.Context) {
	actor, teamID, ok := appActorAndTeamID(c)
	if !ok {
		return
	}
	startDate, endDate, ok := parseAttendanceDateRange(c)
	if !ok {
		return
	}
	summary, err := h.attendance.Summary(c.Request.Context(), actor, teamID, startDate, endDate)
	if err != nil {
		sharedhttpapi.WriteError(c, err)
		return
	}
	ranking := make([]AppAttendanceRankingItemResponse, 0, len(summary.Ranking))
	for _, item := range summary.Ranking {
		ranking = append(ranking, AppAttendanceRankingItemResponse{
			UserID: item.UserID, UserName: item.UserName, AvatarURL: item.AvatarURL,
			TotalCount: item.TotalCount, AttendedCount: item.AttendedCount,
			LeaveCount: item.LeaveCount, LateCount: item.LateCount,
			UnregisteredCount: item.UnregisteredCount,
		})
	}
	sharedhttpapi.WriteSuccess(c, AppAttendanceSummaryResponse{
		MyRecords: mapAttendanceRecords(summary.MyRecords), Ranking: ranking,
	})
}

// parseAttendanceDateRange 解析小程序传入的 startDate / endDate（YYYY-MM-DD）。
func parseAttendanceDateRange(c *gin.Context) (*time.Time, *time.Time, bool) {
	parse := func(raw string, label string) (*time.Time, bool) {
		if raw == "" {
			return nil, true
		}
		value, err := time.Parse("2006-01-02", raw)
		if err != nil {
			sharedhttpapi.WriteError(c, sharederror.New(sharederror.KindValidation, label+"格式无效，应为 YYYY-MM-DD"))
			return nil, false
		}
		return &value, true
	}
	startDate, ok := parse(c.Query("startDate"), "startDate")
	if !ok {
		return nil, nil, false
	}
	endDate, ok := parse(c.Query("endDate"), "endDate")
	if !ok {
		return nil, nil, false
	}
	return startDate, endDate, true
}
