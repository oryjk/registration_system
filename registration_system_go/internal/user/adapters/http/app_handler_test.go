package userhttp

import (
	"bytes"
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
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
	handler := NewAppHandler(service, nil, "")
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAppUserTokens{}).RequireUser())
	handler.RegisterAppRoutes(group)

	getResponse := performAppUserRequest(router, http.MethodGet, "/users/me", "")
	if getResponse.Code != http.StatusOK || !bytes.Contains(getResponse.Body.Bytes(), []byte(`"id":37`)) {
		t.Fatalf("GET response %d: %s", getResponse.Code, getResponse.Body.String())
	}
	patchResponse := performAppUserRequest(router, http.MethodPatch, "/users/me", `{"nickname":"新昵称","avatar_url":"https://example.test/a.png"}`)
	if patchResponse.Code != http.StatusOK || service.command.Nickname == nil || *service.command.Nickname != "新昵称" ||
		service.command.AvatarURL == nil || *service.command.AvatarURL != "https://example.test/a.png" {
		t.Fatalf("PATCH response=%d body=%s command=%+v", patchResponse.Code, patchResponse.Body.String(), service.command)
	}
}

func TestAppHandlerUploadsAvatar(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeAppUsers{user: domain.User{ID: 37, Status: domain.StatusActive}}
	uploader := &fakeAvatarUploader{path: "/uploads/avatars/37-1.png"}
	handler := NewAppHandler(service, uploader, "https://cdn.example.test")
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAppUserTokens{}).RequireUser())
	handler.RegisterAppRoutes(group)

	response := performAvatarUpload(router, "/users/me/avatar", "avatar.png", "image/png", []byte("png-bytes"))
	if response.Code != http.StatusOK {
		t.Fatalf("upload response=%d body=%s", response.Code, response.Body.String())
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"avatar_url":"https://cdn.example.test/uploads/avatars/37-1.png"`)) {
		t.Fatalf("unexpected upload body: %s", response.Body.String())
	}
	if uploader.userID != 37 || uploader.extension != "png" || string(uploader.data) != "png-bytes" {
		t.Fatalf("unexpected stored avatar: %+v", uploader)
	}
	if service.command.AvatarURL == nil || *service.command.AvatarURL != "https://cdn.example.test/uploads/avatars/37-1.png" {
		t.Fatalf("avatar url not persisted: %+v", service.command)
	}

	// 已发布小程序使用的旧路径行为一致。
	legacyResponse := performAvatarUpload(router, "/user/avatar", "avatar.jpg", "image/jpeg", []byte("jpg-bytes"))
	if legacyResponse.Code != http.StatusOK ||
		!bytes.Contains(legacyResponse.Body.Bytes(), []byte(`"avatar_url":"https://cdn.example.test/uploads/avatars/37-1.png"`)) {
		t.Fatalf("legacy upload response=%d body=%s", legacyResponse.Code, legacyResponse.Body.String())
	}
}

func TestAppHandlerRejectsUnsupportedAvatar(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewAppHandler(&fakeAppUsers{user: domain.User{ID: 37, Status: domain.StatusActive}}, &fakeAvatarUploader{}, "")
	router := gin.New()
	group := router.Group("")
	group.Use(authhttp.NewMiddleware(fakeAppUserTokens{}).RequireUser())
	handler.RegisterAppRoutes(group)

	response := performAvatarUpload(router, "/users/me/avatar", "notes.txt", "text/plain", []byte("hello"))
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("response=%d body=%s", response.Code, response.Body.String())
	}
}

func performAvatarUpload(router http.Handler, path, fileName, contentType string, data []byte) *httptest.ResponseRecorder {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {fmt.Sprintf(`form-data; name="file"; filename="%s"`, fileName)},
		"Content-Type":        {contentType},
	})
	if err != nil {
		panic(err)
	}
	if _, err := part.Write(data); err != nil {
		panic(err)
	}
	if err := writer.Close(); err != nil {
		panic(err)
	}
	request := httptest.NewRequest(http.MethodPost, path, &body)
	request.Header.Set("Authorization", "Bearer user-token")
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

type fakeAvatarUploader struct {
	userID    int64
	extension string
	data      []byte
	path      string
}

func (f *fakeAvatarUploader) SaveUserAvatar(userID int64, extension string, data []byte) (string, error) {
	f.userID, f.extension, f.data = userID, extension, data
	return f.path, nil
}

func TestAppHandlerRejectsEmptyPatch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewAppHandler(&fakeAppUsers{user: domain.User{ID: 37, Status: domain.StatusActive}}, nil, "")
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
