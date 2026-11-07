package domain

import (
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// GroupSide 场馆组局的甲、乙两边；其他比赛类型的报名组为空。
type GroupSide string

const (
	SideA GroupSide = "a"
	SideB GroupSide = "b"
)

// VenueSideState 是一边当前的报名组和有效报名人数。
type VenueSideState struct {
	Group     RegistrationGroup
	Attending int
}

// IsVenueIndividualGroup 判断报名组是否是场馆组局的散人边。
func IsVenueIndividualGroup(group RegistrationGroup) bool {
	return group.Side != nil && group.Kind == GroupIndividualOpponent
}

func newVenueIndividualGroup(matchID uuid.UUID, side GroupSide, limits IndividualLimits, now time.Time) RegistrationGroup {
	group := NewIndividualGroup(matchID, limits, now)
	group.Side = &side
	return group
}

// NewVenueTeamGroup 球队占边后的报名组；与接约客队一样不设成行线，成行按人制计算。
func NewVenueTeamGroup(matchID uuid.UUID, side GroupSide, teamID int64, now time.Time) RegistrationGroup {
	group := NewTeamGroup(matchID, GroupGuestTeam, teamID, nil, nil, now)
	group.Side = &side
	return group
}

// NewVenueOpenGroup 球队退出或被移出后重新开放这一边。
func NewVenueOpenGroup(matchID uuid.UUID, side GroupSide, limits IndividualLimits, now time.Time) (RegistrationGroup, error) {
	if err := limits.Validate(); err != nil {
		return RegistrationGroup{}, err
	}
	return newVenueIndividualGroup(matchID, side, limits, now), nil
}

// SelectVenueIndividualSide 散人不选边：先排甲边，甲边放不下才排乙边，已被球队占的边跳过。
// 这样一个散人报名不会同时挡住两边，球队总有机会占到空着的一边。
func SelectVenueIndividualSide(sides []VenueSideState, count int) (RegistrationGroup, bool) {
	for _, side := range sides {
		if !IsVenueIndividualGroup(side.Group) || side.Group.MaxPlayers == nil {
			continue
		}
		if side.Attending+count <= *side.Group.MaxPlayers {
			return side.Group, true
		}
	}
	return RegistrationGroup{}, false
}

// SelectVenueClaimableSide 球队只能占还没有人报名的散人边。
func SelectVenueClaimableSide(sides []VenueSideState) (RegistrationGroup, bool) {
	for _, side := range sides {
		if IsVenueIndividualGroup(side.Group) && side.Attending == 0 {
			return side.Group, true
		}
	}
	return RegistrationGroup{}, false
}

// VenueSidesReady 两边都达到最低人数才算成行；球队边按人制计算。
func VenueSidesReady(sides []VenueSideState, playersPerTeam int) bool {
	ready := 0
	for _, side := range sides {
		if side.Group.Side == nil {
			continue
		}
		minimum := playersPerTeam
		if side.Group.MinPlayers != nil {
			minimum = *side.Group.MinPlayers
		}
		if side.Attending < minimum {
			return false
		}
		ready++
	}
	return ready == 2
}

// RecalculateVenueOpponent 用已有的对手状态表达场馆组局是否成行。
func (m *Match) RecalculateVenueOpponent(ready bool, now time.Time) error {
	if m.PublicationMode != VenueHosted {
		return sharederror.New(sharederror.KindConflict, "当前比赛不是场馆组局")
	}
	nextState := OpponentRecruiting
	if ready {
		nextState = OpponentConfirmed
	}
	if m.OpponentState != nextState {
		m.OpponentState = nextState
		m.UpdatedAt = now
	}
	return nil
}
