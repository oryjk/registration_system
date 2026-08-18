package application

import (
	"context"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// SettingsService 负责小程序配置的读取（缺失分区回退默认值）与整分区覆写。
type SettingsService struct {
	repository ports.SettingsRepository
}

func NewSettingsService(repository ports.SettingsRepository) SettingsService {
	return SettingsService{repository: repository}
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
	return settings, nil
}

func (s SettingsService) Update(ctx context.Context, settings domain.MiniAppSettings) (domain.MiniAppSettings, error) {
	fields := map[string]any{"clear_profile_enabled": settings.Debug.ClearProfileEnabled}
	if err := s.repository.UpsertSetting(ctx, domain.SettingsSectionDebug, fields); err != nil {
		return domain.MiniAppSettings{}, sharederror.Wrap(sharederror.KindInternal, "保存小程序配置失败", err)
	}
	return settings, nil
}

func applyDebugFields(target *domain.DebugSettings, raw map[string]any) {
	if value, ok := raw["clear_profile_enabled"].(bool); ok {
		target.ClearProfileEnabled = value
	}
}
