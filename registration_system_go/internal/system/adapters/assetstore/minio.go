package assetstore

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/shared/adapters/objectstore"
)

// MinioStore 把首页运营静态资源经通用 objectstore 写入 MinIO，返回公网 URL。
// 连接参数与 team logostore 共用同一组 UPLOAD_MINIO_* 环境变量；
// MinIO client 逻辑统一在 shared/adapters/objectstore，本层只做端口适配。
type MinioStore struct {
	store *objectstore.MinioStore
}

func NewMinio(endpoint, accessKey, secretKey, bucket, region, publicURLPrefix string) (*MinioStore, error) {
	store, err := objectstore.NewMinio(endpoint, accessKey, secretKey, bucket, region, publicURLPrefix)
	if err != nil {
		return nil, err
	}
	return &MinioStore{store: store}, nil
}

func (s *MinioStore) Save(ctx context.Context, objectKey, contentType string, data []byte) (string, error) {
	return s.store.Put(ctx, objectKey, contentType, data)
}
