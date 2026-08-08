package mapping

import (
	"testing"
	"time"
)

func TestCanonicalFingerprintVersionOne(t *testing.T) {
	value := map[string]any{
		"updated_at":  time.Date(2026, 8, 8, 8, 9, 10, 123, time.FixedZone("CST", 8*60*60)),
		"name":        "王睿",
		"description": nil,
		"active":      true,
	}
	canonical, digest, err := CanonicalJSONAndFingerprint(value)
	if err != nil {
		t.Fatalf("fingerprint: %v", err)
	}
	const wantJSON = `{"active":true,"description":null,"name":"王睿","updated_at":"2026-08-08T00:09:10.000000123Z"}`
	const wantDigest = "6acd25b01fcf710f51baf2d49a774b1557fe2b6dc06d0b5e6f52a6b5a78ab366"
	if string(canonical) != wantJSON || digest != wantDigest {
		t.Fatalf("canonical=%s digest=%s", canonical, digest)
	}
}

func TestCanonicalFingerprintRejectsUnsupportedValues(t *testing.T) {
	if _, _, err := CanonicalJSONAndFingerprint(map[string]any{"channel": make(chan int)}); err == nil {
		t.Fatal("expected unsupported value error")
	}
}
