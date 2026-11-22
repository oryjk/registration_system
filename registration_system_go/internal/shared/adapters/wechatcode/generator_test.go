package wechatcode

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

type memoryStore struct {
	data             []byte
	key, contentType string
}

func (s *memoryStore) Save(_ context.Context, key, contentType string, data []byte) (string, error) {
	s.data = data
	s.key = key
	s.contentType = contentType
	return "https://example.test/" + key, nil
}
func TestHonorMiniCodeUsesStableTokenAndCachesImage(t *testing.T) {
	var tokens, codes atomic.Int32
	var buffer bytes.Buffer
	_ = png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, 300, 300)))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cgi-bin/stable_token":
			tokens.Add(1)
			if r.Method != "POST" {
				t.Error("token must use POST")
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "private-token", "expires_in": 7200})
		case "/wxa/getwxacodeunlimit":
			codes.Add(1)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["scene"] != "abcdefghijklmnopqrstuv" || body["page"] != "pages/home/index" || body["env_version"] != "develop" || body["check_path"] != false || r.URL.Query().Get("access_token") != "private-token" {
				t.Errorf("bad request: %+v", body)
			}
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(buffer.Bytes())
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	store := &memoryStore{}
	g := New(server.Client(), server.URL, "app", "secret", store)
	for i := 0; i < 2; i++ {
		url, err := g.Generate(context.Background(), "abcdefghijklmnopqrstuv", "develop")
		if err != nil || !strings.HasPrefix(url, "https://example.test/") {
			t.Fatalf("generate: %s %v", url, err)
		}
	}
	if tokens.Load() != 1 || codes.Load() != 1 || !bytes.Equal(store.data, buffer.Bytes()) || store.contentType != "image/png" {
		t.Fatal("token/code cache or stored image wrong")
	}
}
func TestHonorMiniCodeRejectsWechatErrorsWithoutSaving(t *testing.T) {
	for _, status := range []int{200, 503} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/cgi-bin/stable_token" {
					_, _ = w.Write([]byte(`{"access_token":"private-token","expires_in":7200}`))
					return
				}
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"errcode":40001,"errmsg":"contains private-token"}`))
			}))
			defer server.Close()
			store := &memoryStore{}
			g := New(server.Client(), server.URL, "app", "secret", store)
			if _, err := g.Generate(context.Background(), "abcdefghijklmnopqrstuv", "release"); err == nil || strings.Contains(err.Error(), "private-token") {
				t.Fatalf("unsafe error: %v", err)
			}
			if len(store.data) != 0 {
				t.Fatal("saved error response as code image")
			}
		})
	}
}

func TestGenerateForPageSupportsCustomPageAndSceneAndCaches(t *testing.T) {
	var tokens, codes atomic.Int32
	var buffer bytes.Buffer
	_ = png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, 300, 300)))
	scene32 := "0123456789abcdef0123456789abcdef"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cgi-bin/stable_token":
			tokens.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok-1", "expires_in": 7200})
		case "/wxa/getwxacodeunlimit":
			codes.Add(1)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["scene"] != scene32 || body["page"] != "pages/matches/lineup/index" || body["env_version"] != "trial" || body["check_path"] != false {
				t.Errorf("bad request body: %+v", body)
			}
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(buffer.Bytes())
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	store := &memoryStore{}
	g := New(server.Client(), server.URL, "app", "secret", store)
	var firstURL string
	for i := 0; i < 2; i++ {
		got, err := g.GenerateForPage(context.Background(), "pages/matches/lineup/index", scene32, "trial")
		if err != nil {
			t.Fatalf("GenerateForPage failed: %v", err)
		}
		if !strings.HasPrefix(got, "https://example.test/static/share/mini-codes/v1/trial/") || !strings.HasSuffix(got, ".png") {
			t.Fatalf("unexpected url: %s", got)
		}
		if i == 0 {
			firstURL = got
		} else if got != firstURL {
			t.Fatalf("cached url mismatch: %s != %s", got, firstURL)
		}
	}
	if tokens.Load() != 1 || codes.Load() != 1 {
		t.Fatalf("expected 1 token & 1 code call, got tokens=%d codes=%d", tokens.Load(), codes.Load())
	}
}

func TestGenerateForPageValidatesParameters(t *testing.T) {
	store := &memoryStore{}
	g := New(http.DefaultClient, "https://example.test", "app", "secret", store)

	cases := []struct {
		name        string
		page        string
		scene       string
		environment string
	}{
		{"empty page", "", "abc", "release"},
		{"leading slash page", "/pages/matches/lineup/index", "abc", "release"},
		{"query in page", "pages/matches/lineup/index?a=1", "abc", "release"},
		{"traversal in page", "pages/../index", "abc", "release"},
		{"empty scene", "pages/matches/lineup/index", "", "release"},
		{"scene too long", "pages/matches/lineup/index", strings.Repeat("a", 33), "release"},
		{"invalid env", "pages/matches/lineup/index", "abc", "staging"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := g.GenerateForPage(context.Background(), tc.page, tc.scene, tc.environment); err == nil {
				t.Fatalf("expected error for %s", tc.name)
			}
		})
	}

	nilStoreGen := New(http.DefaultClient, "https://example.test", "app", "secret", nil)
	if _, err := nilStoreGen.GenerateForPage(context.Background(), "pages/matches/lineup/index", "abc", "release"); err == nil {
		t.Fatal("expected error when store is nil")
	}
}
