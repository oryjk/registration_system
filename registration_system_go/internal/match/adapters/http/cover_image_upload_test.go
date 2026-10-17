package matchhttp

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

type coverUploadStore struct{ err error }

func (s coverUploadStore) Save(context.Context, string, string, []byte) (string, error) {
	return "https://cdn.example.com/cover.webp", s.err
}

type coverUploadTokens struct{ actor sharedauth.Actor }

func (s coverUploadTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (s coverUploadTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (s coverUploadTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return s.actor, nil
}

func TestAdminCoverImageUploadRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tt := range []struct {
		name       string
		actor      sharedauth.Actor
		authorized bool
		data       []byte
		missing    bool
		storeError error
		want       int
	}{
		{name: "success", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, data: imagefixture.WebP(), want: 200},
		{name: "unauthenticated", want: 401},
		{name: "user forbidden", actor: sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 7}, authorized: true, want: 403},
		{name: "missing file", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, missing: true, want: 422},
		{name: "truncated image", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, data: imagefixture.PNG()[:33], want: 422},
		{name: "fake extension", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, data: []byte("<svg/>"), want: 422},
		{name: "oversize", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, data: make([]byte, 2<<20+1), want: 422},
		{name: "storage failed", actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}, authorized: true, data: imagefixture.WebP(), storeError: errors.New("unavailable"), want: 500},
	} {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewAdminHandler(&fakeAdminMatches{}, &fakeCreateMatch{}, application.NewCoverImageService(coverUploadStore{err: tt.storeError}))
			router := gin.New()
			handler.RegisterRoutes(router.Group("/api/v1/admin", authhttp.NewMiddleware(coverUploadTokens{actor: tt.actor}).RequireAdmin()))
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			if !tt.missing {
				field, err := writer.CreateFormFile("file", "untrusted.png")
				if err != nil {
					t.Fatal(err)
				}
				if _, err := field.Write(tt.data); err != nil {
					t.Fatal(err)
				}
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/matches/cover-images", &body)
			request.Header.Set("Content-Type", writer.FormDataContentType())
			if tt.authorized {
				request.Header.Set("Authorization", "Bearer actor")
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tt.want {
				t.Fatalf("status=%d want=%d body=%s", response.Code, tt.want, response.Body.String())
			}
			if tt.want == 200 && !bytes.Contains(response.Body.Bytes(), []byte(`"data":{"image_url":"https://cdn.example.com/cover.webp"}`)) {
				t.Fatalf("missing uploaded URL: %s", response.Body.String())
			}
		})
	}
}
