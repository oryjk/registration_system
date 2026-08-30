package domain

import (
	"testing"
	"time"
)

func TestMatchRecordScore(t *testing.T) {
	base := time.Date(2026, 8, 30, 10, 0, 0, 0, time.UTC)
	match, _, err := NewMatch(withOpponent(validInput(OfflineConfirmed), "客队"), IndividualLimits{})
	if err != nil {
		t.Fatalf("NewMatch() error=%v", err)
	}
	now := base.Add(2 * time.Hour)

	if err := match.RecordScore(1, 0, now); err == nil {
		t.Fatal("registering 状态录入比分应被拒绝")
	}
	if err := match.ChangeStatus(MatchOngoing, now); err != nil {
		t.Fatalf("ChangeStatus(ongoing) error=%v", err)
	}
	if err := match.RecordScore(0, 0, now); err != nil {
		t.Fatalf("进行中录入 0:0 失败: %v", err)
	}
	if match.HostScore == nil || *match.HostScore != 0 || match.AwayScore == nil || *match.AwayScore != 0 {
		t.Fatalf("进行中比分应为 0:0，got %v:%v", match.HostScore, match.AwayScore)
	}
	if err := match.ChangeStatus(MatchEnded, now.Add(time.Hour)); err != nil {
		t.Fatalf("ChangeStatus(ended) error=%v", err)
	}
	if err := match.RecordScore(3, 2, now.Add(90*time.Minute)); err != nil {
		t.Fatalf("结束后补录/修正比分失败: %v", err)
	}
	if *match.HostScore != 3 || *match.AwayScore != 2 {
		t.Fatalf("结束后比分应为 3:2，got %d:%d", *match.HostScore, *match.AwayScore)
	}
	if err := match.RecordScore(-1, 0, now); err == nil {
		t.Fatal("负数比分应被拒绝")
	}
	if err := match.RecordScore(0, maxMatchScore+1, now); err == nil {
		t.Fatal("超过上限的比分应被拒绝")
	}
}

func TestMatchRecordScoreRejectedForCancelled(t *testing.T) {
	match, _, err := NewMatch(withOpponent(validInput(OfflineConfirmed), "客队"), IndividualLimits{})
	if err != nil {
		t.Fatalf("NewMatch() error=%v", err)
	}
	if err := match.ChangeStatus(MatchCancelled, time.Now()); err != nil {
		t.Fatalf("ChangeStatus(cancelled) error=%v", err)
	}
	if err := match.RecordScore(1, 1, time.Now()); err == nil {
		t.Fatal("已取消比赛录入比分应被拒绝")
	}
	if match.HostScore != nil || match.AwayScore != nil {
		t.Fatalf("被拒绝后不应落比分，got %v:%v", match.HostScore, match.AwayScore)
	}
}
