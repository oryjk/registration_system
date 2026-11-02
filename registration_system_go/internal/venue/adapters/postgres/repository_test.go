package venuepostgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	matchpostgres "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestVenueQueriesJoinImagesAndRetainLatestCoordinates(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	matches := matchpostgres.NewRepository(pool)
	ownerID, teamID := seedOwner(t, pool)
	start := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	latitude, longitude := 30.6, 104.1
	seedMatch(t, matches, ownerID, teamID, "体育公园", &latitude, &longitude, start)
	seedMatch(t, matches, ownerID, teamID, "体育公园", nil, nil, start.Add(time.Hour))
	newLatitude, newLongitude := 31.1, 105.2
	seedMatch(t, matches, ownerID, teamID, "体育公园", &newLatitude, &newLongitude, start.Add(2*time.Hour))
	seedMatch(t, matches, ownerID, teamID, "无坐标", nil, nil, start)

	repository := NewRepository(pool)
	if err := repository.SetImage(ctx, "体育公园", "https://cdn.example.com/venue.webp"); err != nil {
		t.Fatalf("set image: %v", err)
	}
	items, err := repository.ListMap(ctx)
	if err != nil || len(items) != 1 {
		t.Fatalf("items=%+v err=%v", items, err)
	}
	venue := items[0]
	if venue.Name != "体育公园" || *venue.Latitude != newLatitude || *venue.Longitude != newLongitude || venue.UseCount != 2 || venue.ImageURL != "https://cdn.example.com/venue.webp" {
		t.Fatalf("unexpected venue %+v", venue)
	}
	suggestions, err := repository.ListSuggestions(ctx, 20)
	if err != nil || len(suggestions) != 1 || suggestions[0].ImageURL != venue.ImageURL {
		t.Fatalf("suggestions=%+v err=%v", suggestions, err)
	}
	if err := repository.SetImage(ctx, "体育公园", ""); err != nil {
		t.Fatalf("clear image: %v", err)
	}
	items, err = repository.ListMap(ctx)
	if err != nil || len(items) != 1 || items[0].ImageURL != "" {
		t.Fatalf("cleared items=%+v err=%v", items, err)
	}
}

func seedOwner(t *testing.T, pool *pgxpool.Pool) (int64, int64) {
	t.Helper()
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ($1) RETURNING id`, "owner-"+uuid.NewString()).Scan(&userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name, captain_id) VALUES ('球场测试队', $1) RETURNING id`, userID).Scan(&teamID); err != nil {
		t.Fatalf("seed team: %v", err)
	}
	return userID, teamID
}

func seedMatch(t *testing.T, repository *matchpostgres.Repository, ownerID, teamID int64, location string, latitude, longitude *float64, start time.Time) {
	t.Helper()
	match, groups, err := matchdomain.NewMatch(matchdomain.NewMatchInput{
		Name: "场地种子-" + location, PublicationMode: matchdomain.OnlineTeam, HostTeamID: &teamID,
		CreatedByUserID: &ownerID, PlayersPerTeam: 8,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: location,
		LocationLatitude: latitude, LocationLongitude: longitude, CreatedAt: start.Add(-24 * time.Hour),
	}, matchdomain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if err := repository.CreateWithGroups(context.Background(), match, groups); err != nil {
		t.Fatalf("create match: %v", err)
	}
}
