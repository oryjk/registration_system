package ports

import (
	"context"

	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
)

// WebviewCodeRepository web-view 一次性 code 的持久化端口。
type WebviewCodeRepository interface {
	Create(ctx context.Context, code authdomain.WebviewCode) error
	// Consume 原子消费一个 code：未使用且未过期才生效并返回 user_id；
	// code 无效、已用或已过期时返回 consumed=false，不区分原因。
	Consume(ctx context.Context, codeHash string) (userID int64, consumed bool, err error)
}
