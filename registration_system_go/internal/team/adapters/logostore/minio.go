package logostore

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/objectstore"
)

// MinioStore 把球队 Logo 经通用 objectstore 写入 MinIO（S3 兼容），返回公网前缀拼接的对象 URL。
// MinIO client 逻辑统一在 shared/adapters/objectstore，本层只保留 team-logos 的 key 规则。
type MinioStore struct {
	store *objectstore.MinioStore
}

// NewMinio 构建 MinIO Logo 存储；endpoint 等参数来自 UPLOAD_MINIO_* 环境变量。
func NewMinio(endpoint, accessKey, secretKey, bucket, region, publicURLPrefix string) (*MinioStore, error) {
	store, err := objectstore.NewMinio(endpoint, accessKey, secretKey, bucket, region, publicURLPrefix)
	if err != nil {
		return nil, err
	}
	return &MinioStore{store: store}, nil
}

func (s *MinioStore) SaveTeamLogo(ctx context.Context, teamID int64, extension, contentType string, data []byte) (string, error) {
	key, _ := objectKey(teamID, extension)
	return s.store.Put(ctx, key, contentType, data)
}
