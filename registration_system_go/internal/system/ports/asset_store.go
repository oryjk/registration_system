package ports

import "context"

// AssetStore 把运营静态资源写入外部对象存储（MinIO），返回公网可访问 URL。
// system 模块自有端口：不依赖 team 的 logostore，也不在 handler 里直接持有 MinIO 客户端。
type AssetStore interface {
	Save(ctx context.Context, objectKey, contentType string, data []byte) (string, error)
}
