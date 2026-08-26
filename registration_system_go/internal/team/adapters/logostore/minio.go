package logostore

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinioStore 把 Logo 写入 MinIO（S3 兼容），返回公网前缀拼接的对象 URL。
type MinioStore struct {
	client          *minio.Client
	bucket          string
	publicURLPrefix string
}

// NewMinio 构建 MinIO 客户端；endpoint 允许带 http(s):// 前缀，据此决定是否启用 TLS。
func NewMinio(endpoint, accessKey, secretKey, bucket, region, publicURLPrefix string) (*MinioStore, error) {
	useSSL := false
	trimmed := strings.TrimSpace(endpoint)
	if strings.HasPrefix(trimmed, "https://") {
		useSSL = true
		trimmed = strings.TrimPrefix(trimmed, "https://")
	} else {
		trimmed = strings.TrimPrefix(trimmed, "http://")
	}
	client, err := minio.New(trimmed, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
		Region: region,
	})
	if err != nil {
		return nil, fmt.Errorf("初始化 MinIO 客户端: %w", err)
	}
	return &MinioStore{client: client, bucket: bucket, publicURLPrefix: strings.TrimRight(publicURLPrefix, "/")}, nil
}

func (s *MinioStore) SaveTeamLogo(ctx context.Context, teamID int64, extension, contentType string, data []byte) (string, error) {
	key, _ := objectKey(teamID, extension)
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return "", fmt.Errorf("查询 MinIO bucket: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return "", fmt.Errorf("创建 MinIO bucket: %w", err)
		}
	}
	if _, err := s.client.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return "", fmt.Errorf("上传 Logo 到 MinIO: %w", err)
	}
	return fmt.Sprintf("%s/%s", s.publicURLPrefix, key), nil
}
