package mapping

import "testing"

func TestParseModeAcceptsOnlyIncrementalAndFull(t *testing.T) {
	for raw, want := range map[string]Mode{"": ModeIncremental, "incremental": ModeIncremental, "full": ModeFull} {
		got, err := ParseMode(raw)
		if err != nil || got != want {
			t.Fatalf("ParseMode(%q)=%q error=%v", raw, got, err)
		}
	}
	if _, err := ParseMode("truncate"); err == nil {
		t.Fatal("expected invalid mode error")
	}
}
