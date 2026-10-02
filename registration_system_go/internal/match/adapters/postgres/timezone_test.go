package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestMatchTimestampPersistencePreservesOffsetInstants(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	match, groups := newPersistableMatch(t, ownerID, teamID)
	beijing := time.FixedZone("Asia/Shanghai", 8*60*60)
	match.StartTime = time.Date(2026, 1, 1, 0, 30, 0, 0, beijing)
	match.EndTime = match.StartTime.Add(2 * time.Hour)
	registrationStart := match.StartTime.Add(-24 * time.Hour)
	registrationEnd := match.StartTime.Add(-time.Hour)
	match.RegistrationStartAt, match.RegistrationEndAt = &registrationStart, &registrationEnd
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatal(err)
	}
	stored, _, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found {
		t.Fatalf("find stored match: found=%v err=%v", found, err)
	}
	if stored.StartTime.Format(time.RFC3339) != "2025-12-31T16:30:00Z" || !stored.EndTime.Equal(match.EndTime) ||
		stored.RegistrationStartAt == nil || !stored.RegistrationStartAt.Equal(registrationStart) ||
		stored.RegistrationEndAt == nil || !stored.RegistrationEndAt.Equal(registrationEnd) {
		t.Fatalf("offset timestamps must round-trip as the same UTC instant: %+v", stored)
	}
	// 日期窗口也接受旧客户端传入的 +08:00，而不把北京时间墙钟写入 UTC 列。
	dayStart := time.Date(2026, 1, 1, 0, 0, 0, 0, beijing)
	filter := ports.MatchListFilter{Scope: ports.MatchScopeAll, UserID: ownerID, DateStart: &dayStart, Limit: 20}
	items, err := repository.ListForUser(ctx, filter)
	if err != nil || len(items) != 1 || items[0].Match.ID != match.ID {
		t.Fatalf("offset date_start window must preserve the instant: %+v err=%v", items, err)
	}
	count, err := repository.CountForUser(ctx, filter)
	if err != nil || count != 1 {
		t.Fatalf("count must match offset date_start window: count=%d err=%v", count, err)
	}
}
