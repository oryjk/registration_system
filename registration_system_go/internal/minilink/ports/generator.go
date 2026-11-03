package ports

import "context"

// URLLinkGenerator 生成可在微信外拉起小程序指定页面的 URL Link。
type URLLinkGenerator interface {
	GenerateURLLink(ctx context.Context, path, query string) (string, error)
}
