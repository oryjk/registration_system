package mapping

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigReadsOnlySupportedIDMappings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mapping.json")
	content := `{"legacy_mysql":{"users":{"10":"37"},"teams":{"1":"11"}},"legacy_postgres":{"users":{"20":"37"},"matches":{"old-match":"550e8400-e29b-41d4-a716-446655440000"}}}`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	config, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig() error=%v", err)
	}
	if got, ok := config.Lookup(SourceLegacyMySQL, EntityTeam, "1"); !ok || got != "11" {
		t.Fatalf("team mapping=%q found=%v", got, ok)
	}
	if got, ok := config.Lookup(SourceLegacyPostgres, EntityMatch, "old-match"); !ok || got != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("match mapping=%q found=%v", got, ok)
	}
}

func TestLoadConfigRejectsUnknownOrSensitiveFields(t *testing.T) {
	for name, content := range map[string]string{
		"unknown source":        `{"legacy_oracle":{"users":{}}}`,
		"sensitive field":       `{"legacy_mysql":{"openid":{"10":"secret"}}}`,
		"invalid bigint target": `{"legacy_mysql":{"teams":{"1":"not-an-id"}}}`,
		"invalid uuid target":   `{"legacy_postgres":{"matches":{"old":"not-a-uuid"}}}`,
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "mapping.json")
			if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := LoadConfig(path); err == nil {
				t.Fatal("expected invalid mapping error")
			}
		})
	}
}
