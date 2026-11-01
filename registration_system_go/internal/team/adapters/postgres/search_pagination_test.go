package postgres

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestTeamSearchPagination(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)
	// Deliberately insert names backwards: pages must follow name,id, not insertion order.
	for number := 51; number > 0; number-- {
		if _, err := pool.Exec(ctx, `INSERT INTO teams (name) VALUES ($1)`, fmt.Sprintf("目录球队%02d", number)); err != nil {
			t.Fatal(err)
		}
	}
	for _, status := range []string{"frozen", "dissolved", "deleted"} {
		if _, err := pool.Exec(ctx, `INSERT INTO teams (name,status) VALUES ($1,$2)`, "目录球队00-"+status, status); err != nil {
			t.Fatal(err)
		}
	}
	first, err := repository.SearchByKeywordPage(ctx, "", 0)
	if err != nil || len(first) != 50 || first[0].Team.Name != "目录球队01" || first[49].Team.Name != "目录球队50" {
		t.Fatalf("first page: count=%d err=%v", len(first), err)
	}
	for _, item := range first {
		if item.Team.Status != domain.TeamActive {
			t.Fatalf("inactive team included: %+v", item)
		}
	}
	legacy, err := repository.SearchByKeyword(ctx, "")
	if err != nil || len(legacy) != 50 || legacy[0].Team.ID != first[0].Team.ID || legacy[49].Team.ID != first[49].Team.ID {
		t.Fatalf("legacy search must return first 50: count=%d err=%v", len(legacy), err)
	}
	second, err := repository.SearchByKeywordPage(ctx, "", 50)
	if err != nil || len(second) != 1 || second[0].Team.Name != "目录球队51" {
		t.Fatalf("second page: items=%+v err=%v", second, err)
	}
	last, err := repository.SearchByKeywordPage(ctx, "", 100)
	if err != nil || last == nil || len(last) != 0 {
		t.Fatalf("last page must be empty array: items=%+v err=%v", last, err)
	}
}

func TestTeamSearchPaginationMatchesYueVariantsAndSummary(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	repository := NewRepository(pool)
	for number := 1; number <= 51; number++ {
		name := fmt.Sprintf("洺悅球队%02d", number)
		if number%2 == 0 {
			name = fmt.Sprintf("洺悦球队%02d", number)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO teams (name,credit_score,vip_until) VALUES ($1,88,'2030-01-01T00:00:00Z')`, name); err != nil {
			t.Fatal(err)
		}
	}
	var summaryTeamID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM teams ORDER BY name,id OFFSET 50 LIMIT 1`).Scan(&summaryTeamID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (openid) VALUES ('active-search-member'),('left-search-member')`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status) SELECT $1,id,'member',CASE WHEN openid = 'active-search-member' THEN 'active' ELSE 'left' END FROM users`, summaryTeamID); err != nil {
		t.Fatal(err)
	}
	for _, keyword := range []string{"洺悦", "洺悅"} {
		items, err := repository.SearchByKeywordPage(ctx, keyword, 50)
		if err != nil || len(items) != 1 {
			t.Fatalf("keyword=%s count=%d err=%v", keyword, len(items), err)
		}
		item := items[0]
		if item.Team.ID != summaryTeamID || item.MemberCount != 1 || item.CreditScore != 88 || item.VipUntil == nil || !item.VipUntil.Equal(time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC)) {
			t.Fatalf("summary mapping changed: %+v", item)
		}
	}
}
