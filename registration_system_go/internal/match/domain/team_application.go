package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type ApplicationStatus string

const (
	ApplicationPending   ApplicationStatus = "pending"
	ApplicationSelected  ApplicationStatus = "selected"
	ApplicationRejected  ApplicationStatus = "rejected"
	ApplicationWithdrawn ApplicationStatus = "withdrawn"
)

type TeamApplication struct {
	ID              uuid.UUID
	MatchID         uuid.UUID
	ApplicantTeamID int64
	Introduction    string
	Status          ApplicationStatus
	CreatedByUserID int64
	SelectedAt      *time.Time
	WithdrawnAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func NewTeamApplication(matchID uuid.UUID, applicantTeamID, createdByUserID int64, introduction string, now time.Time) (TeamApplication, error) {
	introduction = strings.TrimSpace(introduction)
	if matchID == uuid.Nil || applicantTeamID <= 0 || createdByUserID <= 0 || introduction == "" {
		return TeamApplication{}, sharederror.New(sharederror.KindValidation, "球队申请信息不完整")
	}
	return TeamApplication{ID: uuid.New(), MatchID: matchID, ApplicantTeamID: applicantTeamID, Introduction: introduction, Status: ApplicationPending, CreatedByUserID: createdByUserID, CreatedAt: now, UpdatedAt: now}, nil
}
