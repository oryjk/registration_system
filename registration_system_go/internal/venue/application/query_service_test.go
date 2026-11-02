package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
)

type fakeRepository struct {
	items          []domain.Venue
	err            error
	requestedLimit int32
	imageName      string
	imageURL       string
}

func (f *fakeRepository) ListSuggestions(_ context.Context, limit int32) ([]domain.Venue, error) {
	f.requestedLimit = limit
	return f.items, f.err
}
func (f *fakeRepository) ListMap(context.Context) ([]domain.Venue, error) { return f.items, f.err }
func (f *fakeRepository) SetImage(_ context.Context, name, imageURL string) error {
	f.imageName, f.imageURL = name, imageURL
	return f.err
}

func TestQueryServiceRoutesAudiencesAndLimits(t *testing.T) {
	latitude, longitude := 30.6, 104.1
	repository := &fakeRepository{items: []domain.Venue{{Name: "体育公园", Latitude: &latitude, Longitude: &longitude, ImageURL: "https://cdn.example.com/venue.webp"}}}
	service := NewQueryService(repository)
	user := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}
	items, err := service.Suggestions(context.Background(), user, 99)
	if err != nil || len(items) != 1 || items[0].ImageURL == "" || repository.requestedLimit != 20 {
		t.Fatalf("items=%+v limit=%d err=%v", items, repository.requestedLimit, err)
	}
	if _, err := service.Map(context.Background(), user); err != nil {
		t.Fatalf("map: %v", err)
	}
	if _, err := service.ListForAdmin(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}); err != nil {
		t.Fatalf("admin list: %v", err)
	}
	if _, err := service.Map(context.Background(), sharedauth.Actor{}); !errors.Is(err, sharederror.ErrUnauthorized) {
		t.Fatalf("anonymous: %v", err)
	}
	if _, err := service.Map(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("admin user map: %v", err)
	}
	if _, err := service.ListForAdmin(context.Background(), user); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("user admin list: %v", err)
	}
	repository.err = errors.New("database unavailable")
	if _, err := service.Map(context.Background(), user); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("repository error: %v", err)
	}
}
