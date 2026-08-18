package avatarstore

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLocalSaveUserAvatar(t *testing.T) {
	dir := t.TempDir()
	store, err := NewLocal(dir)
	if err != nil {
		t.Fatalf("NewLocal() error=%v", err)
	}

	path, err := store.SaveUserAvatar(37, "png", []byte("png-bytes"))
	if err != nil {
		t.Fatalf("SaveUserAvatar() error=%v", err)
	}
	if !strings.HasPrefix(path, "/uploads/avatars/37-") || !strings.HasSuffix(path, ".png") {
		t.Fatalf("unexpected path %q", path)
	}
	data, err := os.ReadFile(filepath.Join(dir, "avatars", filepath.Base(path)))
	if err != nil || string(data) != "png-bytes" {
		t.Fatalf("stored file mismatch: data=%q err=%v", data, err)
	}
}

func TestNewLocalRequiresDir(t *testing.T) {
	if _, err := NewLocal("  "); err == nil {
		t.Fatal("expected error for empty dir")
	}
}
