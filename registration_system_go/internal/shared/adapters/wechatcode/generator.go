package wechatcode

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Store interface {
	Save(context.Context, string, string, []byte) (string, error)
}
type cachedCode struct {
	url     string
	expires time.Time
}

// Generator coalesces code generation; errors never include credentials or WeChat bodies.
type Generator struct {
	client                  *http.Client
	endpoint, appID, secret string
	store                   Store
	mu                      sync.Mutex
	token                   string
	tokenExpires            time.Time
	images                  map[string]cachedCode
}

func New(client *http.Client, endpoint, appID, secret string, store Store) *Generator {
	return &Generator{client: client, endpoint: strings.TrimRight(endpoint, "/"), appID: appID, secret: secret, store: store, images: make(map[string]cachedCode)}
}
func (g *Generator) Generate(ctx context.Context, scene, environment string) (string, error) {
	if g.store == nil {
		return "", errors.New("mini code storage unavailable")
	}
	if len(scene) != 22 || (environment != "release" && environment != "trial" && environment != "develop") {
		return "", errors.New("invalid mini code parameters")
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	key := environment + "/" + scene
	if cached, ok := g.images[key]; ok && time.Now().Before(cached.expires) {
		return cached.url, nil
	}
	if err := g.ensureToken(ctx); err != nil {
		return "", err
	}
	payload := map[string]any{"scene": scene, "page": "pages/home/index", "check_path": false, "env_version": environment, "width": 430}
	data, err := g.post(ctx, "/wxa/getwxacodeunlimit?access_token="+url.QueryEscape(g.token), payload)
	if err != nil {
		return "", err
	}
	contentType := http.DetectContentType(data)
	if contentType != "image/png" && contentType != "image/jpeg" {
		var failure struct {
			Code int `json:"errcode"`
		}
		_ = json.Unmarshal(data, &failure)
		if failure.Code == 40001 || failure.Code == 40014 || failure.Code == 42001 {
			g.token = ""
			g.tokenExpires = time.Time{}
		}
		return "", fmt.Errorf("WeChat mini code rejected (code %d)", failure.Code)
	}
	dimensions, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || dimensions.Width < 128 || dimensions.Height < 128 || dimensions.Width > 1280 || dimensions.Height > 1280 {
		return "", errors.New("invalid WeChat code image")
	}
	extension := ".png"
	if contentType == "image/jpeg" {
		extension = ".jpg"
	}
	publicURL, err := g.store.Save(ctx, "static/share/honor-codes/v1/"+key+extension, contentType, data)
	if err != nil {
		return "", errors.New("mini code upload failed")
	}
	if len(g.images) >= 256 {
		clear(g.images)
	}
	g.images[key] = cachedCode{url: publicURL, expires: time.Now().Add(24 * time.Hour)}
	return publicURL, nil
}
func (g *Generator) ensureToken(ctx context.Context) error {
	if g.token != "" && time.Now().Before(g.tokenExpires) {
		return nil
	}
	data, err := g.post(ctx, "/cgi-bin/stable_token", map[string]any{"grant_type": "client_credential", "appid": g.appID, "secret": g.secret, "force_refresh": false})
	if err != nil {
		return err
	}
	var payload struct {
		Token   string `json:"access_token"`
		Expires int    `json:"expires_in"`
		Code    int    `json:"errcode"`
	}
	if json.Unmarshal(data, &payload) != nil || payload.Token == "" || payload.Expires <= 60 {
		return fmt.Errorf("WeChat token unavailable (code %d)", payload.Code)
	}
	g.token = payload.Token
	g.tokenExpires = time.Now().Add(time.Duration(payload.Expires-60) * time.Second)
	return nil
}
func (g *Generator) post(ctx context.Context, path string, payload any) ([]byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, errors.New("invalid WeChat request")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, g.endpoint+path, bytes.NewReader(body))
	if err != nil {
		return nil, errors.New("invalid WeChat endpoint")
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := g.client.Do(request)
	if err != nil {
		return nil, errors.New("WeChat network request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("WeChat returned HTTP %d", response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 4*1024*1024+1))
	if err != nil || len(data) > 4*1024*1024 {
		return nil, errors.New("invalid WeChat response size")
	}
	return data, nil
}
