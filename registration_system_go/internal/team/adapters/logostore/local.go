package logostore

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// LocalStore 把 Logo 写入本地 uploads 根目录的 team-logos/ 子目录，
// 经 /uploads 静态路径对外服务（与用户头像同一套机制）。
type LocalStore struct {
	// Root 是上传根目录（config.UploadDir），Logo 落在 Root/team-logos/。
	Root string
	// PublicBaseURL 形如 https://host:port，拼接 /uploads/team-logos/{file}。
	PublicBaseURL string
}

func NewLocal(root, publicBaseURL string) *LocalStore {
	return &LocalStore{Root: root, PublicBaseURL: publicBaseURL}
}

func (s *LocalStore) SaveTeamLogo(_ context.Context, teamID int64, extension, _ string, data []byte) (string, error) {
	_, fileName := objectKey(teamID, extension)
	dir := filepath.Join(s.Root, "team-logos")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("创建 Logo 目录: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, fileName), data, 0o644); err != nil {
		return "", fmt.Errorf("保存 Logo 文件: %w", err)
	}
	return fmt.Sprintf("%s/uploads/team-logos/%s", s.PublicBaseURL, fileName), nil
}
