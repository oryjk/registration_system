package ports

import "context"

// SettingsRepository 按分区键读写小程序配置，value 为该分区的原始字段映射。
type SettingsRepository interface {
	FindSetting(ctx context.Context, key string) (map[string]any, bool, error)
	// MergeHomeSetting atomically updates only the supplied home fields.
	MergeHomeSetting(ctx context.Context, fields map[string]any) error
	UpsertSetting(ctx context.Context, key string, value map[string]any) error
}
