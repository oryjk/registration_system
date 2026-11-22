package domain

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func lineupInt64Ptr(v int64) *int64 { return &v }

func makeValidLineupSlots(n int) []LineupSlot {
	slots := make([]LineupSlot, n)
	for i := 0; i < n; i++ {
		slots[i] = LineupSlot{
			Slot: i,
			X:    0.5,
			Y:    float64(i) / float64(n),
		}
	}
	return slots
}

func TestLineupSupportedFormationsMatchSpec(t *testing.T) {
	expected := map[int][]string{
		5:  {"1-2-1", "2-2", "1-1-2", "2-1-1"},
		6:  {"2-2-1", "2-1-2", "1-3-1"},
		7:  {"2-3-1", "3-2-1", "2-2-2"},
		8:  {"3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"},
		9:  {"3-3-2", "3-4-1", "4-3-1"},
		10: {"4-3-2", "3-4-2", "4-4-1"},
		11: {"4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"},
	}

	for players, formations := range expected {
		got := SupportedLineupFormations(players)
		if len(got) != len(formations) {
			t.Fatalf("%d人制阵型数量不符: got=%v want=%v", players, got, formations)
		}
		for i, want := range formations {
			if got[i] != want {
				t.Fatalf("%d人制第%d个阵型不符: got=%q want=%q", players, i, got[i], want)
			}
			if !IsSupportedLineupFormation(players, want) {
				t.Fatalf("%d人制应支持 %q", players, want)
			}
		}
	}
	if IsSupportedLineupPlayers(4) || IsSupportedLineupPlayers(12) {
		t.Fatal("4人制与12人制不应受支持")
	}
	if SupportedLineupFormations(4) != nil || SupportedLineupFormations(12) != nil {
		t.Fatal("不支持的人制应返回 nil")
	}
}

func TestNewMatchLineupNormalizesSlotsAndCollectsPlayerIDs(t *testing.T) {
	matchID := uuid.New()
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)

	// 乱序传入 slot，且部分 sub_player_ids 为 nil、部分 player_id 为 nil
	input := []LineupSlot{
		{Slot: 2, PlayerID: nil, X: 0.2, Y: 0.5, SubPlayerIDs: nil},
		{Slot: 0, PlayerID: lineupInt64Ptr(10), X: 0.5, Y: 0.9, SubPlayerIDs: []int64{20, 21}},
		{Slot: 4, PlayerID: lineupInt64Ptr(14), X: 0.5, Y: 0.1, SubPlayerIDs: nil},
		{Slot: 1, PlayerID: lineupInt64Ptr(11), X: 0.3, Y: 0.7, SubPlayerIDs: []int64{}},
		{Slot: 3, PlayerID: nil, X: 0.8, Y: 0.5, SubPlayerIDs: []int64{22}},
	}

	lineup, err := NewMatchLineup(matchID, 5, " 1-2-1 ", input, 99, now)
	if err != nil {
		t.Fatalf("合法阵型不应报错: %v", err)
	}
	if lineup.MatchID != matchID || lineup.PlayersPerTeam != 5 || lineup.Formation != "1-2-1" {
		t.Fatalf("基础字段不符: %+v", lineup)
	}
	if lineup.UpdatedByUserID == nil || *lineup.UpdatedByUserID != 99 {
		t.Fatalf("updated_by_user_id 不符: %+v", lineup.UpdatedByUserID)
	}
	if len(lineup.Slots) != 5 {
		t.Fatalf("slots 长度应为 5，得到 %d", len(lineup.Slots))
	}
	for i, s := range lineup.Slots {
		if s.Slot != i {
			t.Fatalf("slot 应按 0..N-1 规范排序: index=%d slot=%d", i, s.Slot)
		}
		if s.SubPlayerIDs == nil {
			t.Fatalf("slot %d 的 sub_player_ids 不得为 nil", i)
		}
	}

	raw, err := json.Marshal(lineup.Slots)
	if err != nil {
		t.Fatalf("marshal slots: %v", err)
	}
	if string(raw) == "" {
		t.Fatal("serialized json empty")
	}
	var decoded []map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal slots: %v", err)
	}
	for i, item := range decoded {
		if item["sub_player_ids"] == nil {
			t.Fatalf("slot %d JSON 序列化后 sub_player_ids 不能为 null: %s", i, string(raw))
		}
	}

	ids := lineup.CollectPlayerIDs()
	wantIDs := []int64{10, 20, 21, 11, 22, 14}
	if len(ids) != len(wantIDs) {
		t.Fatalf("CollectPlayerIDs 不符: got=%v want=%v", ids, wantIDs)
	}
	for i := range wantIDs {
		if ids[i] != wantIDs[i] {
			t.Fatalf("CollectPlayerIDs[%d] = %d, want %d", i, ids[i], wantIDs[i])
		}
	}
}

func TestNewMatchLineupValidationErrors(t *testing.T) {
	matchID := uuid.New()
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name           string
		playersPerTeam int
		formation      string
		slots          []LineupSlot
	}{
		{
			name:           "players below 5",
			playersPerTeam: 4,
			formation:      "1-2-1",
			slots:          makeValidLineupSlots(4),
		},
		{
			name:           "players above 11",
			playersPerTeam: 12,
			formation:      "4-3-3",
			slots:          makeValidLineupSlots(12),
		},
		{
			name:           "unsupported formation for players_per_team",
			playersPerTeam: 5,
			formation:      "4-3-3",
			slots:          makeValidLineupSlots(5),
		},
		{
			name:           "wrong slot count",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots:          makeValidLineupSlots(4),
		},
		{
			name:           "duplicate slot index",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: []LineupSlot{
				{Slot: 0, X: 0.5, Y: 0.9},
				{Slot: 0, X: 0.3, Y: 0.7},
				{Slot: 2, X: 0.7, Y: 0.7},
				{Slot: 3, X: 0.5, Y: 0.5},
				{Slot: 4, X: 0.5, Y: 0.2},
			},
		},
		{
			name:           "out of range slot index",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: []LineupSlot{
				{Slot: 1, X: 0.5, Y: 0.9},
				{Slot: 2, X: 0.3, Y: 0.7},
				{Slot: 3, X: 0.7, Y: 0.7},
				{Slot: 4, X: 0.5, Y: 0.5},
				{Slot: 5, X: 0.5, Y: 0.2},
			},
		},
		{
			name:           "negative x",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].X = -0.01
				return s
			}(),
		},
		{
			name:           "y greater than 1",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].Y = 1.01
				return s
			}(),
		},
		{
			name:           "NaN coordinate",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[1].X = math.NaN()
				return s
			}(),
		},
		{
			name:           "Inf coordinate",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[2].Y = math.Inf(1)
				return s
			}(),
		},
		{
			name:           "non-positive starter player_id",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].PlayerID = lineupInt64Ptr(0)
				return s
			}(),
		},
		{
			name:           "non-positive sub player_id",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].SubPlayerIDs = []int64{-1}
				return s
			}(),
		},
		{
			name:           "duplicate starter player_id",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].PlayerID = lineupInt64Ptr(7)
				s[1].PlayerID = lineupInt64Ptr(7)
				return s
			}(),
		},
		{
			name:           "starter also listed as sub in same slot",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].PlayerID = lineupInt64Ptr(7)
				s[0].SubPlayerIDs = []int64{7}
				return s
			}(),
		},
		{
			name:           "starter also listed as sub in another slot",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].PlayerID = lineupInt64Ptr(7)
				s[2].SubPlayerIDs = []int64{7}
				return s
			}(),
		},
		{
			name:           "duplicate sub across slots",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].SubPlayerIDs = []int64{8}
				s[1].SubPlayerIDs = []int64{8}
				return s
			}(),
		},
		{
			name:           "duplicate sub within same slot",
			playersPerTeam: 5,
			formation:      "1-2-1",
			slots: func() []LineupSlot {
				s := makeValidLineupSlots(5)
				s[0].SubPlayerIDs = []int64{8, 8}
				return s
			}(),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewMatchLineup(matchID, tc.playersPerTeam, tc.formation, tc.slots, 1, now)
			if err == nil {
				t.Fatalf("期望校验失败，但返回 nil")
			}
			if !sharederror.ErrValidation.Is(err) {
				t.Fatalf("期望 KindValidation 错误，得到 %v", err)
			}
		})
	}
}
