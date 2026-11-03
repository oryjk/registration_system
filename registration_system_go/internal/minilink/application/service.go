package application

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/minilink/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/minilink/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// Service 签发拉起小程序的外链；只开放白名单落地页，不接受任意页面路径。
type Service struct {
	generator ports.URLLinkGenerator
}

func NewService(generator ports.URLLinkGenerator) *Service {
	return &Service{generator: generator}
}

// ChanlunLink 生成打开缠观落地页的 URL Link，returnQuery 为登录后回到缠观时附带的查询串。
func (s *Service) ChanlunLink(ctx context.Context, returnQuery string) (string, error) {
	target, err := domain.NewChanlunLinkTarget(returnQuery)
	if err != nil {
		return "", err
	}
	link, err := s.generator.GenerateURLLink(ctx, target.Path, target.Query)
	if err != nil {
		return "", sharederror.Wrap(sharederror.KindInternal, "生成小程序链接失败", err)
	}
	return link, nil
}
