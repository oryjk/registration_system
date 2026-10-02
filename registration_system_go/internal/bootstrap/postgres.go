package bootstrap

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func postgresPoolConfig(databaseURL string) (*pgxpool.Config, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	// 既有 timestamp 列按 UTC 墙钟存储；NOW() 默认值、比较和扫描使用同一会话时区。
	config.ConnConfig.RuntimeParams["timezone"] = "UTC"
	previousAfterConnect := config.AfterConnect
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if previousAfterConnect != nil {
			if err := previousAfterConnect(ctx, conn); err != nil {
				return err
			}
		}
		// pgx 二进制扫描默认返回 time.Local；SQL 会话时区不能控制 Go 输出时区。
		conn.TypeMap().RegisterType(&pgtype.Type{
			Name: "timestamptz", OID: pgtype.TimestamptzOID,
			Codec: &pgtype.TimestamptzCodec{ScanLocation: time.UTC},
		})
		return nil
	}
	return config, nil
}
