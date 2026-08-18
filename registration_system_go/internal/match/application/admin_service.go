package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	defaultMatchPageSize = 20
	maxMatchPageSize     = 100
)

type AdminMatchService struct {
	repository  ports.Repository
	clock       ports.Clock
	adminAccess ports.AdminAccess
}

type AdminMatchListQuery struct {
	Status   *domain.MatchStatus
	Search   string
	Page     int
	PageSize int
}

type AdminMatchListResult struct {
	Items    []ports.AdminMatchItem
	Total    int64
	Page     int
	PageSize int
}

type AdminMatchDetail struct {
	Item    ports.AdminMatchItem
	Groups  []domain.RegistrationGroup
	Rosters []AdminGroupRoster
}

type OptionalTimestamp struct {
	Set   bool
	Value *time.Time
}

type UpdateMatchCommand struct {
	Name                string
	StartTime           time.Time
	EndTime             time.Time
	RegistrationStartAt OptionalTimestamp
	RegistrationEndAt   OptionalTimestamp
	Location            string
	LocationLatitude    *float64
	LocationLongitude   *float64
	Description         *string
	// OpponentName 非 nil 时更新手工对手名称（空串清除）；nil 表示不改。
	OpponentName *string
	// HostColor/AwayColor 非 nil 时更新球服颜色（空串清除）；nil 表示不改。
	HostColor *string
	AwayColor *string
	// HostCapacityLimit 非 nil 时同步把主队报名组的满员上限改为该值；
	// nil 表示本次编辑不改容量（区别于创建时的缺省兜底）。
	HostCapacityLimit *int
}

// AdminGroupRoster 是某个报名组的队员报名花名册，与 Groups 按同一顺序对齐。
type AdminGroupRoster struct {
	GroupID uuid.UUID
	Entries []ports.AdminRosterEntry
}

func NewAdminMatchService(repository ports.Repository, clock ports.Clock, adminAccess ports.AdminAccess) AdminMatchService {
	return AdminMatchService{repository: repository, clock: clock, adminAccess: adminAccess}
}

func (s AdminMatchService) List(ctx context.Context, actor sharedauth.Actor, query AdminMatchListQuery) (AdminMatchListResult, error) {
	if !actor.IsAdmin() {
		return AdminMatchListResult{}, sharederror.ErrForbidden
	}
	if query.Status != nil && !validMatchStatus(*query.Status) {
		return AdminMatchListResult{}, sharederror.New(sharederror.KindValidation, "比赛状态筛选无效")
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = defaultMatchPageSize
	}
	if query.PageSize > maxMatchPageSize {
		query.PageSize = maxMatchPageSize
	}
	filter := ports.AdminMatchFilter{
		Status: query.Status, Search: strings.TrimSpace(query.Search),
		Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize,
	}
	items, err := s.repository.ListForAdmin(ctx, filter)
	if err != nil {
		return AdminMatchListResult{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛列表失败", err)
	}
	total, err := s.repository.CountForAdmin(ctx, filter)
	if err != nil {
		return AdminMatchListResult{}, sharederror.Wrap(sharederror.KindInternal, "统计比赛失败", err)
	}
	return AdminMatchListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

func (s AdminMatchService) Get(ctx context.Context, actor sharedauth.Actor, id uuid.UUID) (AdminMatchDetail, error) {
	if !actor.IsAdmin() {
		return AdminMatchDetail{}, sharederror.ErrForbidden
	}
	item, groups, found, err := s.repository.FindForAdmin(ctx, id)
	if err != nil {
		return AdminMatchDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛详情失败", err)
	}
	if !found {
		return AdminMatchDetail{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	rosters := make([]AdminGroupRoster, 0, len(groups))
	for _, group := range groups {
		entries, err := s.repository.ListRosterForGroup(ctx, group)
		if err != nil {
			return AdminMatchDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询报名花名册失败", err)
		}
		rosters = append(rosters, AdminGroupRoster{GroupID: group.ID, Entries: entries})
	}
	return AdminMatchDetail{Item: item, Groups: groups, Rosters: rosters}, nil
}

func (s AdminMatchService) UpdateDetails(ctx context.Context, actor sharedauth.Actor, id uuid.UUID, command UpdateMatchCommand) (domain.Match, error) {
	if !actor.IsAdmin() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	match, groups, found, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if err := match.UpdateDetails(domain.UpdateMatchDetails{
		Name: command.Name, StartTime: command.StartTime, EndTime: command.EndTime,
		RegistrationStartAt: resolveOptionalTimestamp(command.RegistrationStartAt, match.RegistrationStartAt),
		RegistrationEndAt:   resolveOptionalTimestamp(command.RegistrationEndAt, match.RegistrationEndAt),
		Location:            command.Location, LocationLatitude: command.LocationLatitude,
		LocationLongitude: command.LocationLongitude, Description: command.Description,
		OpponentName: command.OpponentName,
		HostColor:    command.HostColor,
		AwayColor:    command.AwayColor,
	}, s.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	var hostGroup *domain.RegistrationGroup
	if command.HostCapacityLimit != nil {
		hostGroup = findHostGroup(groups)
		if hostGroup == nil {
			return domain.Match{}, sharederror.New(sharederror.KindInternal, "主队报名组不存在")
		}
		if err := hostGroup.UpdateHostCapacity(*command.HostCapacityLimit, s.clock.Now()); err != nil {
			return domain.Match{}, err
		}
	}
	if err := s.repository.UpdateDetails(ctx, match, hostGroup); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛失败", err)
	}
	return match, nil
}

func findHostGroup(groups []domain.RegistrationGroup) *domain.RegistrationGroup {
	for index := range groups {
		if groups[index].Kind == domain.GroupHostTeam {
			return &groups[index]
		}
	}
	return nil
}

func resolveOptionalTimestamp(update OptionalTimestamp, current *time.Time) *time.Time {
	if update.Set {
		return update.Value
	}
	return current
}

func (s AdminMatchService) ChangeStatus(ctx context.Context, actor sharedauth.Actor, id uuid.UUID, status domain.MatchStatus) (domain.Match, error) {
	if !actor.IsAdmin() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	if !validMatchStatus(status) {
		return domain.Match{}, sharederror.New(sharederror.KindValidation, "比赛状态无效")
	}
	match, _, found, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if err := match.ChangeStatus(status, s.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	if err := s.repository.UpdateStatus(ctx, match); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛状态失败", err)
	}
	return match, nil
}

func (s AdminMatchService) Delete(ctx context.Context, actor sharedauth.Actor, id uuid.UUID) error {
	if err := s.adminAccess.EnsureSuperAdmin(ctx, actor); err != nil {
		return err
	}
	deleted, err := s.repository.Delete(ctx, id)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "删除比赛失败", err)
	}
	if !deleted {
		return sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	return nil
}

func validMatchStatus(status domain.MatchStatus) bool {
	switch status {
	case domain.MatchRegistering, domain.MatchOngoing, domain.MatchEnded, domain.MatchCancelled:
		return true
	default:
		return false
	}
}
