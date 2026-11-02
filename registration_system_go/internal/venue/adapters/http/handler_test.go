package venuehttp

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
	"github.com/oryjk/registration_system/registration_system_go/internal/venue/domain"
)

type fakeTokens struct{ actor sharedauth.Actor }

func (fakeTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (f fakeTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return f.actor, nil
}

type fakeQuery struct{ items []domain.Venue }

func (f fakeQuery) Suggestions(context.Context, sharedauth.Actor, int) ([]domain.Venue, error) {
	return f.items, nil
}
func (f fakeQuery) Map(context.Context, sharedauth.Actor) ([]domain.Venue, error) {
	return f.items, nil
}
func (f fakeQuery) ListForAdmin(context.Context, sharedauth.Actor) ([]domain.Venue, error) {
	return f.items, nil
}

type fakeImages struct{ name, imageURL string }

func (fakeImages) Upload(context.Context, sharedauth.Actor, []byte) (string, error) {
	return "https://cdn.example.com/venue.webp", nil
}
func (f *fakeImages) SetImage(_ context.Context, _ sharedauth.Actor, name, imageURL string) error {
	f.name, f.imageURL = name, imageURL
	return nil
}

func TestUserRoutesRetainContractAndIncludeImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	latitude, longitude := 30.6, 104.1
	handler := NewHandler(fakeQuery{items: []domain.Venue{{Name: "体育公园", Latitude: &latitude, Longitude: &longitude, ImageURL: "https://cdn.example.com/venue.webp"}}})
	router := gin.New()
	handler.RegisterUserRoutes(router.Group("", authhttp.NewMiddleware(fakeTokens{actor: sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 3}}).RequireUser()))
	for _, path := range []string{"/venues/map", "/venues/suggestions?limit=10"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		request.Header.Set("Authorization", "Bearer user-token")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s status=%d body=%s", path, response.Code, response.Body.String())
		}
		var payload struct {
			Data []VenueResponse `json:"data"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Data) != 1 || payload.Data[0].Location != "体育公园" || payload.Data[0].ImageURL == "" {
			t.Fatalf("unexpected response %+v", payload.Data)
		}
	}
}

func TestAdminListUploadAndSetImageRoutes(t *testing.T) {
	images := &fakeImages{}
	handler := NewHandler(fakeQuery{}, images)
	router := gin.New()
	handler.RegisterAdminRoutes(router.Group("/api/v1/admin", authhttp.NewMiddleware(fakeTokens{actor: sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 7}}).RequireAdmin()))

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	field, err := writer.CreateFormFile("file", "venue.webp")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := field.Write(imagefixture.WebP()); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/venues/images", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer admin-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"image_url":"https://cdn.example.com/venue.webp"`)) {
		t.Fatalf("upload status=%d body=%s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPut, "/api/v1/admin/venues/image", bytes.NewBufferString(`{"location":"体育公园","image_url":"https://cdn.example.com/venue.webp"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer admin-token")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || images.name != "体育公园" || images.imageURL == "" {
		t.Fatalf("set status=%d body=%s image=%+v", response.Code, response.Body.String(), images)
	}
}
