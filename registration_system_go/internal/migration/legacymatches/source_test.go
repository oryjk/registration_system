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
		{{"tracked-match", "友谊赛", "待定", 3, 8, now, "球场", (*float64)(nil), (*float64)(nil), (*string)(nil), now, now, int64(1), (*int)(nil)}},
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
