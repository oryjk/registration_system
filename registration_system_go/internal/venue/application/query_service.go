package application

import (
	"context"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/ports"
)

type QueryService struct {
	repository ports.Repository
}

func NewQueryService(repository ports.Repository) QueryService {
	return QueryService{repository: repository}
}

func (s QueryService) Suggestions(ctx context.Context, actor sharedauth.Actor, limit int) ([]domain.Venue, error) {
	if err := requireUser(actor); err != nil {
		return nil, err
	}
	items, err := s.repository.ListSuggestions(ctx, normalizeLimit(limit))
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询常用场地失败", err)
	}
	return items, nil
}

func (s QueryService) Map(ctx context.Context, actor sharedauth.Actor) ([]domain.Venue, error) {
	if err := requireUser(actor); err != nil {
		return nil, err
	}
	return s.listMap(ctx, "查询球场地图失败")
}

func (s QueryService) ListForAdmin(ctx context.Context, actor sharedauth.Actor) ([]domain.Venue, error) {
	if !actor.IsAdmin() {
		return nil, sharederror.ErrForbidden
	}
	return s.listMap(ctx, "查询球场列表失败")
}

func (s QueryService) listMap(ctx context.Context, message string) ([]domain.Venue, error) {
	items, err := s.repository.ListMap(ctx)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, message, err)
	}
	return items, nil
}

func requireUser(actor sharedauth.Actor) error {
	if actor.Kind == "" {
		return sharederror.ErrUnauthorized
	}
	if !actor.IsUser() {
		return sharederror.ErrForbidden
	}
	return nil
}

func normalizeLimit(limit int) int32 {
	if limit <= 0 {
		return 10
	}
	if limit > 20 {
		return 20
	}
	return int32(limit)
}
