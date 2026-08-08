package userhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
)

func TestAppHandlerGetsAndUpdatesCurrentUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	realName := "王睿"
	service := &fakeAppUsers{user: domain.User{ID: 37, Nickname: "王睿", RealName: &realName, Status: domain.StatusActive}}
	handler := NewAppHandler(service)
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAppUserTokens{}).RequireUser())
	handler.RegisterAppRoutes(group)

	getResponse := performAppUserRequest(router, http.MethodGet, "/users/me", "")
	if getResponse.Code != http.StatusOK || !bytes.Contains(getResponse.Body.Bytes(), []byte(`"id":37`)) {
		t.Fatalf("GET response %d: %s", getResponse.Code, getResponse.Body.String())
	}
	patchResponse := performAppUserRequest(router, http.MethodPatch, "/users/me", `{"nickname":"新昵称"}`)
	if patchResponse.Code != http.StatusOK || service.command.Nickname == nil || *service.command.Nickname != "新昵称" {
		t.Fatalf("PATCH response=%d body=%s command=%+v", patchResponse.Code, patchResponse.Body.String(), service.command)
	}
}

func TestAppHandlerRejectsEmptyPatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewAppHandler(&fakeAppUsers{user: domain.User{ID: 37, Status: domain.StatusActive}})
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAppUserTokens{}).RequireUser())
	handler.RegisterAppRoutes(group)
	response := performAppUserRequest(router, http.MethodPatch, "/users/me", `{}`)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("response=%d body=%s", response.Code, response.Body.String())
	}
}

func performAppUserRequest(router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

type fakeAppUsers struct {
	user    domain.User
	command application.UpdateMeCommand
}

func (f *fakeAppUsers) GetMe(context.Context, sharedauth.Actor) (domain.User, error) {
	return f.user, nil
}
func (f *fakeAppUsers) UpdateMe(_ context.Context, _ sharedauth.Actor, command application.UpdateMeCommand) (domain.User, error) {
	f.command = command
	if command.Nickname != nil {
		f.user.Nickname = *command.Nickname
	}
	return f.user, nil
}

type fakeAppUserTokens struct{}

func (fakeAppUserTokens) IssueUser(context.Context, int64) (string, error)        { return "", nil }
func (fakeAppUserTokens) IssueAdmin(context.Context, int64, bool) (string, error) { return "", nil }
func (fakeAppUserTokens) Parse(context.Context, string) (sharedauth.Actor, error) {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}, nil
}
