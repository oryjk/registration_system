package ports

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/minireview/domain"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// ErrVersionConflict 并发登记同一 (project_code, version) 撞唯一约束；
// application 层据此重读记录实现幂等分配。
var ErrVersionConflict = sharederror.New(sharederror.KindConflict, "版本号已被并发登记")

type Repository interface {
	// FindLatest 返回项目当前版本号最大的记录；项目还没有任何登记时返回 nil。
	FindLatest(ctx context.Context, projectCode string) (*domain.MiniReviewStatus, error)
	FindByProjectAndVersion(ctx context.Context, projectCode, version string) (*domain.MiniReviewStatus, error)
	// Create 登记新版本；撞 (project_code, version) 唯一约束时返回 ErrVersionConflict。
	Create(ctx context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error)
	UpdateStatus(ctx context.Context, status domain.MiniReviewStatus) (domain.MiniReviewStatus, error)
}

// StatusFilter 列表筛选；ProjectCode 为空表示全部项目。
type StatusFilter struct {
	ProjectCode string
	Limit       int
	Offset      int
}

type ListerRepository interface {
	List(ctx context.Context, filter StatusFilter) ([]domain.MiniReviewStatus, int64, error)
}

type FinderRepository interface {
	FindByID(ctx context.Context, id int64) (*domain.MiniReviewStatus, error)
}
