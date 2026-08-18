// Package avatarstore 提供头像文件的本地磁盘存储实现。
package avatarstore

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Local 把头像写入 <dir>/avatars 目录，返回以 /uploads 开头的相对访问路径。
type Local struct {
	dir string
}

func NewLocal(dir string) (Local, error) {
	dir = strings.TrimSpace(dir)
	if dir == "" {
		return Local{}, fmt.Errorf("avatar upload dir is required")
	}
	if err := os.MkdirAll(filepath.Join(dir, "avatars"), 0o755); err != nil {
		return Local{}, fmt.Errorf("create avatar upload dir: %w", err)
	}
	return Local{dir: dir}, nil
}

func (l Local) SaveUserAvatar(userID int64, extension string, data []byte) (string, error) {
	fileName := fmt.Sprintf("%d-%d.%s", userID, time.Now().UnixNano(), extension)
	if err := os.WriteFile(filepath.Join(l.dir, "avatars", fileName), data, 0o644); err != nil {
		return "", fmt.Errorf("write avatar file: %w", err)
	}
	return "/uploads/avatars/" + fileName, nil
}
