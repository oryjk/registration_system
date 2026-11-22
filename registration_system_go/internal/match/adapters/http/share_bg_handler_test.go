package matchhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authhttp "github.com/oryjk/registration_system/registration_system_go/internal/auth/adapters/http"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

type fakeShareBgService struct {
	actor        sharedauth.Actor
	matchID      uuid.UUID
	uploadData   []byte
	uploadCalls  int
	uploadResult application.ShareBgResult
	uploadErr    error
	selectURL    string
	selectCalls  int
	selectResult application.ShareBgResult
	selectErr    error
	clearCalls   int
	clearResult  application.ShareBgResult
	clearErr     error
}

func (f *fakeShareBgService) Upload(_ context.Context, actor sharedauth.Actor, matchID uuid.UUID, data []byte) (application.ShareBgResult, error) {
	f.actor = actor
	f.matchID = matchID
	f.uploadCalls++
	f.uploadData = append([]byte(nil), data...)
	return f.uploadResult, f.uploadErr
}

func (f *fakeShareBgService) Select(_ context.Context, actor sharedauth.Actor, matchID uuid.UUID, imageURL string) (application.ShareBgResult, error) {
	f.actor = actor
	f.matchID = matchID
	f.selectCalls++
	f.selectURL = imageURL
	return f.selectResult, f.selectErr
}

func (f *fakeShareBgService) Clear(_ context.Context, actor sharedauth.Actor, matchID uuid.UUID) (application.ShareBgResult, error) {
	f.actor = actor
	f.matchID = matchID
	f.clearCalls++
	return f.clearResult, f.clearErr
}

func newShareBgTestRouter(service ShareBgUseCase) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewShareBgHandler(service)
	router := gin.New()
	group := router.Group("/api/v1/app")
	group.Use(authhttp.NewMiddleware(fakeUserTokens{}).RequireUser())
	handler.RegisterRoutes(group)
	return router
}

func TestShareBgHandlerUploadSelectAndClear(t *testing.T) {
	matchID := uuid.New()
	uploadedURL := "https://cdn.example.com/match-share-bgs/0123456789abcdef.webp"
	selectedURL := "https://cdn.example.com/match-share-bgs/fedcba9876543210.png"
	service := &fakeShareBgService{
		uploadResult: application.ShareBgResult{ShareBgImageURL: uploadedURL, ShareBgUnlocked: true},
		selectResult: application.ShareBgResult{ShareBgImageURL: selectedURL, ShareBgUnlocked: true},
		clearResult:  application.ShareBgResult{ShareBgImageURL: "", ShareBgUnlocked: true},
	}
	router := newShareBgTestRouter(service)

	// 1. POST multipart 上传
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	field, err := writer.CreateFormFile("file", "bg.webp")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := field.Write(imagefixture.WebP()); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	uploadReq := httptest.NewRequest(http.MethodPost, "/api/v1/app/matches/"+matchID.String()+"/share-bg", &body)
	uploadReq.Header.Set("Authorization", "Bearer user-token")
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRec := httptest.NewRecorder()
	router.ServeHTTP(uploadRec, uploadReq)
	if uploadRec.Code != http.StatusOK || service.uploadCalls != 1 || service.matchID != matchID {
		t.Fatalf("POST share-bg failed %d calls=%d body=%s", uploadRec.Code, service.uploadCalls, uploadRec.Body.String())
	}
	var uploadEnv struct {
		Code int             `json:"code"`
		Data ShareBgResponse `json:"data"`
	}
	if err := json.Unmarshal(uploadRec.Body.Bytes(), &uploadEnv); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if uploadEnv.Code != 0 || uploadEnv.Data.ShareBgImageURL != uploadedURL || !uploadEnv.Data.ShareBgUnlocked {
		t.Fatalf("unexpected upload payload: %+v", uploadEnv)
	}

	// 2. PUT 从资源库切换
	selectReq := httptest.NewRequest(http.MethodPut, "/api/v1/app/matches/"+matchID.String()+"/share-bg", bytes.NewBufferString(`{"image_url":"`+selectedURL+`"}`))
	selectReq.Header.Set("Authorization", "Bearer user-token")
	selectReq.Header.Set("Content-Type", "application/json")
	selectRec := httptest.NewRecorder()
	router.ServeHTTP(selectRec, selectReq)
	if selectRec.Code != http.StatusOK || service.selectCalls != 1 || service.selectURL != selectedURL {
		t.Fatalf("PUT share-bg failed %d calls=%d url=%q body=%s", selectRec.Code, service.selectCalls, service.selectURL, selectRec.Body.String())
	}
	if !bytes.Contains(selectRec.Body.Bytes(), []byte(`"share_bg_image_url":"`+selectedURL+`"`)) ||
		!bytes.Contains(selectRec.Body.Bytes(), []byte(`"share_bg_unlocked":true`)) {
		t.Fatalf("unexpected select body: %s", selectRec.Body.String())
	}

	// 3. DELETE 清除背景（保留 unlocked）
	clearReq := httptest.NewRequest(http.MethodDelete, "/api/v1/app/matches/"+matchID.String()+"/share-bg", nil)
	clearReq.Header.Set("Authorization", "Bearer user-token")
	clearRec := httptest.NewRecorder()
	router.ServeHTTP(clearRec, clearReq)
	if clearRec.Code != http.StatusOK || service.clearCalls != 1 {
		t.Fatalf("DELETE share-bg failed %d calls=%d body=%s", clearRec.Code, service.clearCalls, clearRec.Body.String())
	}
	if !bytes.Contains(clearRec.Body.Bytes(), []byte(`"share_bg_image_url":""`)) ||
		!bytes.Contains(clearRec.Body.Bytes(), []byte(`"share_bg_unlocked":true`)) {
		t.Fatalf("unexpected clear body: %s", clearRec.Body.String())
	}
}

func TestShareBgHandlerValidatesInputAndMapsErrors(t *testing.T) {
	matchID := uuid.New()
	service := &fakeShareBgService{}
	router := newShareBgTestRouter(service)

	// 无效 UUID
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/app/matches/not-a-uuid/share-bg", nil)
	req.Header.Set("Authorization", "Bearer user-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid uuid should return 422, got %d", rec.Code)
	}

	// 缺少文件
	var emptyBody bytes.Buffer
	writer := multipart.NewWriter(&emptyBody)
	_ = writer.Close()
	missingFileReq := httptest.NewRequest(http.MethodPost, "/api/v1/app/matches/"+matchID.String()+"/share-bg", &emptyBody)
	missingFileReq.Header.Set("Authorization", "Bearer user-token")
	missingFileReq.Header.Set("Content-Type", writer.FormDataContentType())
	missingRec := httptest.NewRecorder()
	router.ServeHTTP(missingRec, missingFileReq)
	if missingRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("missing file should return 422, got %d", missingRec.Code)
	}

	// 非法 JSON
	badJSONReq := httptest.NewRequest(http.MethodPut, "/api/v1/app/matches/"+matchID.String()+"/share-bg", bytes.NewBufferString("{bad"))
	badJSONReq.Header.Set("Authorization", "Bearer user-token")
	badJSONReq.Header.Set("Content-Type", "application/json")
	badJSONRec := httptest.NewRecorder()
	router.ServeHTTP(badJSONRec, badJSONReq)
	if badJSONRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad json should return 422, got %d", badJSONRec.Code)
	}

	// VIP 权限不足映射为 403
	service.selectErr = sharederror.New(sharederror.KindForbidden, "更换自定义分享背景需开通球队会员，免费版仍可正常使用默认海报分享")
	forbiddenReq := httptest.NewRequest(http.MethodPut, "/api/v1/app/matches/"+matchID.String()+"/share-bg", bytes.NewBufferString(`{"image_url":"https://cdn.example.com/a.webp"}`))
	forbiddenReq.Header.Set("Authorization", "Bearer user-token")
	forbiddenReq.Header.Set("Content-Type", "application/json")
	forbiddenRec := httptest.NewRecorder()
	router.ServeHTTP(forbiddenRec, forbiddenReq)
	if forbiddenRec.Code != http.StatusForbidden {
		t.Fatalf("vip forbidden should return 403, got %d: %s", forbiddenRec.Code, forbiddenRec.Body.String())
	}
}
