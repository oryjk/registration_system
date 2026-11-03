package application

import (
	"context"
	"errors"
	"testing"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeGenerator struct {
	path, query string
	err         error
}

func (f *fakeGenerator) GenerateURLLink(_ context.Context, path, query string) (string, error) {
	f.path, f.query = path, query
	return "https://wxaurl.cn/abc", f.err
}

func TestChanlunLinkTargetsLandingPageWithEncodedReturnQuery(t *testing.T) {
	generator := &fakeGenerator{}
	link, err := NewService(generator).ChanlunLink(context.Background(), "secid=1.600519&timeframe=30m")
	if err != nil || link != "https://wxaurl.cn/abc" {
		t.Fatalf("link: %s %v", link, err)
	}
	if generator.path != "pages/chanlun/index" || generator.query != "path=secid%3D1.600519%26timeframe%3D30m" {
		t.Fatalf("bad target: %s ? %s", generator.path, generator.query)
	}
}

func TestChanlunLinkWithoutReturnQueryOpensLandingPage(t *testing.T) {
	generator := &fakeGenerator{}
	if _, err := NewService(generator).ChanlunLink(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	if generator.query != "" {
		t.Fatalf("expected empty query, got %q", generator.query)
	}
}

func TestChanlunLinkRejectsUnsafeReturnQuery(t *testing.T) {
	for _, query := range []string{"https://evil.test", "a=1#x", "a=<script>", string(make([]byte, 600))} {
		generator := &fakeGenerator{}
		_, err := NewService(generator).ChanlunLink(context.Background(), query)
		var businessError *sharederror.Error
		if !errors.As(err, &businessError) || businessError.Kind != sharederror.KindValidation {
			t.Fatalf("query %q: expected validation error, got %v", query, err)
		}
		if generator.path != "" {
			t.Fatalf("query %q: generator must not be called", query)
		}
	}
}

func TestChanlunLinkWrapsGeneratorFailure(t *testing.T) {
	_, err := NewService(&fakeGenerator{err: errors.New("quota")}).ChanlunLink(context.Background(), "")
	var businessError *sharederror.Error
	if !errors.As(err, &businessError) || businessError.Kind != sharederror.KindInternal {
		t.Fatalf("expected internal error, got %v", err)
	}
}
