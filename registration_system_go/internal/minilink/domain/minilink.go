package domain

import (
	"net/url"
	"regexp"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// ChanlunLandingPage 缠观落地页：小程序在此完成默认登录后再以 web-view 打开缠观 H5。
const ChanlunLandingPage = "pages/chanlun/index"

// MaxReturnQueryLength 限制回跳参数长度；微信 URL Link 的 query 上限为 1024 字符。
const MaxReturnQueryLength = 512

// 回跳参数只允许缠观自身的查询串字符，防止被拼成任意跳转或注入其他小程序参数。
var returnQueryPattern = regexp.MustCompile(`^[A-Za-z0-9._=&-]*$`)

// LinkTarget 一条待生成的小程序链接：固定页面 + 已编码的 query。
type LinkTarget struct {
	Path  string
	Query string
}

// NewChanlunLinkTarget 校验缠观回跳参数并组装落地页链接目标。
func NewChanlunLinkTarget(returnQuery string) (LinkTarget, error) {
	if len(returnQuery) > MaxReturnQueryLength || !returnQueryPattern.MatchString(returnQuery) {
		return LinkTarget{}, sharederror.New(sharederror.KindValidation, "回跳参数不合法")
	}
	query := ""
	if returnQuery != "" {
		query = "path=" + url.QueryEscape(returnQuery)
	}
	return LinkTarget{Path: ChanlunLandingPage, Query: query}, nil
}
