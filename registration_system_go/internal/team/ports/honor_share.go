package ports

import (
	"context"
	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

type HonorShareRepository interface {
	CreateHonorShare(context.Context, int64, int64, int32) (uuid.UUID, error)
	FindHonorShare(context.Context, uuid.UUID) (domain.HonorShare, bool, error)
	FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error)
}
type HonorCodeGenerator interface {
	Generate(context.Context, string, string) (string, error)
}
