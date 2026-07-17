package domain

import (
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// RegistrationStatus 记录一名球员在某个报名组里的出勤状态。
type RegistrationStatus string

const (
	// RegistrationUnknown 未表态，对应旧库 stand=0（成员被默认带入但未确认）。
	RegistrationUnknown RegistrationStatus = "unknown"
	// RegistrationAttending 参赛。
	RegistrationAttending RegistrationStatus = "attending"
	// RegistrationLeave 请假。
	RegistrationLeave RegistrationStatus = "leave"
	// RegistrationAbsent 缺席（含迟到）。
	RegistrationAbsent RegistrationStatus = "absent"
	// RegistrationCancelled 已取消报名。
	RegistrationCancelled RegistrationStatus = "cancelled"
)

func (s RegistrationStatus) IsValid() bool {
	switch s {
	case RegistrationUnknown, RegistrationAttending, RegistrationLeave, RegistrationAbsent, RegistrationCancelled:
		return true
	}
	return false
}

// Registration 是报名组内单名球员的一条报名记录。
type Registration struct {
	ID                uuid.UUID
	GroupID           uuid.UUID
	UserID            int64
	Status            RegistrationStatus
	RegistrationCount int
	CreatedAt         time.Time
	UpdatedAt         time.Time
	CancelledAt       *time.Time
}

// NewRegistration 构造一条报名记录，校验组、用户、状态与计数。
func NewRegistration(groupID uuid.UUID, userID int64, status RegistrationStatus, count int, now time.Time) (Registration, error) {
	if groupID == uuid.Nil {
		return Registration{}, sharederror.New(sharederror.KindValidation, "报名组无效")
	}
	if userID <= 0 {
		return Registration{}, sharederror.New(sharederror.KindValidation, "报名用户无效")
	}
	if !status.IsValid() {
		return Registration{}, sharederror.New(sharederror.KindValidation, "报名状态无效")
	}
	if count <= 0 {
		return Registration{}, sharederror.New(sharederror.KindValidation, "报名人数必须大于 0")
	}
	return Registration{
		ID:                uuid.New(),
		GroupID:           groupID,
		UserID:            userID,
		Status:            status,
		RegistrationCount: count,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}
