package domain

import (
	"strings"
	"unicode/utf8"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// CaptainMessageContentMaxRuneCount 留言长度上限，对齐接约申请 introduction 的 200 字口径。
const CaptainMessageContentMaxRuneCount = 200

// NewCaptainMessageContent 校验留言文本：去除首尾空白后非空且不超过 200 字。
func NewCaptainMessageContent(content string) (string, error) {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return "", sharederror.New(sharederror.KindValidation, "留言内容不能为空")
	}
	if utf8.RuneCountInString(trimmed) > CaptainMessageContentMaxRuneCount {
		return "", sharederror.New(sharederror.KindValidation, "留言内容不能超过 200 字")
	}
	return trimmed, nil
}
