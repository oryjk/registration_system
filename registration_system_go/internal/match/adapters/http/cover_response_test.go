package matchhttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

func TestMatchResponsesExposeDefaultCover(t *testing.T) {
	for name, response := range map[string]any{"admin": mapMatch(ports.AdminMatchItem{}), "app": mapUserMatch(ports.MatchItem{})} {
		t.Run(name, func(t *testing.T) {
			data, err := json.Marshal(response)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]any
			if err := json.Unmarshal(data, &fields); err != nil {
				t.Fatal(err)
			}
			if value, exists := fields["cover_image_url"]; !exists || value != "" {
				t.Fatalf("default cover must be an empty string; got %v exists=%v", value, exists)
			}
		})
	}
}

func TestAdminCoverImageRequestTriState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tt := range []struct {
		name, fields string
		want         *string
	}{
		{name: "omitted"}, {name: "null", fields: `,"cover_image_url":null`},
		{name: "clear", fields: `,"cover_image_url":""`, want: stringForCover("")},
		{name: "custom", fields: `,"cover_image_url":"https://example.com/cover.webp"`, want: stringForCover("https://example.com/cover.webp")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			id := uuid.New()
			service := &fakeAdminMatches{}
			handler := NewAdminHandler(service, &fakeCreateMatch{})
			router := gin.New()
			group := router.Group("/api/v1/admin", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin())
			handler.RegisterRoutes(group)
			body := `{"name":"比赛","start_time":"2026-08-22T10:00:00Z","end_time":"2026-08-22T12:00:00Z","location":"球场"` + tt.fields + `}`
			request := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/matches/"+id.String(), bytes.NewBufferString(body))
			request.Header.Set("Authorization", "Bearer admin")
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			got := service.update.CoverImageURL
			if tt.want == nil {
				if got != nil {
					t.Fatalf("omitted/null must preserve: %v", got)
				}
			} else if got == nil || *got != *tt.want {
				t.Fatalf("cover not forwarded: got=%v want=%v", got, tt.want)
			}
		})
	}
}
func stringForCover(value string) *string { return &value }

func TestCoverImageResponsesAcrossAppAndAdminRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, cover := range []string{"", "https://example.com/custom.webp"} {
		t.Run(cover, func(t *testing.T) {
			match := domain.Match{ID: uuid.New(), CoverImageURL: cover}
			item := ports.MatchItem{Match: match}
			appService := &fakeUserMatches{
				list:   application.UserMatchListResult{Items: []ports.MatchItem{item}},
				detail: application.UserMatchDetail{Item: item},
				home:   application.UserMatchHomeResult{ActionItems: []ports.HomeMatchItem{{Item: item}}, EndedItems: []ports.MatchItem{item}},
			}
			adminItem := ports.AdminMatchItem{Match: match}
			adminService := &fakeAdminMatches{list: application.AdminMatchListResult{Items: []ports.AdminMatchItem{adminItem}}, detail: application.AdminMatchDetail{Item: adminItem}}
			router := gin.New()
			NewUserHandler(appService, nil, nil, nil, nil).RegisterRoutes(router.Group("/app", authhttp.NewMiddleware(fakeUserTokens{}).RequireUser()))
			NewAdminHandler(adminService, &fakeCreateMatch{}).RegisterRoutes(router.Group("/admin", authhttp.NewMiddleware(fakeAdminTokens{}).RequireAdmin()))
			for _, path := range []string{"/app/matches", "/app/matches/" + match.ID.String(), "/app/matches/home", "/admin/matches", "/admin/matches/" + match.ID.String()} {
				request := httptest.NewRequest(http.MethodGet, path, nil)
				request.Header.Set("Authorization", "Bearer actor")
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"cover_image_url":"`+cover+`"`)) {
					t.Fatalf("path=%s cover=%q status=%d body=%s", path, cover, response.Code, response.Body.String())
				}
				if path == "/app/matches/home" && bytes.Count(response.Body.Bytes(), []byte(`"cover_image_url"`)) != 2 {
					t.Fatalf("both home sections must expose cover: %s", response.Body.String())
				}
			}
		})
	}
}
