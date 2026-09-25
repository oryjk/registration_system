package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/system/ports"
)

// fakeAssetStore 记录保存调用，可注入失败。
type fakeAssetStore struct {
	saved   []savedAsset
	saveErr error
}

type savedAsset struct {
	key         string
	contentType string
	data        []byte
}

func (s *fakeAssetStore) Save(_ context.Context, key, contentType string, data []byte) (string, error) {
	if s.saveErr != nil {
		return "", s.saveErr
	}
	s.saved = append(s.saved, savedAsset{key: key, contentType: contentType, data: data})
	return fmt.Sprintf("https://cdn.example.com/%s", key), nil
}

func newHomeAssetServiceForTest(store ports.AssetStore, repository *fakeSettingsRepository) HomeAssetService {
	return NewHomeAssetService(store, NewSettingsService(repository))
}

func validPNGBytes() []byte {
	// 最小合法 PNG 头 + 填充内容，服务层只校验声明类型与大小，不解码像素。
	return append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, []byte("fake-png-body")...)
}

func validJPEGBytes() []byte {
	return append([]byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F'}, []byte("fake-jpeg-body")...)
}

func validWebPBytes() []byte {
	data := make([]byte, 20)
	copy(data[0:4], "RIFF")
	copy(data[8:12], "WEBP")
	copy(data[12:16], "VP8 ")
	return data
}

func TestUploadNextMatchSocialImageSavesAssetAndPersistsURL(t *testing.T) {
	store := &fakeAssetStore{}
	repository := newFakeSettingsRepository()
	service := newHomeAssetServiceForTest(store, repository)

	settings, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", validPNGBytes())
	if err != nil {
		t.Fatal(err)
	}

	if len(store.saved) != 1 {
		t.Fatalf("asset store should be called once, got %d", len(store.saved))
	}
	saved := store.saved[0]
	if !strings.HasPrefix(saved.key, "static/home/next-match-social/") {
		t.Fatalf("object key should live under controlled prefix: %q", saved.key)
	}
	if !strings.HasSuffix(saved.key, ".png") {
		t.Fatalf("object key should keep source extension: %q", saved.key)
	}
	if saved.contentType != "image/png" {
		t.Fatalf("content type mismatch: %q", saved.contentType)
	}
	if settings.Home.NextMatchSocialImageURL != "https://cdn.example.com/"+saved.key {
		t.Fatalf("returned settings should carry asset URL: %+v", settings.Home)
	}

	persisted, err := NewSettingsService(repository).Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if persisted.Home.NextMatchSocialImageURL != "https://cdn.example.com/"+saved.key {
		t.Fatalf("URL should be persisted to home section: %+v", persisted.Home)
	}
}

func TestUploadNextMatchSocialImageUsesContentHashForKey(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())
	data := validPNGBytes()

	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", data); err != nil {
		t.Fatal(err)
	}
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "renamed.png", data); err != nil {
		t.Fatal(err)
	}

	if len(store.saved) != 2 {
		t.Fatalf("expected two saves, got %d", len(store.saved))
	}
	if store.saved[0].key != store.saved[1].key {
		t.Fatalf("same content should map to the same immutable key: %q vs %q", store.saved[0].key, store.saved[1].key)
	}
}

func TestUploadNextMatchSocialImageRejectsUnsupportedType(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/gif", "social.gif", []byte("GIF89a-fake")); err == nil {
		t.Fatal("gif should be rejected")
	}
	if len(store.saved) != 0 {
		t.Fatalf("rejected uploads must not reach the asset store: %+v", store.saved)
	}
}

// 客户端 MIME / 扩展名完全不可信：格式只按文件头 magic bytes 判定，
// object key 扩展名与 MinIO Content-Type 都使用检测结果。
func TestUploadNextMatchSocialImageDetectsFormatFromContent(t *testing.T) {
	cases := []struct {
		name            string
		data            []byte
		wantExtension   string
		wantContentType string
	}{
		{"png", validPNGBytes(), "png", "image/png"},
		{"jpeg", validJPEGBytes(), "jpg", "image/jpeg"},
		{"webp", validWebPBytes(), "webp", "image/webp"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			store := &fakeAssetStore{}
			service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

			// 客户端 hint 全部错误：真实内容是图片就必须接受。
			settings, err := service.UploadNextMatchSocialImage(context.Background(), "application/octet-stream", "anything.bin", testCase.data)
			if err != nil {
				t.Fatalf("%s should be accepted by content: %v", testCase.name, err)
			}
			saved := store.saved[0]
			if !strings.HasSuffix(saved.key, "."+testCase.wantExtension) {
				t.Fatalf("%s object key should use detected extension: %q", testCase.name, saved.key)
			}
			if saved.contentType != testCase.wantContentType {
				t.Fatalf("%s asset store content type should be detected value: %q", testCase.name, saved.contentType)
			}
			if settings.Home.NextMatchSocialImageURL != "https://cdn.example.com/"+saved.key {
				t.Fatalf("%s returned settings should carry asset URL: %+v", testCase.name, settings.Home)
			}
		})
	}
}

func TestUploadNextMatchSocialImageRejectsHtmlDisguisedAsPng(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

	html := []byte("<html><body><script>alert(1)</script></body></html>")
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "text/html", "fake.png", html); err == nil {
		t.Fatal("html body must be rejected even with a .png filename")
	}
	// 即使 MIME 也伪装成 image/png，内容不是 PNG 同样拒绝。
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "fake.png", html); err == nil {
		t.Fatal("html body must be rejected even when the client claims image/png")
	}
	if len(store.saved) != 0 {
		t.Fatalf("rejected uploads must not reach the asset store: %+v", store.saved)
	}
}

func TestUploadNextMatchSocialImageRejectsPlainTextWithImageContentType(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", []byte("just plain text, not an image")); err == nil {
		t.Fatal("plain text claiming image/png must be rejected")
	}
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/webp", "social.webp", []byte("<svg onload=alert(1)>")); err == nil {
		t.Fatal("svg claiming image/webp must be rejected")
	}
	if len(store.saved) != 0 {
		t.Fatalf("rejected uploads must not reach the asset store: %+v", store.saved)
	}
}

func TestUploadNextMatchSocialImageRejectsGifDespitePngHints(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

	gif := append([]byte("GIF89a"), []byte("fake-gif-body")...)
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", gif); err == nil {
		t.Fatal("gif content must be rejected even with png hints")
	}
	if len(store.saved) != 0 {
		t.Fatalf("rejected uploads must not reach the asset store: %+v", store.saved)
	}
}

func TestUploadNextMatchSocialImageRejectsOversizeFile(t *testing.T) {
	store := &fakeAssetStore{}
	service := newHomeAssetServiceForTest(store, newFakeSettingsRepository())

	oversize := make([]byte, MaxHomeAssetUploadBytes+1)
	oversize[0], oversize[1], oversize[2], oversize[3] = 0x89, 'P', 'N', 'G'
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", oversize); err == nil {
		t.Fatal("oversize upload should be rejected")
	}
	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", nil); err == nil {
		t.Fatal("empty upload should be rejected")
	}
	if len(store.saved) != 0 {
		t.Fatalf("rejected uploads must not reach the asset store: %+v", store.saved)
	}
}

func TestUploadNextMatchSocialImageDoesNotPersistURLWhenStoreFails(t *testing.T) {
	store := &fakeAssetStore{saveErr: errors.New("minio down")}
	repository := newFakeSettingsRepository()
	service := newHomeAssetServiceForTest(store, repository)

	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", validPNGBytes()); err == nil {
		t.Fatal("store failure should surface an error")
	}

	settings, err := NewSettingsService(repository).Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.Home.NextMatchSocialImageURL != "" {
		t.Fatalf("failed upload must not persist URL: %+v", settings.Home)
	}
}

func TestUploadNextMatchSocialImageReturnsErrorWhenPersistFails(t *testing.T) {
	store := &fakeAssetStore{}
	repository := newFakeSettingsRepository()
	repository.upsertErr = errors.New("db down")
	service := newHomeAssetServiceForTest(store, repository)

	_, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", validPNGBytes())
	if err == nil {
		t.Fatal("persist failure should surface an error")
	}
	if !strings.Contains(err.Error(), "保存小程序配置失败") {
		t.Fatalf("persist failure should carry an explicit message: %v", err)
	}
}

func TestUploadNextMatchSocialImageWithoutStoreReturnsConfigError(t *testing.T) {
	service := newHomeAssetServiceForTest(nil, newFakeSettingsRepository())

	if _, err := service.UploadNextMatchSocialImage(context.Background(), "image/png", "social.png", validPNGBytes()); err == nil {
		t.Fatal("missing asset store should surface an error")
	}
}

func ptrOf(value bool) *bool { return &value }
