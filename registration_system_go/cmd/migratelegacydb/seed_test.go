package main

import (
	"context"
	"testing"

	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

// 回归测试：种子步骤曾只写 team_members 的 captain 角色、漏写 teams.captain_id，
// 导致管理端按 teams.captain_id 展示队长时显示"未指定"。
func TestSeedHostAndCaptainBackfillsTeamCaptainID(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	options := cliOptions{hostTeamID: 11, hostTeamName: "洺悦御府"}
	captain := legacyCaptain{ID: 4, OpenID: "openid-captain", Nickname: "Carl Wang", Active: true}

	if err := seedHostAndCaptain(ctx, pool, options, captain); err != nil {
		t.Fatalf("seedHostAndCaptain: %v", err)
	}

	var captainID *int64
	if err := pool.QueryRow(ctx,
		`SELECT captain_id FROM teams WHERE id = $1`, options.hostTeamID,
	).Scan(&captainID); err != nil {
		t.Fatalf("query teams.captain_id: %v", err)
	}
	if captainID == nil || *captainID != captain.ID {
		t.Fatalf("teams.captain_id = %v, want %d", captainID, captain.ID)
	}
}
