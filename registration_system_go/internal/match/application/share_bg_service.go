package application

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/shared/imagefile"
)

// MaxShareBgUploadBytes 比赛自定义分享卡背景图上传上限（2MB）。
const MaxShareBgUploadBytes = 2 << 20

const shareBgVipRequiredMessage = "更换自定义分享背景需开通球队会员，免费版仍可正常使用默认海报分享"

// ShareBgResult 返回比赛自定义分享背景图最新状态。
type ShareBgResult struct {
	ShareBgImageURL string
	ShareBgUnlocked bool
}

// ShareBgService 编排比赛自定义分享卡背景图的上传、资源库切换与清除。
type ShareBgService struct {
	repository ports.ShareBgRepository
	authorizer TeamManagerAuthorizer
	teamVip    ports.TeamVipEntitlement
	store      ports.ShareBgStore
}

func NewShareBgService(
	repository ports.ShareBgRepository,
	authorizer TeamManagerAuthorizer,
	teamVip ports.TeamVipEntitlement,
	store ports.ShareBgStore,
) *ShareBgService {
	return &ShareBgService{
		repository: repository,
		authorizer: authorizer,
		teamVip:    teamVip,
		store:      store,
	}
}

// Upload 上传并绑定比赛自定义分享背景图，成功后同步写入球队分享背景资源库并更新球队默认背景。
func (s *ShareBgService) Upload(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, data []byte) (ShareBgResult, error) {
	match, teamID, err := s.loadAuthorizedEditableTeamMatch(ctx, actor, matchID)
	if err != nil {
		return ShareBgResult{}, err
	}
	if len(data) == 0 || len(data) > MaxShareBgUploadBytes {
		return ShareBgResult{}, sharederror.New(sharederror.KindValidation, "分享背景图片大小需在 2MB 以内")
	}
	image, ok := imagefile.ValidateRasterImage(data)
	if !ok {
		return ShareBgResult{}, sharederror.New(sharederror.KindValidation, "分享背景需为有效的 PNG、JPG、WebP 图片且不超过1600万像素")
	}
	if s.store == nil {
		return ShareBgResult{}, sharederror.New(sharederror.KindInternal, "分享背景上传存储未配置")
	}
	unlocked, err := s.ensureOrConsumeEntitlement(ctx, teamID, match.ShareBgUnlocked)
	if err != nil {
		return ShareBgResult{}, err
	}
	digest := sha256.Sum256(data)
	key := fmt.Sprintf("match-share-bgs/%x.%s", digest[:8], image.Extension)
	imageURL, err := s.store.Save(ctx, key, image.ContentType, data)
	if err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "上传分享背景图片失败", err)
	}
	if err := s.repository.UpdateShareBgImage(ctx, matchID, imageURL, unlocked); err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "保存比赛分享背景失败", err)
	}
	if err := s.teamVip.RecordShareBackground(ctx, teamID, imageURL, actor.ID); err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "保存球队分享背景资源库失败", err)
	}
	return ShareBgResult{ShareBgImageURL: imageURL, ShareBgUnlocked: unlocked}, nil
}

// Select 从球队分享背景资源库选择已有图片应用到当前比赛，并同步更新球队默认背景。
func (s *ShareBgService) Select(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID, rawImageURL string) (ShareBgResult, error) {
	imageURL := strings.TrimSpace(rawImageURL)
	if imageURL == "" {
		return ShareBgResult{}, sharederror.New(sharederror.KindValidation, "请选择要使用的分享背景图片")
	}
	match, teamID, err := s.loadAuthorizedEditableTeamMatch(ctx, actor, matchID)
	if err != nil {
		return ShareBgResult{}, err
	}
	if s.teamVip == nil {
		return ShareBgResult{}, sharederror.New(sharederror.KindInternal, "球队会员服务未配置")
	}
	exists, err := s.teamVip.HasTeamShareBackground(ctx, teamID, imageURL)
	if err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "校验球队分享背景失败", err)
	}
	if !exists {
		return ShareBgResult{}, sharederror.New(sharederror.KindValidation, "所选图片不在球队分享背景资源库中")
	}
	unlocked, err := s.ensureOrConsumeEntitlement(ctx, teamID, match.ShareBgUnlocked)
	if err != nil {
		return ShareBgResult{}, err
	}
	if err := s.repository.UpdateShareBgImage(ctx, matchID, imageURL, unlocked); err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "保存比赛分享背景失败", err)
	}
	if err := s.teamVip.RecordShareBackground(ctx, teamID, imageURL, actor.ID); err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "更新球队默认分享背景失败", err)
	}
	return ShareBgResult{ShareBgImageURL: imageURL, ShareBgUnlocked: unlocked}, nil
}

// Clear 清除本场比赛的自定义分享背景图，但保留 share_bg_unlocked 不重置，
// 确保单次权益解锁后重新换图不会二次扣次。
func (s *ShareBgService) Clear(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) (ShareBgResult, error) {
	match, _, err := s.loadAuthorizedEditableTeamMatch(ctx, actor, matchID)
	if err != nil {
		return ShareBgResult{}, err
	}
	if err := s.repository.UpdateShareBgImage(ctx, matchID, "", match.ShareBgUnlocked); err != nil {
		return ShareBgResult{}, sharederror.Wrap(sharederror.KindInternal, "清除比赛分享背景失败", err)
	}
	return ShareBgResult{ShareBgImageURL: "", ShareBgUnlocked: match.ShareBgUnlocked}, nil
}

func (s *ShareBgService) loadAuthorizedEditableTeamMatch(ctx context.Context, actor sharedauth.Actor, matchID uuid.UUID) (domain.Match, int64, error) {
	if !actor.IsUser() {
		return domain.Match{}, 0, sharederror.ErrForbidden
	}
	match, found, err := s.repository.FindMatch(ctx, matchID)
	if err != nil {
		return domain.Match{}, 0, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, 0, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if match.HostTeamID == nil || *match.HostTeamID <= 0 {
		return domain.Match{}, 0, sharederror.New(sharederror.KindForbidden, "仅球队比赛支持自定义分享背景")
	}
	if match.Status == domain.MatchEnded || match.Status == domain.MatchCancelled {
		return domain.Match{}, 0, sharederror.New(sharederror.KindConflict, "已结束或已取消的比赛不能修改分享背景")
	}
	if s.authorizer == nil {
		return domain.Match{}, 0, sharederror.ErrForbidden
	}
	if err := s.authorizer.EnsureManager(ctx, *match.HostTeamID, actor.ID); err != nil {
		return domain.Match{}, 0, err
	}
	return match, *match.HostTeamID, nil
}

func (s *ShareBgService) ensureOrConsumeEntitlement(ctx context.Context, teamID int64, matchUnlocked bool) (bool, error) {
	if s.teamVip == nil {
		return false, sharederror.New(sharederror.KindInternal, "球队会员服务未配置")
	}
	hasAccess, err := s.teamVip.HasCustomShareBgAccess(ctx, teamID, matchUnlocked)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "查询球队会员权益失败", err)
	}
	if hasAccess {
		return true, nil
	}
	consumed, err := s.teamVip.ConsumeCreditForCustomShareBg(ctx, teamID)
	if err != nil {
		return false, sharederror.Wrap(sharederror.KindInternal, "核销球队单次权益失败", err)
	}
	if !consumed {
		return false, sharederror.New(sharederror.KindForbidden, shareBgVipRequiredMessage)
	}
	return true, nil
}
