package application

import (
	"context"
	"errors"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

type fakeImageStore struct {
	url string
	key string
	err error
}

func (f *fakeImageStore) Save(_ context.Context, key, _ string, _ []byte) (string, error) {
	f.key = key
	return f.url, f.err
}

func TestImageServiceUploadsAndSetsImage(t *testing.T) {
	repository := &fakeRepository{}
	store := &fakeImageStore{url: "https://cdn.example.com/venue.webp"}
	service := NewImageService(repository, store)
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}
	imageURL, err := service.Upload(context.Background(), admin, imagefixture.WebP())
	if err != nil || imageURL != store.url || store.key == "" || len(store.key) < len("venue-images/") || store.key[:len("venue-images/")] != "venue-images/" {
		t.Fatalf("url=%q key=%q err=%v", imageURL, store.key, err)
	}
	if err := service.SetImage(context.Background(), admin, " 体育公园 ", " "+imageURL+" "); err != nil {
		t.Fatalf("set image: %v", err)
	}
	if repository.imageName != "体育公园" || repository.imageURL != imageURL {
		t.Fatalf("saved %q %q", repository.imageName, repository.imageURL)
	}
	if err := service.SetImage(context.Background(), admin, "体育公园", ""); err != nil || repository.imageURL != "" {
		t.Fatalf("clear image: %q %v", repository.imageURL, err)
	}
}

func TestImageServiceRejectsInvalidInputAndWrapsFailures(t *testing.T) {
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}
	user := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 7}
	service := NewImageService(&fakeRepository{}, &fakeImageStore{})
	if _, err := service.Upload(context.Background(), user, imagefixture.WebP()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("user upload: %v", err)
	}
	for _, data := range [][]byte{nil, []byte("<svg/>"), make([]byte, MaxImageUploadBytes+1), imagefixture.PNG()[:33]} {
		if _, err := service.Upload(context.Background(), admin, data); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("invalid upload: %v", err)
		}
	}
	if err := service.SetImage(context.Background(), admin, "", ""); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("empty name: %v", err)
	}
	if err := service.SetImage(context.Background(), admin, "体育公园", "javascript:alert(1)"); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("invalid URL: %v", err)
	}
	store := &fakeImageStore{err: errors.New("unavailable")}
	if _, err := NewImageService(&fakeRepository{}, store).Upload(context.Background(), admin, imagefixture.WebP()); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("store error: %v", err)
	}
	repository := &fakeRepository{err: errors.New("unavailable")}
	if err := NewImageService(repository, store).SetImage(context.Background(), admin, "体育公园", ""); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("repository error: %v", err)
	}
}
