package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

type coverTestStore struct {
	key, contentType string
	data             []byte
	err              error
}

func (s *coverTestStore) Save(_ context.Context, key, contentType string, data []byte) (string, error) {
	s.key, s.contentType, s.data = key, contentType, data
	if s.err != nil {
		return "", s.err
	}
	return "https://cdn.example.com/" + key, nil
}

func TestCoverImageUploadDetectsContent(t *testing.T) {
	for _, tt := range []struct {
		name             string
		data             []byte
		contentType, ext string
	}{
		{"png", imagefixture.PNG(), "image/png", ".png"},
		{"jpeg", imagefixture.JPEG(), "image/jpeg", ".jpg"},
		{"webp", imagefixture.WebP(), "image/webp", ".webp"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &coverTestStore{}
			url, err := NewCoverImageService(store).Upload(context.Background(), adminActor(3), tt.data)
			if err != nil || !strings.HasPrefix(url, "https://cdn.example.com/match-covers/") || !strings.HasSuffix(url, tt.ext) || store.contentType != tt.contentType || string(store.data) != string(tt.data) {
				t.Fatalf("url=%s contentType=%s err=%v", url, store.contentType, err)
			}
		})
	}
}

func TestCoverImageUploadRejectsInvalidInputAndUnauthorized(t *testing.T) {
	for _, tt := range []struct {
		name  string
		actor sharedauth.Actor
		data  []byte
	}{
		{"unauthorized", sharedauth.Actor{}, imagefixture.PNG()},
		{"user", userActor(3), imagefixture.PNG()},
		{"empty", adminActor(3), nil},
		{"oversize", adminActor(3), make([]byte, 2<<20+1)},
		{"svg", adminActor(3), []byte("<svg/>")},
		{"html", adminActor(3), []byte("<html/>")},
		{"gif", adminActor(3), []byte("GIF89a")},
		{"forged png header", adminActor(3), []byte("\x89PNG\r\n\x1a\n")},
		{"png without pixels", adminActor(3), imagefixture.PNG()[:33]},
		{"jpeg without pixels", adminActor(3), imagefixture.JPEG()[:180]},
		{"excessive pixel budget", adminActor(3), imagefixture.OverBudgetPNG()},
	} {
		t.Run(tt.name, func(t *testing.T) {
			store := &coverTestStore{}
			_, err := NewCoverImageService(store).Upload(context.Background(), tt.actor, tt.data)
			if err == nil || store.key != "" {
				t.Fatalf("must reject before storage: err=%v key=%q", err, store.key)
			}
			if !tt.actor.IsAdmin() && !errors.Is(err, sharederror.ErrForbidden) {
				t.Fatalf("expected forbidden: %v", err)
			}
		})
	}
}

func TestCoverImageUploadReportsUnavailableStorage(t *testing.T) {
	data := imagefixture.PNG()
	if _, err := NewCoverImageService(nil).Upload(context.Background(), adminActor(3), data); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("nil store must return internal error: %v", err)
	}
	if _, err := NewCoverImageService(&coverTestStore{err: errors.New("unavailable")}).Upload(context.Background(), adminActor(3), data); !errors.Is(err, sharederror.ErrInternal) {
		t.Fatalf("store failure must return internal error: %v", err)
	}
}
