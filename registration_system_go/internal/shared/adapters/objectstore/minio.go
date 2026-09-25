package objectstore

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinioStore 是通用的 MinIO 对象存取薄封装：client 初始化、bucket 兜底创建、
// PutObject 与公网 URL 拼接只在这里实现一份。它只认识 object key 与字节流，
// 不了解 team logo、首页插画等任何业务概念；业务模块各自适配 key 规则。
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

// Put 写入对象（bucket 不存在时兜底创建）并返回公网前缀拼接后的 URL。
func (s *MinioStore) Put(ctx context.Context, objectKey, contentType string, data []byte) (string, error) {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return "", fmt.Errorf("查询 MinIO bucket: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return "", fmt.Errorf("创建 MinIO bucket: %w", err)
		}
	}
	if _, err := s.client.PutObject(ctx, s.bucket, objectKey, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return "", fmt.Errorf("上传对象到 MinIO: %w", err)
	}
	return fmt.Sprintf("%s/%s", s.publicURLPrefix, objectKey), nil
}
