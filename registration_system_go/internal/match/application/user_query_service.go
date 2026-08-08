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

type UserMatchQueryService struct {
	repository ports.UserMatchRepository
}

type UserMatchListQuery struct {
	Scope    MatchScope
	Status   *domain.MatchStatus
	Search   string
	Page     int
	PageSize int
}

type MatchScope = ports.MatchScope

const (
	MatchScopeAll  = ports.MatchScopeAll
	MatchScopeMine = ports.MatchScopeMine
)

type UserMatchListResult struct {
	Items    []ports.MatchItem
	Total    int64
	Page     int
	PageSize int
}

type UserMatchDetail struct {
	Item   ports.MatchItem
	Groups []ports.UserGroupState
}

type UserMatchHomeResult struct {
	ActionItems  []ports.HomeMatchItem
	EndedItems   []ports.MatchItem
	EndedHasMore bool
}

const (
	homeActionLimit = 3
	homeEndedLimit  = 6
)

func NewUserMatchQueryService(repository ports.UserMatchRepository) UserMatchQueryService {
	return UserMatchQueryService{repository: repository}
}

func (s UserMatchQueryService) List(ctx context.Context, actor sharedauth.Actor, query UserMatchListQuery) (UserMatchListResult, error) {
	if !actor.IsUser() {
		return UserMatchListResult{}, sharederror.ErrForbidden
	}
	if query.Status != nil && !validMatchStatus(*query.Status) {
		return UserMatchListResult{}, sharederror.New(sharederror.KindValidation, "比赛状态筛选无效")
	}
	if query.Scope == "" {
		query.Scope = MatchScopeAll
	}
	if query.Scope != MatchScopeAll && query.Scope != MatchScopeMine {
		return UserMatchListResult{}, sharederror.New(sharederror.KindValidation, "比赛范围筛选无效")
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
	filter := ports.MatchListFilter{
		Scope: query.Scope, UserID: actor.ID, Status: query.Status, Search: strings.TrimSpace(query.Search),
		Limit: query.PageSize, Offset: (query.Page - 1) * query.PageSize,
	}
	items, err := s.repository.ListForUser(ctx, filter)
	if err != nil {
		return UserMatchListResult{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛列表失败", err)
	}
	total, err := s.repository.CountForUser(ctx, filter)
	if err != nil {
		return UserMatchListResult{}, sharederror.Wrap(sharederror.KindInternal, "统计比赛失败", err)
	}
	return UserMatchListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

func (s UserMatchQueryService) Get(ctx context.Context, actor sharedauth.Actor, id uuid.UUID) (UserMatchDetail, error) {
	if !actor.IsUser() {
		return UserMatchDetail{}, sharederror.ErrForbidden
	}
	item, groups, found, err := s.repository.FindForUser(ctx, id, actor.ID)
	if err != nil {
		return UserMatchDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛详情失败", err)
	}
	if !found {
		return UserMatchDetail{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	return UserMatchDetail{Item: item, Groups: groups}, nil
}

func (s UserMatchQueryService) Home(ctx context.Context, actor sharedauth.Actor) (UserMatchHomeResult, error) {
	if !actor.IsUser() {
		return UserMatchHomeResult{}, sharederror.ErrForbidden
	}
	actionItems, err := s.repository.ListHomeActionItems(ctx, actor.ID, homeActionLimit)
	if err != nil {
		return UserMatchHomeResult{}, sharederror.Wrap(sharederror.KindInternal, "查询待处理比赛失败", err)
	}
	endedItems, err := s.repository.ListHomeEndedItems(ctx, actor.ID, homeEndedLimit+1)
	if err != nil {
		return UserMatchHomeResult{}, sharederror.Wrap(sharederror.KindInternal, "查询已结束比赛失败", err)
	}
	hasMore := len(endedItems) > homeEndedLimit
	if hasMore {
		endedItems = endedItems[:homeEndedLimit]
	}
	return UserMatchHomeResult{ActionItems: actionItems, EndedItems: endedItems, EndedHasMore: hasMore}, nil
}
