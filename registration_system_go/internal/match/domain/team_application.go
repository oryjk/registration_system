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

func (a *TeamApplication) Select(now time.Time) error {
	if a.Status != ApplicationPending {
		return sharederror.New(sharederror.KindConflict, "只有待选择的球队申请可以入选")
	}
	a.Status = ApplicationSelected
	a.SelectedAt = &now
	a.WithdrawnAt = nil
	a.UpdatedAt = now
	return nil
}

func (a *TeamApplication) Reject(now time.Time) error {
	if a.Status != ApplicationPending {
		return sharederror.New(sharederror.KindConflict, "只有待选择的球队申请可以拒绝")
	}
	a.Status = ApplicationRejected
	a.SelectedAt = nil
	a.WithdrawnAt = nil
	a.UpdatedAt = now
	return nil
}

func (a *TeamApplication) Withdraw(now time.Time) error {
	if a.Status != ApplicationPending && a.Status != ApplicationSelected {
		return sharederror.New(sharederror.KindConflict, "当前球队申请不能撤回")
	}
	a.Status = ApplicationWithdrawn
	a.WithdrawnAt = &now
	a.UpdatedAt = now
	return nil
}
