package main

import (
	"testing"
	"time"
)

func TestHistoricalOperationTimeRecovery(t *testing.T) {
	opening := time.Date(2026, 1, 4, 0, 0, 0, 0, time.UTC)
	start := opening.Add(4 * 24 * time.Hour)
	op := opening.Add(30 * time.Minute)
	candidate := candidate{OperationTime: opening.Add(3 * 24 * time.Hour), Start: start, Created: opening, GroupCreated: opening}
	legacy := legacyResponse{OperationTime: op, Created: start.Add(8 * time.Hour), Opening: &opening, Start: start, Stand: 1}
	update, ok := calculate(candidate, &legacy)
	if !ok || !update.ResponseAt.Equal(op) || update.Bonus != 30 || update.Source != "legacy-operation-time" {
		t.Fatalf("operation time ignored: %+v ok=%v", update, ok)
	}
}

func TestHistoricalLeaveTimeAndLateAdminBackfill(t *testing.T) {
	opening := time.Now().UTC()
	deadline := opening.Add(24 * time.Hour)
	candidate := candidate{OperationTime: opening.Add(2 * time.Hour), Start: opening.Add(48 * time.Hour), Created: opening, GroupCreated: opening, Deadline: &deadline}
	legacy := legacyResponse{OperationTime: opening.Add(time.Minute), Created: opening, Opening: &opening, Start: candidate.Start, Stand: 2}
	u, ok := calculate(candidate, &legacy)
	if !ok || u.Bonus != 30 {
		t.Fatalf("first leave must retain response bonus: %+v", u)
	}
	u, ok = calculate(candidate, nil)
	if !ok || u.Bonus != 24 {
		t.Fatalf("native operation time=%+v", u)
	}
	candidate.OperationTime = deadline
	u, ok = calculate(candidate, nil)
	if !ok || u.Bonus != 0 {
		t.Fatalf("late admin correction received bonus: %+v", u)
	}
}

func TestHistoricalUnknownAndClockSkew(t *testing.T) {
	opening := time.Now().UTC()
	c := candidate{OperationTime: opening, Start: opening.Add(time.Hour), Created: opening.Add(time.Second), GroupCreated: opening.Add(time.Second)}
	old := legacyResponse{OperationTime: opening, Created: opening, Start: c.Start, Stand: 0}
	if _, ok := calculate(c, &old); ok {
		t.Fatal("unknown placeholder counted as a response")
	}
	u, ok := calculate(c, nil)
	if !ok || u.Bonus != 30 || !u.ResponseAt.Equal(opening) {
		t.Fatalf("minor legacy insertion clock skew: %+v", u)
	}
	c.OperationTime = opening.Add(-time.Hour)
	u, ok = calculate(c, nil)
	if !ok || u.Bonus != 0 {
		t.Fatalf("materially early invalid time granted reward: %+v", u)
	}
}
