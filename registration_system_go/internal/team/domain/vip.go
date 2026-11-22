package domain

import (
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type VipPlan string

const (
	VipPlanOnce    VipPlan = "once"
	VipPlanMonthly VipPlan = "monthly"
	VipPlanYearly  VipPlan = "yearly"
)

// VipFreeTierNote 明确向用户说明免费版完整保留比赛分享能力，仅更换自定义海报背景需要球队会员。
const VipFreeTierNote = "免费版同样支持完整比赛分享功能，更换自定义海报背景需开通球队会员"

type VipPlanSpec struct {
	Code         VipPlan `json:"code"`
	Name         string  `json:"name"`
	PriceCents   int64   `json:"price_cents"`
	DurationDays int     `json:"duration_days"`
	Credits      int     `json:"credits"`
	Badge        string  `json:"badge"`
	Description  string  `json:"description"`
}

type VipBenefit struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Available   bool   `json:"available"`
}

type VipStatus struct {
	TeamID            int64
	IsVip             bool
	VipUntil          *time.Time
	VipCredits        int
	DefaultShareBgURL string
}

type ShareBackground struct {
	ID               int64
	TeamID           int64
	ImageURL         string
	UploadedByUserID *int64
	CreatedAt        time.Time
}

var vipPlanCatalog = []VipPlanSpec{
	{
		Code:         VipPlanOnce,
		Name:         "单次体验",
		PriceCents:   900,
		DurationDays: 0,
		Credits:      1,
		Badge:        "",
		Description:  "增加 1 次球队专属权益，可用于解锁单场比赛自定义分享背景",
	},
	{
		Code:         VipPlanMonthly,
		Name:         "月度会员",
		PriceCents:   1900,
		DurationDays: 30,
		Credits:      0,
		Badge:        "",
		Description:  "30 天内球队不限次使用自定义分享背景及全部会员权益",
	},
	{
		Code:         VipPlanYearly,
		Name:         "年度会员",
		PriceCents:   9900,
		DurationDays: 365,
		Credits:      0,
		Badge:        "推荐",
		Description:  "365 天畅享球队全部会员权益，最划算",
	},
}

var vipBenefitCatalog = []VipBenefit{
	{
		Key:         "custom_share_bg",
		Title:       "自定义比赛分享背景",
		Description: "上传球队合照、球场照片作为比赛分享海报底图",
		Available:   true,
	},
	{
		Key:         "team_share_library",
		Title:       "球队背景资源库与自动沿用",
		Description: "已上传背景自动沉淀到球队资源库，会员有效期内建赛默认沿用",
		Available:   true,
	},
	{
		Key:         "future_team_perks",
		Title:       "更多球队专属权益",
		Description: "后续上线的新球队权益将面向会员持续免费解锁",
		Available:   false,
	},
}

// VipPlanCatalog 返回 3 档球队会员套餐的副本。
func VipPlanCatalog() []VipPlanSpec {
	items := make([]VipPlanSpec, len(vipPlanCatalog))
	copy(items, vipPlanCatalog)
	return items
}

// VipBenefitCatalog 返回当前与未来可扩展的球队会员权益列表副本。
func VipBenefitCatalog() []VipBenefit {
	items := make([]VipBenefit, len(vipBenefitCatalog))
	copy(items, vipBenefitCatalog)
	return items
}

// ResolveVipPlan 解析并校验球队会员套餐编码。
func ResolveVipPlan(code string) (VipPlanSpec, error) {
	normalized := VipPlan(strings.ToLower(strings.TrimSpace(code)))
	for _, spec := range vipPlanCatalog {
		if spec.Code == normalized {
			return spec, nil
		}
	}
	return VipPlanSpec{}, sharederror.New(sharederror.KindValidation, "球队会员套餐无效")
}

// ComputeNextVipUntil 计算开通或续费后的新会员到期时间：
// 已有未过期会员则在原 vip_until 上顺延，否则从 now 起算。
func ComputeNextVipUntil(current *time.Time, now time.Time, days int) time.Time {
	base := now
	if current != nil && current.After(now) {
		base = *current
	}
	if days <= 0 {
		return base
	}
	return base.Add(time.Duration(days) * 24 * time.Hour)
}

// HasCustomShareBgAccess 判断当前是否可直接更换自定义分享背景（无需再消耗单次权益）：
// 本场比赛已解锁，或球队当前处于会员有效期内。
func (s VipStatus) HasCustomShareBgAccess(now time.Time, matchUnlocked bool) bool {
	if matchUnlocked {
		return true
	}
	return IsVipActive(s.VipUntil, now)
}
