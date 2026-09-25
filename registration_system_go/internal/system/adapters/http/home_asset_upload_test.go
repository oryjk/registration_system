package systemhttp

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	systemapplication "github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// uploadFakeRepo / uploadFakeStore 让上传 handler 测试走真实 application 用例，
// 只把对象存储与数据库换成内存实现。

type uploadFakeRepo struct {
	sections  map[string]map[string]any
	upsertErr error
}

func (r *uploadFakeRepo) FindSetting(_ context.Context, key string) (map[string]any, bool, error) {
	section, found := r.sections[key]
	if !found {
		return nil, false, nil
	}
	return section, true, nil
}

func (r *uploadFakeRepo) UpsertSetting(_ context.Context, key string, value map[string]any) error {
	if r.upsertErr != nil {
		return r.upsertErr
	}
	r.sections[key] = value
	return nil
}

type uploadFakeStore struct {
	savedKey   string
	savedCount int
	saveErr    error
}

func (s *uploadFakeStore) Save(_ context.Context, key, _ string, _ []byte) (string, error) {
	if s.saveErr != nil {
		return "", s.saveErr
	}
	s.savedKey = key
	s.savedCount++
	return fmt.Sprintf("https://cdn.example.com/%s", key), nil
}

func newUploadRouter(t *testing.T, store ports.AssetStore, repo *uploadFakeRepo) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	settings := systemapplication.NewSettingsService(repo)
	homeAssets := systemapplication.NewHomeAssetService(store, settings)
	router := gin.New()
	NewHandler(settings, homeAssets).RegisterAdminRoutes(router.Group("/api/v1/admin"))
	return router
}

// createFormFile 与 multipart.Writer.CreateFormFile 等价，但允许自定义 part 的 Content-Type
// （浏览器上传会带真实类型，CreateFormFile 固定 octet-stream 无法覆盖）。
func createFormFile(writer *multipart.Writer, field, fileName, contentType string) io.Writer {
	part, _ := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {fmt.Sprintf(`form-data; name="%s"; filename="%s"`, field, fileName)},
		"Content-Type":        {contentType},
	})
	return part
}

func multipartUploadRequest(path, contentType, fileName string, data []byte) *http.Request {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part := createFormFile(writer, "file", fileName, contentType)
	_, _ = part.Write(data)
	_ = writer.Close()
	request := httptest.NewRequest(http.MethodPost, path, &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request
}

const uploadPath = "/api/v1/admin/system/mini-app-settings/home/next-match-social-image"

func validPNG() []byte {
	return append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, []byte("fake-png-body")...)
}

func TestUploadHomeNextMatchSocialImageSucceeds(t *testing.T) {
	store := &uploadFakeStore{}
	repo := &uploadFakeRepo{sections: map[string]map[string]any{}}
	router := newUploadRouter(t, store, repo)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, multipartUploadRequest(uploadPath, "image/png", "social.png", validPNG()))
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if store.savedCount != 1 || !strings.HasPrefix(store.savedKey, "static/home/next-match-social/") {
		t.Fatalf("asset store not called with controlled key: %+v", store)
	}
	if !strings.Contains(response.Body.String(), fmt.Sprintf("\"next_match_social_image_url\":\"https://cdn.example.com/%s\"", store.savedKey)) {
		t.Fatalf("response should carry uploaded URL: %s", response.Body.String())
	}
	if repo.sections[domain.SettingsSectionHome]["next_match_social_image_url"] != "https://cdn.example.com/"+store.savedKey {
		t.Fatalf("URL should be persisted: %+v", repo.sections)
	}
}

func TestUploadHomeNextMatchSocialImageRequiresFileField(t *testing.T) {
	router := newUploadRouter(t, &uploadFakeStore{}, &uploadFakeRepo{sections: map[string]map[string]any{}})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/system/mini-app-settings/home/next-match-social-image", strings.NewReader("not-a-form"))
	request.Header.Set("Content-Type", "multipart/form-data; boundary=x")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("missing file should fail validation: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestUploadHomeNextMatchSocialImageRejectsNonImage(t *testing.T) {
	store := &uploadFakeStore{}
	router := newUploadRouter(t, store, &uploadFakeRepo{sections: map[string]map[string]any{}})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, multipartUploadRequest(uploadPath, "image/gif", "social.gif", []byte("gif")))
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("gif should fail validation: status=%d body=%s", response.Code, response.Body.String())
	}
	if store.savedCount != 0 {
		t.Fatal("rejected upload must not reach the asset store")
	}
}

func TestUploadHomeNextMatchSocialImageRejectsOversize(t *testing.T) {
	store := &uploadFakeStore{}
	router := newUploadRouter(t, store, &uploadFakeRepo{sections: map[string]map[string]any{}})

	oversize := make([]byte, systemapplication.MaxHomeAssetUploadBytes+1)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, multipartUploadRequest(uploadPath, "image/png", "social.png", oversize))
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("oversize should fail validation: status=%d body=%s", response.Code, response.Body.String())
	}
	if store.savedCount != 0 {
		t.Fatal("rejected upload must not reach the asset store")
	}
}

func TestUploadHomeNextMatchSocialImageFailsWithoutBrokenPersist(t *testing.T) {
	store := &uploadFakeStore{saveErr: errors.New("minio down")}
	repo := &uploadFakeRepo{sections: map[string]map[string]any{}}
	router := newUploadRouter(t, store, repo)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, multipartUploadRequest(uploadPath, "image/png", "social.png", validPNG()))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("store failure should be internal error: status=%d body=%s", response.Code, response.Body.String())
	}
	if _, saved := repo.sections[domain.SettingsSectionHome]; saved {
		t.Fatal("store failure must not persist any URL")
	}
}

func TestUploadHomeNextMatchSocialImageReportsPersistFailure(t *testing.T) {
	store := &uploadFakeStore{}
	repo := &uploadFakeRepo{sections: map[string]map[string]any{}, upsertErr: errors.New("db down")}
	router := newUploadRouter(t, store, repo)

	response := httptest.NewRecorder()
	router.ServeHTTP(response, multipartUploadRequest(uploadPath, "image/png", "social.png", validPNG()))
	if response.Code != http.StatusInternalServerError {
		t.Fatalf("persist failure should be internal error: status=%d body=%s", response.Code, response.Body.String())
	}
}
