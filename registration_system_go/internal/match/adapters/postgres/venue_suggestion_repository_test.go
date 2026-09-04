package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestListVenueSuggestionsAggregatesAndToleratesMissingCoordinates(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	repository := NewRepository(pool)

	// 同一不带坐标的场地两次 + 带坐标的场地一次；历史上无坐标场地曾让 NULL 扫描进 float64 报 500。
	seedVenueMatch(t, repository, ownerID, teamID, "驿马河二期", nil, nil, time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC))
	seedVenueMatch(t, repository, ownerID, teamID, "驿马河二期", nil, nil, time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC))
	latitude, longitude := 30.585638, 104.101672
	seedVenueMatch(t, repository, ownerID, teamID, "悦享动运动公园", &latitude, &longitude, time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC))

	items, err := repository.ListVenueSuggestions(ctx, 10)
	if err != nil {
		t.Fatalf("list venue suggestions: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 venues, got %d: %+v", len(items), items)
	}
	if items[0].Location != "驿马河二期" || items[0].UseCount != 2 || items[0].Latitude != nil || items[0].Longitude != nil {
		t.Fatalf("venue without coordinates aggregated wrong: %+v", items[0])
	}
	if items[1].Location != "悦享动运动公园" || items[1].Latitude == nil || *items[1].Latitude != latitude || items[1].Longitude == nil {
		t.Fatalf("venue with coordinates aggregated wrong: %+v", items[1])
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
