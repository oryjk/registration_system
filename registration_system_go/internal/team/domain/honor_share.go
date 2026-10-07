package domain

import "github.com/google/uuid"

// HonorShare contains only fields a member explicitly chooses to share.
type HonorShare struct {
	ID                                      uuid.UUID
	TeamID, UserID                          int64
	ScoreYear                               int32
	TeamName, Nickname                      string
	TeamDescription, TeamLogoURL, AvatarURL *string
	IsPaidMember, RequiresPassword          bool
	ParticipationPoints, ParticipationRank  int64
}
