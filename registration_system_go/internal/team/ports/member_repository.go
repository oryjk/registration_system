package ports

import (
	"context"
	"errors"

	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

var (
	ErrMemberAlreadyExists = errors.New("team member already exists")
	ErrMemberNotFound      = errors.New("team member not found")
	ErrUserNotFound        = errors.New("user not found")
)

type MemberRepository interface {
	FindByID(context.Context, int64) (domain.Team, bool, error)
	ListMembers(context.Context, int64) ([]domain.MemberDetails, error)
	ListMemberCandidates(context.Context, int64, string, int) ([]domain.MemberCandidate, error)
	AddMember(context.Context, int64, int64, domain.Role) error
	UpdateMember(context.Context, int64, int64, domain.Role, domain.MemberStatus) (bool, error)
	// RemoveMember 移除成员（硬删），同一事务内取消其在本队未开始比赛中的球队组报名；
	// 进行中/已完赛/已取消比赛与已支付报名保留。
	RemoveMember(context.Context, int64, int64) (bool, error)
	SetCaptain(context.Context, int64, *int64) error
}
