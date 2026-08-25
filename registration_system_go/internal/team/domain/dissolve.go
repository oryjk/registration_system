package domain

import "github.com/google/uuid"

// DissolveBlockers 列出阻止球队解散的进行中引用：未结束比赛（主队/客队）与进行中的约队申请。
type DissolveBlockers struct {
	Matches      []DissolveBlockerMatch
	Applications []DissolveBlockerApplication
}

// IsEmpty 无任何阻塞引用时才允许解散。
func (b DissolveBlockers) IsEmpty() bool {
	return len(b.Matches) == 0 && len(b.Applications) == 0
}

// DissolveBlockerMatch 引用球队的未结束比赛；IsHost 标记是否本队发起，
// 只有本队发起的比赛才能在比赛详情页由队长收尾/取消。
type DissolveBlockerMatch struct {
	ID     uuid.UUID
	Name   string
	Status string
	IsHost bool
}

// DissolveBlockerApplication 本队提交、仍未了结的约队申请（pending/selected）；
// 队长可在接约页撤回后解除对球队的引用。
type DissolveBlockerApplication struct {
	ID        uuid.UUID
	MatchID   uuid.UUID
	MatchName string
	Status    string
}
