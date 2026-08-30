package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	authsqlc "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/postgres/sqlc"
	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/auth/ports"
)

// WebviewCodeRepository web-view 一次性 code 的 PostgreSQL 适配器。
type WebviewCodeRepository struct {
	queries *authsqlc.Queries
}

func NewWebviewCodeRepository(database authsqlc.DBTX) *WebviewCodeRepository {
	return &WebviewCodeRepository{queries: authsqlc.New(database)}
}

func (r *WebviewCodeRepository) Create(ctx context.Context, code authdomain.WebviewCode) error {
	_, err := r.queries.CreateWebviewCode(ctx, authsqlc.CreateWebviewCodeParams{
		UserID:    code.UserID,
		CodeHash:  code.CodeHash,
		ExpiresAt: pgtype.Timestamptz{Time: code.ExpiresAt, Valid: true},
	})
	return err
}

// Consume 单条原子 UPDATE 完成一次性消费与过期判断；未命中（无效/已用/过期）返回 false。
func (r *WebviewCodeRepository) Consume(ctx context.Context, codeHash string) (int64, bool, error) {
	userID, err := r.queries.ConsumeWebviewCode(ctx, codeHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return userID, true, nil
}

var _ ports.WebviewCodeRepository = (*WebviewCodeRepository)(nil)
