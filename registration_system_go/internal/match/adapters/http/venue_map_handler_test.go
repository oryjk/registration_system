package matchhttp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
)

type fakeVenueMapUseCase struct{}

func (fakeVenueMapUseCase) Map(context.Context, sharedauth.Actor) ([]ports.VenueSuggestion, error) {
	lat, lng := 30.6, 104.1
	return []ports.VenueSuggestion{{Location: "体育公园", Latitude: &lat, Longitude: &lng}}, nil
}
func (fakeVenueMapUseCase) Suggestions(context.Context, sharedauth.Actor, int) ([]ports.VenueSuggestion, error) {
	return []ports.VenueSuggestion{}, nil
}

func TestVenueMapRouteAndLegacySuggestions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	NewVenueSuggestionHandler(fakeVenueMapUseCase{}).RegisterRoutes(group)
	request := httptest.NewRequest(http.MethodGet, "/venues/map", nil)
	denied := httptest.NewRecorder()
	router.ServeHTTP(denied, request)
	if denied.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status %d", denied.Code)
	}
	request.Header.Set("Authorization", "Bearer user-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("map status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Data []VenueSuggestionResponse `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Data) != 1 || payload.Data[0].Location != "体育公园" || payload.Data[0].Latitude == nil || *payload.Data[0].Latitude != 30.6 {
		t.Fatalf("unexpected map response %+v", payload)
	}
	legacy := captainMessageRequest(router, http.MethodGet, "/venues/suggestions?limit=10", "")
	if legacy.Code != http.StatusOK {
		t.Fatalf("legacy endpoint status %d", legacy.Code)
	}
}
