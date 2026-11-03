package wechatcode

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"
)

// urlLinkCacheTTL 链接本身 30 天有效，缓存 1 天即可避免重复消耗每日生成额度。
const urlLinkCacheTTL = 24 * time.Hour

// GenerateURLLink 生成正式版小程序指定页面的 URL Link（微信外可拉起小程序）。
func (g *Generator) GenerateURLLink(ctx context.Context, path, query string) (string, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := "urllink/" + path + "?" + query
	if cached, ok := g.images[key]; ok && time.Now().Before(cached.expires) {
		return cached.url, nil
	}
	if err := g.ensureToken(ctx); err != nil {
		return "", err
	}
	payload := map[string]any{
		"path": path, "query": query, "env_version": "release",
		"expire_type": 1, "expire_interval": 30,
	}
	data, err := g.post(ctx, "/wxa/generate_urllink?access_token="+url.QueryEscape(g.token), payload)
	if err != nil {
		return "", err
	}
	var result struct {
		Code int    `json:"errcode"`
		Link string `json:"url_link"`
	}
	if json.Unmarshal(data, &result) != nil || result.Code != 0 || result.Link == "" {
		if result.Code == 40001 || result.Code == 40014 || result.Code == 42001 {
			g.token = ""
			g.tokenExpires = time.Time{}
		}
		return "", fmt.Errorf("WeChat url link rejected (code %d)", result.Code)
	}
	if len(g.images) >= 256 {
		clear(g.images)
	}
	g.images[key] = cachedCode{url: result.Link, expires: time.Now().Add(urlLinkCacheTTL)}
	return result.Link, nil
}
