// Package logostore 提供球队 Logo 的存储适配：本地目录或 MinIO（S3 兼容），
// 由 UPLOAD_STORAGE_BACKEND 选择；URL 规则与 Rust 旧后端保持一致以便共存迁移。
package logostore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// Store 保存球队 Logo 并返回可直接对外访问的 URL。
type Store interface {
	SaveTeamLogo(ctx context.Context, teamID int64, extension string, contentType string, data []byte) (string, error)
}

// objectKey 生成规则与 Rust 旧后端一致：team-logos/team-{id}-{uuid}.{ext}。
func objectKey(teamID int64, extension string) (string, string) {
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		random = [16]byte{}
	}
	fileName := fmt.Sprintf("team-%d-%s.%s", teamID, hex.EncodeToString(random[:]), extension)
	return "team-logos/" + fileName, fileName
}
