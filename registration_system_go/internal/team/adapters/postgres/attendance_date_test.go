package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestAttendanceDateRangeUsesShanghaiCalendarDays(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('attendance-date-boundary') RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('日期边界球队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain')`, teamID, userID); err != nil {
		t.Fatal(err)
	}
	for _, stamp := range []string{
		"2025-12-31T15:59:59Z", // 北京 12/31，范围外。
		"2025-12-31T16:00:00Z", // 北京 1/1 零点，包含。
		"2025-12-31T17:00:00Z", // 北京 1/1 凌晨，跨 UTC 日期。
		"2026-01-01T15:59:59Z", // 北京 1/1 最后一秒，包含。
		"2026-01-01T16:00:00Z", // 北京 1/2 零点，范围外。
	} {
		start, err := time.Parse(time.RFC3339, stamp)
		if err != nil {
			t.Fatal(err)
		}
		var matchID string
		if err := pool.QueryRow(ctx, `INSERT INTO matches
			(id, name, publication_mode, opponent_state, status, host_team_id, opponent_name,
			 players_per_team, start_time, end_time, location, created_by_user_id)
			VALUES (gen_random_uuid(), $1, 'offline_confirmed', 'no_recruitment', 'ended', $2, '对手',
			 8, $3::timestamp, $3::timestamp + interval '2 hours', '球场', $4) RETURNING id`,
			stamp, teamID, start, userID).Scan(&matchID); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO match_registration_groups (id, match_id, kind, team_id)
			VALUES (gen_random_uuid(), $1, 'host_team', $2)`, matchID, teamID); err != nil {
			t.Fatal(err)
		}
	}
	day := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) // 纯日期参数，不代表 UTC 零点时刻。
	for _, zone := range []string{"UTC", "America/Los_Angeles"} {
		t.Run(zone, func(t *testing.T) {
			config := pool.Config()
			config.ConnConfig.RuntimeParams["timezone"] = zone
			zonedPool, err := pgxpool.NewWithConfig(ctx, config)
			if err != nil {
				t.Fatal(err)
			}
			defer zonedPool.Close()
			repository := NewRepository(zonedPool)
			for _, tc := range []struct {
				name       string
				start, end *time.Time
				want       int
			}{
				{"both", &day, &day, 3},
				{"start_only", &day, nil, 4},
				{"end_only", nil, &day, 4},
				{"unfiltered", nil, nil, 5},
			} {
				t.Run(tc.name, func(t *testing.T) {
					records, err := repository.ListMemberAttendanceRecords(ctx, teamID, userID, tc.start, tc.end)
					if err != nil || len(records) != tc.want {
						t.Fatalf("Shanghai day range: got %d want %d err=%v", len(records), tc.want, err)
					}
					if tc.name == "both" && (records[0].ActivityName != "2026-01-01T15:59:59Z" || records[2].ActivityName != "2025-12-31T16:00:00Z") {
						t.Fatalf("wrong inclusive/exclusive day boundaries: %+v", records)
					}
					ranking, err := repository.ListAttendanceRanking(ctx, teamID, tc.start, tc.end)
					if err != nil || len(ranking) != 1 || ranking[0].TotalCount != int64(tc.want) {
						t.Fatalf("ranking must use the same day range: %+v err=%v", ranking, err)
					}
				})
			}
		})
	}
}
