package domain

import (
	"net/url"
	"strings"
	"unicode"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// NormalizeCoverImageURL accepts a public HTTP(S) URL or an empty default cover.
// This URL is displayed by clients; the backend never fetches it.
func NormalizeCoverImageURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}
	parsed, err := url.Parse(value)
	if err != nil || len(value) > 2048 || strings.IndexFunc(value, unicode.IsSpace) >= 0 || parsed == nil ||
		(parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Hostname() == "" || parsed.User != nil {
		return "", sharederror.New(sharederror.KindValidation, "封面图片必须是有效的 HTTP(S) URL")
	}
	return value, nil
}
