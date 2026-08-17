package domain

import (
	"strconv"
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// DefaultReviewingStatusText 新登记版本的默认状态文案，与小程序审核态提示保持一致。
const DefaultReviewingStatusText = "正在审核"

// versionCode 每段的取值上限：minor/patch 超过 99 会让 major*10000+minor*100+patch
// 编码进位冲突，因此在解析与递增时都限制在两位内。
const versionSegmentLimit = 99

// MiniReviewStatus 记录小程序某个版本的提审状态：
// 生产构建登记新版本（is_reviewing=true），过审后管理端标记通过（false）。
type MiniReviewStatus struct {
	ID          int64
	ProjectCode string
	Version     string
	VersionCode int64
	IsReviewing bool
	StatusText  string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Version 三段式版本号 x.y.z，minor/patch 限制在 0-99 保证 versionCode 编码唯一。
type Version struct {
	Major int
	Minor int
	Patch int
}

func ParseVersion(raw string) (Version, error) {
	segments := strings.Split(strings.TrimSpace(raw), ".")
	if len(segments) != 3 {
		return Version{}, sharederror.New(sharederror.KindValidation, "版本号格式必须是 x.y.z")
	}
	values := make([]int, 3)
	for index, segment := range segments {
		value, err := strconv.Atoi(segment)
		if err != nil || value < 0 || (index > 0 && value > versionSegmentLimit) {
			return Version{}, sharederror.New(sharederror.KindValidation, "版本号段无效: "+raw)
		}
		values[index] = value
	}
	return Version{Major: values[0], Minor: values[1], Patch: values[2]}, nil
}

func (v Version) String() string {
	return strconv.Itoa(v.Major) + "." + strconv.Itoa(v.Minor) + "." + strconv.Itoa(v.Patch)
}

// Code 生成与小程序构建脚本一致的数值编码（major*10000+minor*100+patch），用于排序取最大版本。
func (v Version) Code() int64 {
	return int64(v.Major)*10000 + int64(v.Minor)*100 + int64(v.Patch)
}

func (v Version) After(other Version) bool {
	return v.Code() > other.Code()
}

// NextPatch 递增 patch；patch 到 99 时进位到 minor，minor 到 99 时进位到 major。
func (v Version) NextPatch() Version {
	if v.Patch < versionSegmentLimit {
		return Version{Major: v.Major, Minor: v.Minor, Patch: v.Patch + 1}
	}
	if v.Minor < versionSegmentLimit {
		return Version{Major: v.Major, Minor: v.Minor + 1, Patch: 0}
	}
	return Version{Major: v.Major + 1, Minor: 0, Patch: 0}
}

// NewReviewingStatus 登记一个进入审核的新版本记录。
func NewReviewingStatus(projectCode string, version Version, now time.Time) MiniReviewStatus {
	return MiniReviewStatus{
		ProjectCode: strings.TrimSpace(projectCode),
		Version:     version.String(),
		VersionCode: version.Code(),
		IsReviewing: true,
		StatusText:  DefaultReviewingStatusText,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// RestartReviewing 已过审的版本重新提审（重复构建同一显式版本的场景）。
func (s *MiniReviewStatus) RestartReviewing(now time.Time) {
	s.IsReviewing = true
	s.StatusText = DefaultReviewingStatusText
	s.UpdatedAt = now
}

// SetStatus 管理端更新审核结论：标记通过（is_reviewing=false，附结论文案）或重新打开审核。
func (s *MiniReviewStatus) SetStatus(isReviewing bool, statusText string, now time.Time) error {
	trimmed := strings.TrimSpace(statusText)
	if trimmed == "" {
		return sharederror.New(sharederror.KindValidation, "审核状态文案不能为空")
	}
	s.IsReviewing = isReviewing
	s.StatusText = trimmed
	s.UpdatedAt = now
	return nil
}

// AllocationInput 生产构建自动分配版本号的依据。
type AllocationInput struct {
	// Latest 是该项目当前版本号最大的记录；项目首次登记时为 nil。
	Latest *MiniReviewStatus
	// Seed 是构建侧传来的 manifest 当前版本，衔接历史数据（如 football 时代的 1.0.38）。
	Seed Version
}

// DecideNextVersion 决定本次构建应使用的版本：
// 最新记录仍在审核中且不落后于种子 → 复用它（重复构建不递增）；
// 否则以「库内最大版本与种子中的较大者」为基准递增 patch。
func DecideNextVersion(input AllocationInput) Version {
	base := input.Seed
	if input.Latest != nil {
		latest, err := ParseVersion(input.Latest.Version)
		if err == nil && latest.After(base) {
			base = latest
		}
	}
	if input.Latest != nil && input.Latest.IsReviewing {
		latest, err := ParseVersion(input.Latest.Version)
		if err == nil && !input.Seed.After(latest) {
			return latest
		}
	}
	return base.NextPatch()
}
