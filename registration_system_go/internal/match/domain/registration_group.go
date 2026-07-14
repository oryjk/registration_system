package domain

import (
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type GroupKind string

const (
	GroupHostTeam           GroupKind = "host_team"
	GroupGuestTeam          GroupKind = "guest_team"
	GroupIndividualOpponent GroupKind = "individual_opponent"
)

type GroupStatus string

const (
	GroupOpen      GroupStatus = "open"
	GroupClosed    GroupStatus = "closed"
	GroupCancelled GroupStatus = "cancelled"
)

type RegistrationGroup struct {
	ID          uuid.UUID
	MatchID     uuid.UUID
	Kind        GroupKind
	TeamID      *int64
	MinPlayers  *int
	MaxPlayers  *int
	Status      GroupStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CancelledAt *time.Time
}

func NewTeamGroup(matchID uuid.UUID, kind GroupKind, teamID int64, maxPlayers *int, now time.Time) RegistrationGroup {
	return RegistrationGroup{ID: uuid.New(), MatchID: matchID, Kind: kind, TeamID: &teamID, MaxPlayers: maxPlayers, Status: GroupOpen, CreatedAt: now, UpdatedAt: now}
}

func NewIndividualGroup(matchID uuid.UUID, limits IndividualLimits, now time.Time) RegistrationGroup {
	minPlayers := limits.MinPlayers
	maxPlayers := limits.MaxPlayers
	return RegistrationGroup{ID: uuid.New(), MatchID: matchID, Kind: GroupIndividualOpponent, MinPlayers: &minPlayers, MaxPlayers: &maxPlayers, Status: GroupOpen, CreatedAt: now, UpdatedAt: now}
}

func (g *RegistrationGroup) RecalculateIndividualStatus(activePlayers int) error {
	if g.Kind != GroupIndividualOpponent || g.MinPlayers == nil || g.MaxPlayers == nil {
		return sharederror.New(sharederror.KindConflict, "当前报名组不是散人对手组")
	}
	if activePlayers < 0 {
		return sharederror.New(sharederror.KindValidation, "报名人数不能为负数")
	}
	if activePlayers >= *g.MaxPlayers {
		g.Status = GroupClosed
	} else {
		g.Status = GroupOpen
	}
	return nil
}

func (g *RegistrationGroup) Cancel(now time.Time) {
	g.Status = GroupCancelled
	g.CancelledAt = &now
	g.UpdatedAt = now
}
