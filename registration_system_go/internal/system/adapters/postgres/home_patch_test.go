package postgres_test

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/system/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/system/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

// Synchronize the first home reads to reproduce concurrent requests sharing old snapshots.
type synchronizedHomeReads struct {
	*postgres.SettingsRepository
	reads   atomic.Int32
	barrier sync.WaitGroup
}

func (r *synchronizedHomeReads) FindSetting(ctx context.Context, key string) (map[string]any, bool, error) {
	value, found, err := r.SettingsRepository.FindSetting(ctx, key)
	if key == "home" && r.reads.Add(1) <= 8 {
		r.barrier.Done()
		r.barrier.Wait()
	}
	return value, found, err
}

func TestConcurrentHomePatchesPreserveAllScenesAndClear(t *testing.T) {
	repo := &synchronizedHomeReads{SettingsRepository: postgres.NewSettingsRepository(testsupport.OpenTestPostgres(t))}
	repo.barrier.Add(8)
	ctx := context.Background()
	if err := repo.UpsertSetting(ctx, "home", map[string]any{"onboarding_team_image_url": "old-team", "future_field": "keep", "share_match_image_url": "old-share"}); err != nil {
		t.Fatal(err)
	}
	service := application.NewSettingsService(repo)
	welcome, team, match, social := "welcome.png", "", "match.png", "social.png"
	shareHome, shareHall, shareTeam, shareMatch := "share-home.png", "share-hall.png", "share-team.png", ""
	patches := []application.HomeSettingsPatch{
		{ShareHomeImageURL: &shareHome}, {ShareHallImageURL: &shareHall}, {ShareTeamImageURL: &shareTeam}, {ShareMatchImageURL: &shareMatch},
		{OnboardingWelcomeImageURL: &welcome}, {OnboardingTeamImageURL: &team}, {OnboardingMatchImageURL: &match}, {NextMatchSocialImageURL: &social},
	}
	errs := make(chan error, 8)
	for _, patch := range patches {
		go func() { _, err := service.UpdateHome(ctx, patch); errs <- err }()
	}
	for range patches {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	fields, _, err := repo.FindSetting(ctx, "home")
	if err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{"share_home_image_url": shareHome, "share_hall_image_url": shareHall, "share_team_image_url": shareTeam, "share_match_image_url": shareMatch, "onboarding_welcome_image_url": welcome, "onboarding_team_image_url": team, "onboarding_match_image_url": match, "next_match_social_image_url": social, "future_field": "keep"} {
		if fields[key] != want {
			t.Errorf("%s=%v want=%q", key, fields[key], want)
		}
	}
}
