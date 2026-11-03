package wechatcode

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestURLLinkUsesReleaseEnvAndCachesPerTarget(t *testing.T) {
	var links atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cgi-bin/stable_token":
			_, _ = w.Write([]byte(`{"access_token":"private-token","expires_in":7200}`))
		case "/wxa/generate_urllink":
			links.Add(1)
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["path"] != "pages/chanlun/index" || body["query"] != "path=a%3D1" || body["env_version"] != "release" ||
				body["expire_type"] != float64(1) || r.URL.Query().Get("access_token") != "private-token" {
				t.Errorf("bad request: %+v", body)
			}
			_, _ = w.Write([]byte(`{"errcode":0,"url_link":"https://wxaurl.cn/abc"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	g := New(server.Client(), server.URL, "app", "secret", nil)
	for i := 0; i < 2; i++ {
		link, err := g.GenerateURLLink(context.Background(), "pages/chanlun/index", "path=a%3D1")
		if err != nil || link != "https://wxaurl.cn/abc" {
			t.Fatalf("link: %s %v", link, err)
		}
	}
	if links.Load() != 1 {
		t.Fatalf("expected cached link, generated %d times", links.Load())
	}
}

func TestURLLinkErrorsDoNotLeakTokenAndResetExpiredToken(t *testing.T) {
	var tokens atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/cgi-bin/stable_token" {
			tokens.Add(1)
			_, _ = w.Write([]byte(`{"access_token":"private-token","expires_in":7200}`))
			return
		}
		_, _ = w.Write([]byte(`{"errcode":42001,"errmsg":"contains private-token"}`))
	}))
	defer server.Close()
	g := New(server.Client(), server.URL, "app", "secret", nil)
	for i := 0; i < 2; i++ {
		if _, err := g.GenerateURLLink(context.Background(), "pages/chanlun/index", ""); err == nil || strings.Contains(err.Error(), "private-token") {
			t.Fatalf("unsafe error: %v", err)
		}
	}
	if tokens.Load() != 2 {
		t.Fatalf("expired token should be refreshed, fetched %d times", tokens.Load())
	}
}
