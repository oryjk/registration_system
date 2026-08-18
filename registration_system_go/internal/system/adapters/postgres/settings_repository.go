package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	systemsqlc "github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// SettingsRepository 以 mini_app_settings(key, jsonb) 存储小程序配置分区。
type SettingsRepository struct {
	queries *systemsqlc.Queries
}

var _ ports.SettingsRepository = (*SettingsRepository)(nil)

func NewSettingsRepository(database systemsqlc.DBTX) *SettingsRepository {
	return &SettingsRepository{queries: systemsqlc.New(database)}
}

func (r *SettingsRepository) FindSetting(ctx context.Context, key string) (map[string]any, bool, error) {
	row, err := r.queries.GetMiniAppSetting(ctx, key)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var fields map[string]any
	if err := json.Unmarshal(row.Value, &fields); err != nil {
		return nil, false, err
	}
	return fields, true, nil
}

func (r *SettingsRepository) UpsertSetting(ctx context.Context, key string, value map[string]any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = r.queries.UpsertMiniAppSetting(ctx, systemsqlc.UpsertMiniAppSettingParams{Key: key, Value: encoded})
	return err
}
