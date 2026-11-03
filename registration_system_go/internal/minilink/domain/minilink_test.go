package domain

import (
	"strings"
	"testing"
)

func TestNewChanlunLinkTargetEncodesReturnQueryIntoPathParam(t *testing.T) {
	target, err := NewChanlunLinkTarget("secid=1.600519&timeframe=30m")
	if err != nil {
		t.Fatal(err)
	}
	if target.Path != ChanlunLandingPage || target.Query != "path=secid%3D1.600519%26timeframe%3D30m" {
		t.Fatalf("unexpected target: %+v", target)
	}
}

func TestNewChanlunLinkTargetRejectsUnsafeOrOversizedQuery(t *testing.T) {
	for _, query := range []string{"https://evil.test", "a=1 b", "a=%2F", strings.Repeat("a", MaxReturnQueryLength+1)} {
		if _, err := NewChanlunLinkTarget(query); err == nil {
			t.Fatalf("query %q should be rejected", query)
		}
	}
	if _, err := NewChanlunLinkTarget(strings.Repeat("a", MaxReturnQueryLength)); err != nil {
		t.Fatalf("max length query should pass: %v", err)
	}
}
