package application

import (
	"context"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// VenueSuggestionService 常用场地建议：发布比赛时优先选历史场地，减少地图选点 API 消耗。
type VenueSuggestionService struct {
	repository ports.VenueSuggestionRepository
}

func NewVenueSuggestionService(repository ports.VenueSuggestionRepository) *VenueSuggestionService {
	return &VenueSuggestionService{repository: repository}
}

func (s *VenueSuggestionService) Suggestions(ctx context.Context, actor sharedauth.Actor, limit int) ([]ports.VenueSuggestion, error) {
	if actor.Kind == "" {
		return nil, sharederror.ErrUnauthorized
	}
	if !actor.IsUser() {
		return nil, sharederror.ErrForbidden
	}
	items, err := s.repository.ListVenueSuggestions(ctx, s.normalizeLimit(limit))
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询常用场地失败", err)
	}
	return items, nil
}

func (s *VenueSuggestionService) normalizeLimit(limit int) int32 {
	if limit <= 0 {
		return 10
	}
	if limit > 20 {
		return 20
	}
	return int32(limit)
}
