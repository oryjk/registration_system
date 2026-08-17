package application

import (
	"context"
	"errors"
	"strings"

	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	defaultPageSize = 20
	maxPageSize     = 100
)

type Service struct {
	repository ports.Repository
	lister     ports.ListerRepository
	finder     ports.FinderRepository
	clock      ports.Clock
}

func NewService(repository ports.Repository, lister ports.ListerRepository, finder ports.FinderRepository, clock ports.Clock) *Service {
	return &Service{repository: repository, lister: lister, finder: finder, clock: clock}
}

// AllocateCommand 生产构建登记版本号：CurrentVersion 是 manifest 当前值（自动分配的种子），
// ExplicitVersion 非空时（CI 显式指定）直接以该版本登记。
type AllocateCommand struct {
	ProjectCode     string
	CurrentVersion  string
	ExplicitVersion string
}

// Allocate 决定本次构建使用的版本并确保它处于审核中，幂等：重复构建复用同一审核版本。
func (s *Service) Allocate(ctx context.Context, command AllocateCommand) (domain.MiniReviewStatus, error) {
	projectCode := strings.TrimSpace(command.ProjectCode)
	if projectCode == "" {
		return domain.MiniReviewStatus{}, sharederror.New(sharederror.KindValidation, "项目编码不能为空")
	}

	if explicit := strings.TrimSpace(command.ExplicitVersion); explicit != "" {
		return s.allocateExplicit(ctx, projectCode, explicit)
	}

	seed, err := domain.ParseVersion(command.CurrentVersion)
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.New(sharederror.KindValidation, "缺少用于分配版本号的当前版本")
	}
	latest, err := s.repository.FindLatest(ctx, projectCode)
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询最新版本失败", err)
	}
	next := domain.DecideNextVersion(domain.AllocationInput{Latest: latest, Seed: seed})
	if latest != nil && latest.IsReviewing && latest.Version == next.String() {
		return *latest, nil
	}
	created, err := s.repository.Create(ctx, domain.NewReviewingStatus(projectCode, next, s.clock.Now()))
	if errors.Is(err, ports.ErrVersionConflict) {
		// 并发构建撞唯一约束：以先落库的记录为准，保证幂等。
		existing, findErr := s.repository.FindByProjectAndVersion(ctx, projectCode, next.String())
		if findErr != nil {
			return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询并发登记的版本失败", findErr)
		}
		return *existing, nil
	}
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "登记审核版本失败", err)
	}
	return created, nil
}

func (s *Service) allocateExplicit(ctx context.Context, projectCode, rawVersion string) (domain.MiniReviewStatus, error) {
	version, err := domain.ParseVersion(rawVersion)
	if err != nil {
		return domain.MiniReviewStatus{}, err
	}
	existing, err := s.repository.FindByProjectAndVersion(ctx, projectCode, version.String())
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询审核版本失败", err)
	}
	if existing != nil {
		if existing.IsReviewing {
			return *existing, nil
		}
		// 已过审的版本被再次显式构建：视为重新提审。
		existing.RestartReviewing(s.clock.Now())
		updated, updateErr := s.repository.UpdateStatus(ctx, *existing)
		if updateErr != nil {
			return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "重新打开审核失败", updateErr)
		}
		return updated, nil
	}
	created, err := s.repository.Create(ctx, domain.NewReviewingStatus(projectCode, version, s.clock.Now()))
	if errors.Is(err, ports.ErrVersionConflict) {
		raced, findErr := s.repository.FindByProjectAndVersion(ctx, projectCode, version.String())
		if findErr != nil {
			return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询并发登记的版本失败", findErr)
		}
		return *raced, nil
	}
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "登记审核版本失败", err)
	}
	return created, nil
}

// GetReviewStatus 小程序运行时查询；未登记的版本视为不在审核（已过审或从未提审）。
func (s *Service) GetReviewStatus(ctx context.Context, projectCode, rawVersion string) (domain.MiniReviewStatus, error) {
	projectCode = strings.TrimSpace(projectCode)
	version, err := domain.ParseVersion(rawVersion)
	if err != nil || projectCode == "" {
		return domain.MiniReviewStatus{}, sharederror.New(sharederror.KindValidation, "项目编码或版本号无效")
	}
	existing, err := s.repository.FindByProjectAndVersion(ctx, projectCode, version.String())
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询审核状态失败", err)
	}
	if existing != nil {
		return *existing, nil
	}
	return domain.MiniReviewStatus{
		ProjectCode: projectCode,
		Version:     version.String(),
		VersionCode: version.Code(),
		IsReviewing: false,
		StatusText:  "未登记版本",
	}, nil
}

type StatusListQuery struct {
	ProjectCode string
	Page        int
	PageSize    int
}

type StatusListResult struct {
	Items    []domain.MiniReviewStatus
	Total    int64
	Page     int
	PageSize int
}

func (s *Service) List(ctx context.Context, actor sharedauth.Actor, query StatusListQuery) (StatusListResult, error) {
	if !actor.IsAdmin() {
		return StatusListResult{}, sharederror.ErrForbidden
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 {
		query.PageSize = defaultPageSize
	}
	if query.PageSize > maxPageSize {
		query.PageSize = maxPageSize
	}
	items, total, err := s.lister.List(ctx, ports.StatusFilter{
		ProjectCode: strings.TrimSpace(query.ProjectCode),
		Limit:       query.PageSize, Offset: (query.Page - 1) * query.PageSize,
	})
	if err != nil {
		return StatusListResult{}, sharederror.Wrap(sharederror.KindInternal, "查询审核版本列表失败", err)
	}
	return StatusListResult{Items: items, Total: total, Page: query.Page, PageSize: query.PageSize}, nil
}

type SetStatusCommand struct {
	ID          int64
	IsReviewing bool
	StatusText  string
}

func (s *Service) SetStatus(ctx context.Context, actor sharedauth.Actor, command SetStatusCommand) (domain.MiniReviewStatus, error) {
	if !actor.IsAdmin() {
		return domain.MiniReviewStatus{}, sharederror.ErrForbidden
	}
	if command.ID <= 0 {
		return domain.MiniReviewStatus{}, sharederror.New(sharederror.KindValidation, "审核版本 ID 无效")
	}
	existing, err := s.finder.FindByID(ctx, command.ID)
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "查询审核版本失败", err)
	}
	if existing == nil {
		return domain.MiniReviewStatus{}, sharederror.New(sharederror.KindNotFound, "审核版本不存在")
	}
	if err := existing.SetStatus(command.IsReviewing, command.StatusText, s.clock.Now()); err != nil {
		return domain.MiniReviewStatus{}, err
	}
	updated, err := s.repository.UpdateStatus(ctx, *existing)
	if err != nil {
		return domain.MiniReviewStatus{}, sharederror.Wrap(sharederror.KindInternal, "更新审核状态失败", err)
	}
	return updated, nil
}
