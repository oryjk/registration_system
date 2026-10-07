package ports

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

var (
	ErrUserRegistrationConflict   = errors.New("user registration persistence conflict")
	ErrUserRegistrationValidation = errors.New("user registration persistence validation failed")
)

type UserRegistrationRepository interface {
	WithinUserRegistrationTransaction(context.Context, func(UserRegistrationTransaction) error) error
}

type UserRegistrationTransaction interface {
	FindMatchForUpdate(context.Context, uuid.UUID) (domain.Match, bool, error)
	FindGroupForUpdate(context.Context, uuid.UUID, uuid.UUID) (domain.RegistrationGroup, bool, error)
	FindUserRegistrationForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
	FindActiveUserRegistrationInMatchForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
	// 调用前持有比赛行锁；专门检查当前组之外的全部有效报名。
	HasOtherActiveRegistrationInMatch(context.Context, uuid.UUID, uuid.UUID, int64) (bool, error)
	CountAttendingForGroup(context.Context, uuid.UUID) (int, error)
	IsActiveTeamMember(context.Context, int64, int64) (bool, error)
	// IsTeamMember 用于管理端出勤补录，包含仍在球队名单中的冻结队员。
	IsTeamMember(context.Context, int64, int64) (bool, error)
	ParticipationAvailableAt(context.Context, uuid.UUID, int64) (time.Time, error)
	SaveRegistration(context.Context, domain.Registration) error
	UpdateGroup(context.Context, domain.RegistrationGroup) error
	UpdateMatchOpponent(context.Context, domain.Match) error
}
