package main

import (
	"path/filepath"
	"testing"
)

func TestRunRequiresExistingMigrationDir(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "no-such-dir")
	if err := run("postgres://user:pass@127.0.0.1:1/db?sslmode=disable", missing); err == nil {
		t.Fatal("不存在的迁移目录应当报错")
	}
}

func TestRunRejectsBlankDatabaseURL(t *testing.T) {
	if err := run("", "db/migrations"); err == nil {
		t.Fatal("空 DATABASE_URL 应当报错")
	}
}
