package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestVenueSuggestionServiceListsForLoggedInUsers(t *testing.T) {
	repository := &fakeVenueSuggestionRepository{
		items: []ports.VenueSuggestion{
			{Location: "驿马河二期", UseCount: 63, LastUsedAt: testTime("2026-08-06T12:00:00Z")},
			{Location: "悦享动运动公园", Latitude: venuePtr(30.6), Longitude: venuePtr(104.1), UseCount: 11, LastUsedAt: testTime("2026-09-10T12:00:00Z")},
		},
	}
	service := NewVenueSuggestionService(repository)

	items, err := service.Suggestions(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 10)
	if err != nil || len(items) != 2 || items[0].Location != "驿马河二期" || items[1].Latitude == nil {
		t.Fatalf("items=%+v err=%v", items, err)
	}

	// 未登录与非用户受众不可用。
	if _, err := service.Suggestions(context.Background(), sharedauth.Actor{}, 10); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("expected unauthorized anonymous, got %v", err)
	}
	if _, err := service.Suggestions(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}, 10); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden admin audience, got %v", err)
	}

	// 上限钳制：默认 10，负数按 10 处理，超大值截到 20。
	if limit := service.normalizeLimit(0); limit != 10 {
		t.Fatalf("expected default limit 10, got %d", limit)
	}
	if limit := service.normalizeLimit(99); limit != 20 {
		t.Fatalf("expected max limit 20, got %d", limit)
	}
	if repository.requestedLimit != 10 {
		t.Fatalf("expected repository limit 10, got %d", repository.requestedLimit)
	}
}

func TestVenueSuggestionServiceWrapsRepositoryError(t *testing.T) {
	repository := &fakeVenueSuggestionRepository{err: errors.New("boom")}
	_, err := NewVenueSuggestionService(repository).Suggestions(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 10)
	if err == nil || !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("expected internal error, got %v", err)
	}
}

func testTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return parsed
}

type fakeVenueSuggestionRepository struct {
	items          []ports.VenueSuggestion
	err            error
	requestedLimit int32
}

func venuePtr[T any](value T) *T {
	return &value
}

func (f *fakeVenueSuggestionRepository) ListVenueSuggestions(_ context.Context, limit int32) ([]ports.VenueSuggestion, error) {
	f.requestedLimit = limit
	if f.err != nil {
		return nil, f.err
	}
	return f.items, nil
}
