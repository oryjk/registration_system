package testsupport

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// newMigratedSchemaForDown 自建隔离 schema 并跑全量 goose Up，返回绑定了该 schema 的
// 池连接与 goose 用的 database/sql 连接；用于验证迁移 Down 的真实可执行性。
func newMigratedSchemaForDown(t *testing.T) (*pgxpool.Pool, *sql.DB) {
	t.Helper()
	databaseURL := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured; skipping PostgreSQL integration test")
	}
	admin, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("open TEST_DATABASE_URL: %v", err)
	}
	t.Cleanup(admin.Close)

	bytes := make([]byte, 6)
	if _, err := rand.Read(bytes); err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("goose_down_%s", hex.EncodeToString(bytes))
	if _, err := admin.Exec(context.Background(),
		fmt.Sprintf("CREATE SCHEMA %s", pgx.Identifier{schema}.Sanitize())); err != nil {
		t.Fatalf("create isolated test schema: %v", err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(context.Background(),
			fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", pgx.Identifier{schema}.Sanitize())); err != nil {
			t.Logf("drop isolated test schema %s: %v", schema, err)
		}
	})

	connConfig, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		t.Fatalf("parse TEST_DATABASE_URL: %v", err)
	}
	connConfig.RuntimeParams["search_path"] = schema
	migrationDSN := stdlib.RegisterConnConfig(connConfig)
	database, err := sql.Open("pgx", migrationDSN)
	if err != nil {
		t.Fatalf("open migration database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test support source path")
	}
	dir := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "db", "migrations"))
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(database, dir); err != nil {
		t.Fatalf("goose up: %v", err)
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	poolConfig.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool, database
}

// 00036 的 Down 必须能被 goose 正确解析并执行（DO 块需 StatementBegin/End 包裹，
// 否则按内部分号截断报 unterminated dollar-quoted string），无资金流水时干净回滚到 35。
func TestGooseDown00036RollsBackCleanWithoutFundRows(t *testing.T) {
	pool, database := newMigratedSchemaForDown(t)
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test support source path")
	}
	dir := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "db", "migrations"))
	if err := goose.DownTo(database, dir, 35); err != nil {
		t.Fatalf("goose down 00036 must run cleanly without fund rows: %v", err)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = 'team_fund_transactions'
		  AND column_name IN ('created_by_user_id', 'reversed_by_transaction_id')`,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("00036 columns must be dropped on rollback, got %d remaining", count)
	}
}

// 已有人工消费/冲正流水时，00036 的 Down 必须拒绝执行（保护资金流水不被删除导致账实脱节）。
func TestGooseDown00036RefusesWithManualFundRows(t *testing.T) {
	pool, database := newMigratedSchemaForDown(t)
	ctx := context.Background()
	var userID, teamID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (openid) VALUES ('goose-down-guard') RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('goose 回滚保护队') RETURNING id`).Scan(&teamID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')`, teamID, userID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_fund_transactions (team_id, user_id, amount_cents, balance_after_cents, source, source_id)
		VALUES ($1, $2, -100, -100, 'manual_consume', 'goose-down-guard-1')`, teamID, userID); err != nil {
		t.Fatal(err)
	}

	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test support source path")
	}
	dir := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "db", "migrations"))
	err := goose.DownTo(database, dir, 35)
	if err == nil {
		t.Fatal("goose down 00036 must refuse when manual fund rows exist")
	}
	if !strings.Contains(err.Error(), "禁止回滚") {
		t.Fatalf("refusal must come from the guard, got: %v", err)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM team_fund_transactions WHERE source = 'manual_consume'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("fund rows must survive the refused rollback, got %d", count)
	}
}
