package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestRepositoryMatchLineupCRUDAndUsers(t *testing.T) {
	ctx := context.Background()
	pool := testsupport.StartPostgres(t)
	repo := NewRepository(pool)

	captainID, teamID := seedCaptainWithTeam(t, pool, "排阵联队")
	var subID int64
	if err := pool.QueryRow(
		ctx,
		`INSERT INTO users (openid, nickname, avatar_url) VALUES ($1, $2, $3) RETURNING id`,
		"sub-lineup-"+time.Now().Format(time.RFC3339Nano),
		"超级替补",
		"https://cdn.example.com/sub.png",
	).Scan(&subID); err != nil {
		t.Fatalf("seed sub user: %v", err)
	}

	start := time.Date(2026, 11, 25, 11, 0, 0, 0, time.UTC)
	opponent := "蓝星队"
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name:            "排阵测试赛",
		PublicationMode: domain.OfflineConfirmed,
		HostTeamID:      &teamID,
		CreatedByUserID: &captainID,
		OpponentName:    &opponent,
		PlayersPerTeam:  5,
		StartTime:       start,
		EndTime:         start.Add(2 * time.Hour),
		Location:        "东安球场",
	}, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("NewMatch: %v", err)
	}
	if err := repo.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("CreateWithGroups: %v", err)
	}

	// 未保存前返回 found=false
	if _, found, err := repo.FindLineup(ctx, match.ID); err != nil || found {
		t.Fatalf("初始查询应未找到阵型: found=%v err=%v", found, err)
	}

	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)
	slots := []domain.LineupSlot{
		{Slot: 0, PlayerID: &captainID, X: 0.5, Y: 0.9, SubPlayerIDs: []int64{subID}},
		{Slot: 1, PlayerID: nil, X: 0.3, Y: 0.65, SubPlayerIDs: nil},
		{Slot: 2, PlayerID: nil, X: 0.7, Y: 0.65, SubPlayerIDs: nil},
		{Slot: 3, PlayerID: nil, X: 0.5, Y: 0.45, SubPlayerIDs: nil},
		{Slot: 4, PlayerID: nil, X: 0.5, Y: 0.2, SubPlayerIDs: nil},
	}
	lineup, err := domain.NewMatchLineup(match.ID, 5, "1-2-1", slots, captainID, now)
	if err != nil {
		t.Fatalf("NewMatchLineup: %v", err)
	}
	saved, err := repo.UpsertLineup(ctx, lineup)
	if err != nil {
		t.Fatalf("UpsertLineup insert: %v", err)
	}
	if saved.Formation != "1-2-1" || saved.PlayersPerTeam != 5 || len(saved.Slots) != 5 {
		t.Fatalf("saved lineup mismatch: %+v", saved)
	}

	// 更新阵型（幂等 upsert）
	updatedAt := now.Add(5 * time.Minute)
	lineup2, err := domain.NewMatchLineup(match.ID, 5, "2-2", slots, captainID, updatedAt)
	if err != nil {
		t.Fatalf("NewMatchLineup 2: %v", err)
	}
	saved2, err := repo.UpsertLineup(ctx, lineup2)
	if err != nil {
		t.Fatalf("UpsertLineup update: %v", err)
	}
	if saved2.Formation != "2-2" || !saved2.UpdatedAt.Equal(updatedAt) || !saved2.CreatedAt.Equal(now) {
		t.Fatalf("updated lineup mismatch: %+v", saved2)
	}

	loaded, found, err := repo.FindLineup(ctx, match.ID)
	if err != nil || !found {
		t.Fatalf("FindLineup: found=%v err=%v", found, err)
	}
	if loaded.Formation != "2-2" || loaded.Slots[0].PlayerID == nil || *loaded.Slots[0].PlayerID != captainID || len(loaded.Slots[0].SubPlayerIDs) != 1 || loaded.Slots[0].SubPlayerIDs[0] != subID {
		t.Fatalf("loaded lineup mismatch: %+v", loaded)
	}
	if loaded.Slots[1].SubPlayerIDs == nil {
		t.Fatal("loaded sub_player_ids should be non-nil empty slice")
	}

	players, err := repo.FindUsersByIDs(ctx, []int64{captainID, subID})
	if err != nil {
		t.Fatalf("FindUsersByIDs: %v", err)
	}
	if len(players) != 2 {
		t.Fatalf("expected 2 players, got %+v", players)
	}
}
