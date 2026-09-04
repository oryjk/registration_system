package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestListVenueSuggestionsFiltersVenuesWithoutCoordinates(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	repository := NewRepository(pool)

	// 无坐标场地用得最多也不进选项；带坐标场地保留并携带代表坐标。
	seedVenueMatch(t, repository, ownerID, teamID, "驿马河二期", nil, nil, time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC))
	seedVenueMatch(t, repository, ownerID, teamID, "驿马河二期", nil, nil, time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC))
	latitude, longitude := 30.585638, 104.101672
	seedVenueMatch(t, repository, ownerID, teamID, "悦享动运动公园", &latitude, &longitude, time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC))

	items, err := repository.ListVenueSuggestions(ctx, 10)
	if err != nil {
		t.Fatalf("list venue suggestions: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected only the geocoded venue, got %d: %+v", len(items), items)
	}
	if items[0].Location != "悦享动运动公园" || items[0].Latitude == nil || *items[0].Latitude != latitude || items[0].Longitude == nil || *items[0].Longitude != longitude {
		t.Fatalf("geocoded venue aggregated wrong: %+v", items[0])
	}

	limited, err := repository.ListVenueSuggestions(ctx, 1)
	if err != nil || len(limited) != 1 {
		t.Fatalf("limit not respected: %+v err=%v", limited, err)
	}
}

func seedVenueMatch(
	t *testing.T,
	repository *Repository,
	ownerID, teamID int64,
	location string,
	latitude, longitude *float64,
	start time.Time,
) {
	t.Helper()
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "场地种子-" + location, PublicationMode: domain.OnlineTeam, HostTeamID: &teamID,
		CreatedByUserID: int64Pointer(ownerID), PlayersPerTeam: 8,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: location,
		LocationLatitude: latitude, LocationLongitude: longitude,
		CreatedAt: start.Add(-24 * time.Hour),
	}, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if err := repository.CreateWithGroups(context.Background(), match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
}
