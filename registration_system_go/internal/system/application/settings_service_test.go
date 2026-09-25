package application

import (
	"context"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/system/domain"
)

// fakeSettingsRepository 内存实现 mini_app_settings 分区读写。
type fakeSettingsRepository struct {
	sections  map[string]map[string]any
	upsertErr error
}

func newFakeSettingsRepository() *fakeSettingsRepository {
	return &fakeSettingsRepository{sections: map[string]map[string]any{}}
}

func (r *fakeSettingsRepository) FindSetting(_ context.Context, key string) (map[string]any, bool, error) {
	section, found := r.sections[key]
	if !found {
		return nil, false, nil
	}
	return section, true, nil
}

func (r *fakeSettingsRepository) UpsertSetting(_ context.Context, key string, value map[string]any) error {
	if r.upsertErr != nil {
		return r.upsertErr
	}
	r.sections[key] = value
	return nil
}

func TestSettingsServiceGetReturnsEmptyHomeWhenSectionMissing(t *testing.T) {
	service := NewSettingsService(newFakeSettingsRepository())

	settings, err := service.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.Home.NextMatchSocialImageURL != "" {
		t.Fatalf("home section should default to empty URL, got %q", settings.Home.NextMatchSocialImageURL)
	}
}

func TestSettingsServiceGetReadsStoredHomeSection(t *testing.T) {
	repository := newFakeSettingsRepository()
	repository.sections[domain.SettingsSectionHome] = map[string]any{
		"next_match_social_image_url": "https://cdn.example.com/static/home/next-match-social/abc.png",
	}
	service := NewSettingsService(repository)

	settings, err := service.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if settings.Home.NextMatchSocialImageURL != "https://cdn.example.com/static/home/next-match-social/abc.png" {
		t.Fatalf("stored home URL not applied: %+v", settings.Home)
	}
}

func TestSettingsServiceUpdateHomeWritesURL(t *testing.T) {
	repository := newFakeSettingsRepository()
	service := NewSettingsService(repository)
	url := "https://cdn.example.com/static/home/next-match-social/def.png"

	saved, err := service.UpdateHome(context.Background(), HomeSettingsPatch{NextMatchSocialImageURL: &url})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Home.NextMatchSocialImageURL != url {
		t.Fatalf("saved home URL mismatch: %+v", saved.Home)
	}

	readBack, err := service.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if readBack.Home.NextMatchSocialImageURL != url {
		t.Fatalf("home URL not persisted: %+v", readBack.Home)
	}
}

func TestSettingsServiceUpdateHomeWithoutPatchKeepsStoredValue(t *testing.T) {
	repository := newFakeSettingsRepository()
	repository.sections[domain.SettingsSectionHome] = map[string]any{
		"next_match_social_image_url": "https://cdn.example.com/old.png",
	}
	service := NewSettingsService(repository)

	saved, err := service.UpdateHome(context.Background(), HomeSettingsPatch{})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Home.NextMatchSocialImageURL != "https://cdn.example.com/old.png" {
		t.Fatalf("empty patch must not reset stored home URL: %+v", saved.Home)
	}
}

func TestSettingsServiceUpdateHomeDoesNotResetOtherSections(t *testing.T) {
	service := NewSettingsService(newFakeSettingsRepository())
	url := "https://cdn.example.com/static/home/next-match-social/ghi.png"

	if _, err := service.UpdateDebug(context.Background(), DebugSettingsPatch{
		ClearProfileEnabled: ptrOf(true),
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.UpdateHome(context.Background(), HomeSettingsPatch{NextMatchSocialImageURL: &url}); err != nil {
		t.Fatal(err)
	}

	settings, err := service.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !settings.Debug.ClearProfileEnabled {
		t.Fatal("updating home section must not reset debug flags")
	}
	if settings.Home.NextMatchSocialImageURL != url {
		t.Fatalf("home URL mismatch: %+v", settings.Home)
	}
}
