package postgres

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	authdomain "github.com/oryjk/registration_system/registration_system_go/internal/auth/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestWebviewCodeRepositoryConsumeIsSingleUseAndAtomic(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedWebviewCodeUser(t, pool)
	repository := NewWebviewCodeRepository(pool)

	code := authdomain.WebviewCode{
		UserID:    userID,
		CodeHash:  authdomain.HashWebviewCode("plain-code-1"),
		ExpiresAt: time.Now().Add(time.Minute),
	}
	if err := repository.Create(ctx, code); err != nil {
		t.Fatal(err)
	}

	consumedUser, consumed, err := repository.Consume(ctx, code.CodeHash)
	if err != nil || !consumed {
		t.Fatalf("首次消费应成功: consumed=%t err=%v", consumed, err)
	}
	if consumedUser != userID {
		t.Fatalf("消费应返回签发用户 %d，得到 %d", userID, consumedUser)
	}

	// 已消费的 code 不能再次使用。
	_, consumed, err = repository.Consume(ctx, code.CodeHash)
	if err != nil || consumed {
		t.Fatalf("重复消费应失败: consumed=%t err=%v", consumed, err)
	}
	// 不存在的哈希静默失败。
	_, consumed, err = repository.Consume(ctx, authdomain.HashWebviewCode("unknown"))
	if err != nil || consumed {
		t.Fatalf("未知 code 应失败: consumed=%t err=%v", consumed, err)
	}
}

func TestWebviewCodeRepositoryConsumeRejectsExpired(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedWebviewCodeUser(t, pool)
	repository := NewWebviewCodeRepository(pool)

	code := authdomain.WebviewCode{
		UserID:    userID,
		CodeHash:  authdomain.HashWebviewCode("expired-code"),
		ExpiresAt: time.Now().Add(-time.Second),
	}
	if err := repository.Create(ctx, code); err != nil {
		t.Fatal(err)
	}
	if _, consumed, err := repository.Consume(ctx, code.CodeHash); err != nil || consumed {
		t.Fatalf("过期 code 应消费失败: consumed=%t err=%v", consumed, err)
	}
}

func TestWebviewCodeRepositoryStoresHashOnly(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	ctx := context.Background()
	userID := seedWebviewCodeUser(t, pool)
	repository := NewWebviewCodeRepository(pool)

	plain := "plain-secret-code"
	if err := repository.Create(ctx, authdomain.WebviewCode{
		UserID:    userID,
		CodeHash:  authdomain.HashWebviewCode(plain),
		ExpiresAt: time.Now().Add(time.Minute),
	}); err != nil {
		t.Fatal(err)
	}

	var storedHash string
	if err := pool.QueryRow(ctx, `SELECT code_hash FROM auth_webview_codes WHERE user_id = $1`, userID).Scan(&storedHash); err != nil {
		t.Fatal(err)
	}
	if storedHash == plain {
		t.Fatal("数据库不得存储明文 code")
	}
	if storedHash != authdomain.HashWebviewCode(plain) {
		t.Fatalf("存储的应为 SHA-256 hex，得到 %q", storedHash)
	}
}

func seedWebviewCodeUser(t *testing.T, pool *pgxpool.Pool) int64 {
	t.Helper()
	var userID int64
	openid := fmt.Sprintf("webview-code-%d", time.Now().UnixNano())
	if err := pool.QueryRow(context.Background(), `INSERT INTO users (openid) VALUES ($1) RETURNING id`, openid).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	return userID
}
