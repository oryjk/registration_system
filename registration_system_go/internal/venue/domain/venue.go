package domain

import (
	"net/url"
	"strings"
	"time"
	"unicode"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// Venue is a named court profile assembled with its historical match usage.
type Venue struct {
	Name       string
	Latitude   *float64
	Longitude  *float64
	UseCount   int64
	LastUsedAt time.Time
	ImageURL   string
}

func NormalizeImageURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}
	parsed, err := url.Parse(value)
	if err != nil || len(value) > 2048 || strings.IndexFunc(value, unicode.IsSpace) >= 0 || parsed == nil ||
		(parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Hostname() == "" || parsed.User != nil {
		return "", sharederror.New(sharederror.KindValidation, "球场图片必须是有效的 HTTP(S) URL")
	}
	return value, nil
}
