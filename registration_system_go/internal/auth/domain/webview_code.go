package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// WebviewCode web-view 一次性登录 code 的持久化形态：只存 SHA-256 哈希，不存明文。
type WebviewCode struct {
	UserID    int64
	CodeHash  string
	ExpiresAt time.Time
}

func NewWebviewCode(userID int64, codeHash string, expiresAt time.Time, now time.Time) (WebviewCode, error) {
	if userID <= 0 || codeHash == "" || !expiresAt.After(now) {
		return WebviewCode{}, sharederror.New(sharederror.KindValidation, "web-view code 参数无效")
	}
	return WebviewCode{UserID: userID, CodeHash: codeHash, ExpiresAt: expiresAt}, nil
}

// GenerateWebviewCode 生成 crypto/rand 32 字节 hex 明文 code，并返回其 SHA-256 哈希。
func GenerateWebviewCode() (plain string, hash string, err error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", "", fmt.Errorf("generate webview code: %w", err)
	}
	plain = hex.EncodeToString(raw[:])
	return plain, HashWebviewCode(plain), nil
}

// HashWebviewCode 计算明文 code 的 SHA-256 hex，与数据库存储/查询口径一致。
func HashWebviewCode(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}
