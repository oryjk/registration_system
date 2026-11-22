package application

import (
	"context"
	"strings"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

type VipStatusView struct {
	TeamID            int64
	IsVip             bool
	VipUntil          *time.Time
	VipCredits        int
	DefaultShareBgURL string
	Plans             []domain.VipPlanSpec
	Benefits          []domain.VipBenefit
	FreeTierNote      string
}

type ShareBackgroundListView struct {
	Items           []domain.ShareBackground
	DefaultImageURL string
}

type VipService struct {
	repository ports.VipRepository
	now        func() time.Time
}

func NewVipService(repository ports.VipRepository) *VipService {
	return &VipService{
		repository: repository,
		now:        time.Now,
	}
}

// WithClock 允许测试或调用方注入时钟源。
func (s *VipService) WithClock(now func() time.Time) *VipService {
	if now != nil {
		s.now = now
	}
	return s
}

func (s *VipService) currentTime() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

// GetStatus 返回球队当前会员状态、3 档套餐目录、未来可扩展权益列表与免费分享说明。
func (s *VipService) GetStatus(ctx context.Context, actor sharedauth.Actor, teamID int64) (VipStatusView, error) {
	if err := s.authorizeMember(ctx, actor, teamID); err != nil {
		return VipStatusView{}, err
	}
	status, found, err := s.repository.FindVipStatus(ctx, teamID)
	if err != nil {
		return VipStatusView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队会员状态失败", err)
	}
	if !found {
		return VipStatusView{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	now := s.currentTime()
	return VipStatusView{
		TeamID:            status.TeamID,
		IsVip:             domain.IsVipActive(status.VipUntil, now),
		VipUntil:          status.VipUntil,
		VipCredits:        status.VipCredits,
		DefaultShareBgURL: status.DefaultShareBgURL,
		Plans:             domain.VipPlanCatalog(),
		Benefits:          domain.VipBenefitCatalog(),
		FreeTierNote:      domain.VipFreeTierNote,
	}, nil
}

// HasCustomShareBgAccess 供 match 领域通过端口调用：判断球队或本场比赛是否已有免扣次的自定义背景权限。
func (s *VipService) HasCustomShareBgAccess(ctx context.Context, teamID int64, matchUnlocked bool) (bool, error) {
	if matchUnlocked {
		return true, nil
	}
	if teamID <= 0 {
		return false, nil
	}
	status, found, err := s.repository.FindVipStatus(ctx, teamID)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "查询球队会员状态失败", err)
	}
	if !found {
		return false, nil
	}
	return status.HasCustomShareBgAccess(s.currentTime(), false), nil
}

// ConsumeCreditForCustomShareBg 供 match 领域通过端口调用：原子扣减 1 次球队单次权益。
func (s *VipService) ConsumeCreditForCustomShareBg(ctx context.Context, teamID int64) (bool, error) {
	if teamID <= 0 {
		return false, nil
	}
	consumed, err := s.repository.ConsumeVipCredit(ctx, teamID)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "扣减球队会员单次权益失败", err)
	}
	return consumed, nil
}

// RecordShareBackground 写入球队背景资源库（幂等更新）并同步更新球队默认分享背景。
func (s *VipService) RecordShareBackground(ctx context.Context, teamID int64, imageURL string, uploadedByUserID *int64) error {
	if teamID <= 0 {
		return sharederror.New(sharederror.KindValidation, "球队 ID 无效")
	}
	normalized := strings.TrimSpace(imageURL)
	if normalized == "" {
		return sharederror.New(sharederror.KindValidation, "背景图片地址不能为空")
	}
	if uploadedByUserID != nil && *uploadedByUserID <= 0 {
		uploadedByUserID = nil
	}
	if err := s.repository.RecordShareBackground(ctx, teamID, normalized, uploadedByUserID); err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "保存球队分享背景失败", err)
	}
	return nil
}

// ListShareBackgrounds 返回球队分享背景资源库与当前默认背景地址（仅球队有效成员可读）。
func (s *VipService) ListShareBackgrounds(ctx context.Context, actor sharedauth.Actor, teamID int64) (ShareBackgroundListView, error) {
	if err := s.authorizeMember(ctx, actor, teamID); err != nil {
		return ShareBackgroundListView{}, err
	}
	items, defaultURL, err := s.repository.ListShareBackgrounds(ctx, teamID)
	if err != nil {
		return ShareBackgroundListView{}, sharederror.Wrap(sharederror.KindInternal, "查询球队分享背景资源库失败", err)
	}
	if items == nil {
		items = []domain.ShareBackground{}
	}
	return ShareBackgroundListView{
		Items:           items,
		DefaultImageURL: defaultURL,
	}, nil
}

// FindTeamDefaultShareBg 返回球队最近一次选用的默认分享背景与当前是否处于 VIP 有效期。
func (s *VipService) FindTeamDefaultShareBg(ctx context.Context, teamID int64) (string, bool, error) {
	if teamID <= 0 {
		return "", false, nil
	}
	status, found, err := s.repository.FindVipStatus(ctx, teamID)
	if err != nil {
		return "", false, sharederror.Wrap(sharederror.KindInternal, "查询球队默认分享背景失败", err)
	}
	if !found {
		return "", false, nil
	}
	return strings.TrimSpace(status.DefaultShareBgURL), domain.IsVipActive(status.VipUntil, s.currentTime()), nil
}

// ResolveDefaultShareBgForNewMatch 供新建比赛自动继承：仅当球队在 VIP 有效期内且有默认背景图时返回预填值。
func (s *VipService) ResolveDefaultShareBgForNewMatch(ctx context.Context, teamID int64) (string, bool, error) {
	defaultURL, isVip, err := s.FindTeamDefaultShareBg(ctx, teamID)
	if err != nil {
		return "", false, err
	}
	if !isVip || defaultURL == "" {
		return "", false, nil
	}
	return defaultURL, true, nil
}

// HasTeamShareBackground 校验指定图片地址是否属于该球队的分享背景资源库。
func (s *VipService) HasTeamShareBackground(ctx context.Context, teamID int64, imageURL string) (bool, error) {
	if teamID <= 0 {
		return false, nil
	}
	normalized := strings.TrimSpace(imageURL)
	if normalized == "" {
		return false, nil
	}
	exists, err := s.repository.HasTeamShareBackground(ctx, teamID, normalized)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "校验球队分享背景失败", err)
	}
	return exists, nil
}

// ResolveVipPlan 解析球队会员套餐规格（供 payment 等外部模块通过端口复用定价）。
func (s *VipService) ResolveVipPlan(code string) (domain.VipPlanSpec, error) {
	return domain.ResolveVipPlan(code)
}

func (s *VipService) authorizeMember(ctx context.Context, actor sharedauth.Actor, teamID int64) error {
	if teamID <= 0 {
		return sharederror.New(sharederror.KindValidation, "球队 ID 无效")
	}
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if !actor.IsUser() || team.Status != domain.TeamActive {
		return sharederror.ErrForbidden
	}
	if _, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID); err != nil {
		return sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	} else if !found {
		return sharederror.ErrForbidden
	}
	return nil
}
