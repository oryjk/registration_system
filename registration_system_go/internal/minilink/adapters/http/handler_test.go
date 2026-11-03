package minilinkhttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeService struct {
	returnQuery string
	err         error
}

func (f *fakeService) ChanlunLink(_ context.Context, returnQuery string) (string, error) {
	f.returnQuery = returnQuery
	return "https://wxaurl.cn/abc", f.err
}

func serve(handler *Handler, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler.RegisterPublicRoutes(router.Group(""))
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/mini-links/chanlun", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)
	return response
}

func TestChanlunLinkReturnsURLAndPassesReturnQuery(t *testing.T) {
	service := &fakeService{}
	response := serve(NewHandler(service), `{"return_query":"secid=1.600519"}`)

	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"url":"https://wxaurl.cn/abc"`)) {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
	if service.returnQuery != "secid=1.600519" {
		t.Fatalf("return query not forwarded: %q", service.returnQuery)
	}
}

func TestChanlunLinkAcceptsEmptyBody(t *testing.T) {
	service := &fakeService{}
	if response := serve(NewHandler(service), ""); response.Code != http.StatusOK {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}

func TestChanlunLinkMapsValidationErrorToUnprocessable(t *testing.T) {
	service := &fakeService{err: sharederror.New(sharederror.KindValidation, "回跳参数不合法")}
	if response := serve(NewHandler(service), `{"return_query":"https://evil.test"}`); response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unexpected response %d: %s", response.Code, response.Body.String())
	}
}
