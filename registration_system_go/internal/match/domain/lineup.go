package domain

import (
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

const (
	MinLineupPlayers = 5
	MaxLineupPlayers = 11
)

// supportedLineupFormations 定义各人制支持的阵型列表（与小程序端保持完全一致）。
var supportedLineupFormations = map[int][]string{
	5:  {"1-2-1", "2-2", "1-1-2", "2-1-1"},
	6:  {"2-2-1", "2-1-2", "1-3-1"},
	7:  {"2-3-1", "3-2-1", "2-2-2"},
	8:  {"3-3-1", "2-3-2", "3-2-2", "2-4-1", "3-1-3"},
	9:  {"3-3-2", "3-4-1", "4-3-1"},
	10: {"4-3-2", "3-4-2", "4-4-1"},
	11: {"4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"},
}

// LineupSlot 表示阵型中的一个首发位置及其位置坐标与替补球员列表。
type LineupSlot struct {
	Slot         int     `json:"slot"`
	PlayerID     *int64  `json:"player_id"`
	X            float64 `json:"x"`
	Y            float64 `json:"y"`
	SubPlayerIDs []int64 `json:"sub_player_ids"`
}

// MatchLineup 表示某场比赛保存的当前排阵。
type MatchLineup struct {
	MatchID         uuid.UUID
	PlayersPerTeam  int
	Formation       string
	Slots           []LineupSlot
	UpdatedByUserID *int64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// IsSupportedLineupPlayers 判断比赛人制是否在支持排阵的 5..11 人制范围内。
func IsSupportedLineupPlayers(playersPerTeam int) bool {
	return playersPerTeam >= MinLineupPlayers && playersPerTeam <= MaxLineupPlayers
}

// SupportedLineupFormations 返回指定人制支持的阵型列表副本；不支持的人制返回 nil。
func SupportedLineupFormations(playersPerTeam int) []string {
	list, ok := supportedLineupFormations[playersPerTeam]
	if !ok {
		return nil
	}
	copied := make([]string, len(list))
	copy(copied, list)
	return copied
}

// IsSupportedLineupFormation 判断指定人制是否支持给定阵型名称。
func IsSupportedLineupFormation(playersPerTeam int, formation string) bool {
	list, ok := supportedLineupFormations[playersPerTeam]
	if !ok {
		return false
	}
	for _, candidate := range list {
		if candidate == formation {
			return true
		}
	}
	return false
}

// NewMatchLineup 校验并构造规范化的比赛阵型对象。
func NewMatchLineup(matchID uuid.UUID, playersPerTeam int, formation string, slots []LineupSlot, updatedByUserID int64, now time.Time) (MatchLineup, error) {
	if matchID == uuid.Nil {
		return MatchLineup{}, sharederror.New(sharederror.KindValidation, "比赛 ID 无效")
	}
	if !IsSupportedLineupPlayers(playersPerTeam) {
		return MatchLineup{}, sharederror.New(sharederror.KindValidation, "当前比赛人制暂不支持排阵型（仅支持 5 至 11 人制）")
	}
	trimmedFormation := strings.TrimSpace(formation)
	if !IsSupportedLineupFormation(playersPerTeam, trimmedFormation) {
		return MatchLineup{}, sharederror.New(sharederror.KindValidation, "该人制不支持所选阵型")
	}
	normalizedSlots, err := normalizeAndValidateLineupSlots(playersPerTeam, slots)
	if err != nil {
		return MatchLineup{}, err
	}
	if now.IsZero() {
		now = time.Now().UTC()
	} else {
		now = now.UTC()
	}
	var editorID *int64
	if updatedByUserID > 0 {
		id := updatedByUserID
		editorID = &id
	}
	return MatchLineup{
		MatchID:         matchID,
		PlayersPerTeam:  playersPerTeam,
		Formation:       trimmedFormation,
		Slots:           normalizedSlots,
		UpdatedByUserID: editorID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}, nil
}

// NormalizeLineupSlots 确保读取后的每个槽位 sub_player_ids 都为非 nil 切片，避免 JSON 序列化成 null。
func NormalizeLineupSlots(slots []LineupSlot) []LineupSlot {
	if len(slots) == 0 {
		return []LineupSlot{}
	}
	normalized := make([]LineupSlot, len(slots))
	for i, s := range slots {
		var playerID *int64
		if s.PlayerID != nil {
			id := *s.PlayerID
			playerID = &id
		}
		subs := make([]int64, len(s.SubPlayerIDs))
		copy(subs, s.SubPlayerIDs)
		normalized[i] = LineupSlot{
			Slot:         s.Slot,
			PlayerID:     playerID,
			X:            s.X,
			Y:            s.Y,
			SubPlayerIDs: subs,
		}
	}
	return normalized
}

// CollectPlayerIDs 按槽位顺序去重收集阵型中出现的所有主力与替补用户 ID。
func (l MatchLineup) CollectPlayerIDs() []int64 {
	return CollectLineupPlayerIDs(l.Slots)
}

// CollectLineupPlayerIDs 按槽位顺序去重收集 slots 中的主力与替补用户 ID。
func CollectLineupPlayerIDs(slots []LineupSlot) []int64 {
	seen := make(map[int64]struct{}, len(slots)*2)
	ids := make([]int64, 0, len(slots)*2)
	for _, s := range slots {
		if s.PlayerID != nil && *s.PlayerID > 0 {
			if _, exists := seen[*s.PlayerID]; !exists {
				seen[*s.PlayerID] = struct{}{}
				ids = append(ids, *s.PlayerID)
			}
		}
		for _, subID := range s.SubPlayerIDs {
			if subID > 0 {
				if _, exists := seen[subID]; !exists {
					seen[subID] = struct{}{}
					ids = append(ids, subID)
				}
			}
		}
	}
	return ids
}

func normalizeAndValidateLineupSlots(playersPerTeam int, slots []LineupSlot) ([]LineupSlot, error) {
	if len(slots) != playersPerTeam {
		return nil, sharederror.New(sharederror.KindValidation, "阵型位置数量与赛制人数不匹配")
	}
	seenSlots := make([]bool, playersPerTeam)
	normalized := make([]LineupSlot, playersPerTeam)
	usedPlayers := make(map[int64]struct{}, playersPerTeam*2)

	for _, s := range slots {
		if s.Slot < 0 || s.Slot >= playersPerTeam {
			return nil, sharederror.New(sharederror.KindValidation, "阵型位置编号超出赛制范围")
		}
		if seenSlots[s.Slot] {
			return nil, sharederror.New(sharederror.KindValidation, "阵型位置编号不能重复")
		}
		seenSlots[s.Slot] = true

		if !validLineupCoord(s.X) || !validLineupCoord(s.Y) {
			return nil, sharederror.New(sharederror.KindValidation, "球员坐标必须在 0 到 1 之间")
		}

		var playerID *int64
		if s.PlayerID != nil {
			if *s.PlayerID <= 0 {
				return nil, sharederror.New(sharederror.KindValidation, "主力球员 ID 无效")
			}
			if _, exists := usedPlayers[*s.PlayerID]; exists {
				return nil, sharederror.New(sharederror.KindValidation, "同一球员不能在阵型中重复出现")
			}
			usedPlayers[*s.PlayerID] = struct{}{}
			id := *s.PlayerID
			playerID = &id
		}

		subs := make([]int64, 0, len(s.SubPlayerIDs))
		for _, subID := range s.SubPlayerIDs {
			if subID <= 0 {
				return nil, sharederror.New(sharederror.KindValidation, "替补球员 ID 无效")
			}
			if _, exists := usedPlayers[subID]; exists {
				return nil, sharederror.New(sharederror.KindValidation, "同一球员不能在阵型中重复出现")
			}
			usedPlayers[subID] = struct{}{}
			subs = append(subs, subID)
		}

		normalized[s.Slot] = LineupSlot{
			Slot:         s.Slot,
			PlayerID:     playerID,
			X:            s.X,
			Y:            s.Y,
			SubPlayerIDs: subs,
		}
	}
	return normalized, nil
}

func validLineupCoord(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 && v <= 1
}
