package application

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	defaultAdminPageSize = 20
	maxAdminPageSize     = 100
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
		query.PageSize = defaultAdminPageSize
	}
	if query.PageSize > maxAdminPageSize {
		query.PageSize = maxAdminPageSize
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

func (s AdminMatchService) UpdateDetails(ctx context.Context, actor sharedauth.Actor, id uuid.UUID, input domain.UpdateMatchDetails) (domain.Match, error) {
	if !actor.IsAdmin() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	match, _, found, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if err := match.UpdateDetails(input, s.clock.Now()); err != nil {
		return domain.Match{}, err
	}
	if err := s.repository.UpdateDetails(ctx, match); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛失败", err)
	}
	return match, nil
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
