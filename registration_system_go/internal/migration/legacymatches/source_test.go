package legacymatches

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

func TestPostgresSourceUsesReadOnlyTrackedSnapshot(t *testing.T) {
	now := time.Date(2026, 8, 8, 8, 0, 0, 0, time.UTC)
	tx := &recordingSourceTx{results: [][]sourceRow{
		{{"tracked-match", "友谊赛", "待定", 3, 8, now, (*time.Time)(nil), (*time.Time)(nil), "球场", (*float64)(nil), (*float64)(nil), (*string)(nil), now, now, int64(1), (*int)(nil)}},
		{{"tracked-match", int64(901), "openid-901", "昵称", "姓名", "", "", 1, 1, 1, now, now, now}},
	}}
	pool := &recordingSourcePool{tx: tx}
	source := NewPostgresSource(pool, 1)

	snapshot, err := source.Load(context.Background(), LoadOptions{
		Mode:                  mapping.ModeIncremental,
		Since:                 &now,
		TrackedMatchSourceIDs: []string{"tracked-match"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if pool.options.AccessMode != pgx.ReadOnly {
		t.Fatalf("source access mode=%v", pool.options.AccessMode)
	}
	if len(tx.queries) != 2 || !strings.Contains(tx.queries[0], "status IN (0,1)") || !strings.Contains(tx.queries[0], "ANY") {
		t.Fatalf("unexpected match discovery query: %q", tx.queries)
	}
	if len(snapshot.Matches) != 1 || snapshot.Matches[0].Status != 3 {
		t.Fatalf("tracked terminal match was not loaded: %#v", snapshot.Matches)
	}
	if len(snapshot.Registrations) != 1 || snapshot.Registrations[0].UserSourceID != 901 || snapshot.Registrations[0].OpenID != "openid-901" {
		t.Fatalf("source user identity missing: %#v", snapshot.Registrations)
	}
	if len(snapshot.Users) != 1 || snapshot.Users[0].SourceID != 901 {
		t.Fatalf("source user projection missing: %#v", snapshot.Users)
	}
}

type recordingSourcePool struct {
	tx      pgx.Tx
	options pgx.TxOptions
}

func (p *recordingSourcePool) BeginTx(_ context.Context, options pgx.TxOptions) (pgx.Tx, error) {
	p.options = options
	return p.tx, nil
}

type sourceRow []any

type recordingSourceTx struct {
	pgx.Tx
	queries []string
	results [][]sourceRow
	index   int
}

func (t *recordingSourceTx) Query(_ context.Context, sql string, _ ...any) (pgx.Rows, error) {
	t.queries = append(t.queries, sql)
	rows := &recordingSourceRows{rows: t.results[t.index], index: -1}
	t.index++
	return rows, nil
}

func (t *recordingSourceTx) Commit(context.Context) error   { return nil }
func (t *recordingSourceTx) Rollback(context.Context) error { return nil }

type recordingSourceRows struct {
	pgx.Rows
	rows  []sourceRow
	index int
}

func (r *recordingSourceRows) Next() bool {
	r.index++
	return r.index < len(r.rows)
}

func (r *recordingSourceRows) Scan(dest ...any) error {
	for index, value := range r.rows[r.index] {
		reflect.ValueOf(dest[index]).Elem().Set(reflect.ValueOf(value))
	}
	return nil
}

func (r *recordingSourceRows) Close()     {}
func (r *recordingSourceRows) Err() error { return nil }

func TestToUTCMomentInterpretsLegacyWallClockAsShanghai(t *testing.T) {
	wallClock := time.Date(2026, 8, 20, 20, 0, 0, 0, time.UTC) // 旧库墙钟：周四 20:00
	converted := toUTCMoment(wallClock)
	if got := converted.Format(time.RFC3339); got != "2026-08-20T12:00:00Z" {
		t.Fatalf("expected 2026-08-20T12:00:00Z, got %s", got)
	}
	if toUTCMoment(time.Time{}).IsZero() != true {
		t.Fatal("zero wall clock should stay zero")
	}
	if toUTCMomentPtr(nil) != nil {
		t.Fatal("nil pointer should stay nil")
	}
}

func TestPostgresSourceConvertsLegacyMatchWallClockTimesToUTC(t *testing.T) {
	// 旧库墙钟：holding 20:00、报名窗口 10:00~18:00（均为上海墙钟，pgx 扫描后 location 为 UTC）。
	holding := time.Date(2026, 8, 20, 20, 0, 0, 0, time.UTC)
	registrationStart := time.Date(2026, 8, 19, 10, 0, 0, 0, time.UTC)
	registrationEnd := time.Date(2026, 8, 20, 18, 0, 0, 0, time.UTC)
	tx := &recordingSourceTx{results: [][]sourceRow{
		{{"tz-match", "时区赛", "待定", 0, 8, holding, &registrationStart, &registrationEnd, "球场", (*float64)(nil), (*float64)(nil), (*string)(nil), holding, holding, int64(1), (*int)(nil)}},
		{},
	}}
	source := NewPostgresSource(&recordingSourcePool{tx: tx}, 1)

	snapshot, err := source.Load(context.Background(), LoadOptions{Mode: mapping.ModeFull})
	if err != nil {
		t.Fatal(err)
	}
	match := snapshot.Matches[0]
	if got := match.HoldingDate.Format(time.RFC3339); got != "2026-08-20T12:00:00Z" {
		t.Fatalf("holding date = %s, want 2026-08-20T12:00:00Z", got)
	}
	if got := match.RegistrationStartAt.Format(time.RFC3339); got != "2026-08-19T02:00:00Z" {
		t.Fatalf("registration start = %s, want 2026-08-19T02:00:00Z", got)
	}
	if got := match.RegistrationEndAt.Format(time.RFC3339); got != "2026-08-20T10:00:00Z" {
		t.Fatalf("registration end = %s, want 2026-08-20T10:00:00Z", got)
	}
}
