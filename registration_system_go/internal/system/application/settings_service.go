package application

import (
	"context"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// SettingsService 负责小程序配置的读取（缺失分区回退默认值）与 debug 分区的字段级合并更新。
type SettingsService struct {
	repository ports.SettingsRepository
}

func NewSettingsService(repository ports.SettingsRepository) SettingsService {
	return SettingsService{repository: repository}
}

// DebugSettingsPatch 用指针区分“未提供”与“显式 false”，保证只更新请求给出的开关。
type DebugSettingsPatch struct {
	ClearProfileEnabled       *bool
	ReviewStatusToggleEnabled *bool
}

// OnboardingSettingsPatch 与 DebugSettingsPatch 同理：nil 表示未提供。
type OnboardingSettingsPatch struct {
	Enabled *bool
}

func (s SettingsService) Get(ctx context.Context) (domain.MiniAppSettings, error) {
	settings := domain.DefaultMiniAppSettings()
	raw, found, err := s.repository.FindSetting(ctx, domain.SettingsSectionDebug)
	if err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "读取小程序配置失败", err)
	}
	if found {
		applyDebugFields(&settings.Debug, raw)
	}

	onboardingRaw, found, err := s.repository.FindSetting(ctx, domain.SettingsSectionOnboarding)
	if err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "读取小程序配置失败", err)
	}
	if found {
		applyOnboardingFields(&settings.Onboarding, onboardingRaw)
	}
	return settings, nil
}

// UpdateDebug 只覆写 patch 中给出的开关，未提供的保持库内现值
// （仓储是整分区 JSON 落库，必须先读旧值合并，否则会重置其他开关）。
func (s SettingsService) UpdateDebug(ctx context.Context, patch DebugSettingsPatch) (domain.MiniAppSettings, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return domain.MiniAppSettings{}, err
	}
	if patch.ClearProfileEnabled != nil {
		settings.Debug.ClearProfileEnabled = *patch.ClearProfileEnabled
	}
	if patch.ReviewStatusToggleEnabled != nil {
		settings.Debug.ReviewStatusToggleEnabled = *patch.ReviewStatusToggleEnabled
	}
	fields := map[string]any{
		"clear_profile_enabled":        settings.Debug.ClearProfileEnabled,
		"review_status_toggle_enabled": settings.Debug.ReviewStatusToggleEnabled,
	}
	if err := s.repository.UpsertSetting(ctx, domain.SettingsSectionDebug, fields); err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "保存小程序配置失败", err)
	}
	return settings, nil
}

func applyDebugFields(target *domain.DebugSettings, raw map[string]any) {
	if value, ok := raw["clear_profile_enabled"].(bool); ok {
		target.ClearProfileEnabled = value
	}
	if value, ok := raw["review_status_toggle_enabled"].(bool); ok {
		target.ReviewStatusToggleEnabled = value
	}
}

// UpdateOnboarding 更新新手引导开关（整分区 JSON 落库，先读旧值合并）。
func (s SettingsService) UpdateOnboarding(ctx context.Context, patch OnboardingSettingsPatch) (domain.MiniAppSettings, error) {
	settings, err := s.Get(ctx)
	if err != nil {
		return domain.MiniAppSettings{}, err
	}
	if patch.Enabled != nil {
		settings.Onboarding.Enabled = *patch.Enabled
	}
	fields := map[string]any{
		"enabled": settings.Onboarding.Enabled,
	}
	if err := s.repository.UpsertSetting(ctx, domain.SettingsSectionOnboarding, fields); err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "保存小程序配置失败", err)
	}
	return settings, nil
}

func applyOnboardingFields(target *domain.OnboardingSettings, raw map[string]any) {
	if value, ok := raw["enabled"].(bool); ok {
		target.Enabled = value
	}
}
