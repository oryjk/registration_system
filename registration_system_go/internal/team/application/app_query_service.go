package application

import (
	"context"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

type AppTeamDetail struct {
	Team       domain.Team
	MyRole     domain.Role
	Membership ports.AppMembershipState
}

type AppTeamMember struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
	RealName  *string
	Role      domain.Role
	Status    domain.MemberStatus
	JoinedAt  time.Time
}

type AppQueryService struct {
	repository ports.AppQueryRepository
}

func NewAppQueryService(repository ports.AppQueryRepository) AppQueryService {
	return AppQueryService{repository: repository}
}

func (s AppQueryService) GetTeam(ctx context.Context, actor sharedauth.Actor, teamID int64) (AppTeamDetail, error) {
	team, member, err := s.authorize(ctx, actor, teamID)
	if err != nil {
		return AppTeamDetail{}, err
	}
	membership, err := s.repository.GetTeamMembershipState(ctx, teamID)
	if err != nil {
		return AppTeamDetail{}, sharederror.Wrap(sharederror.KindInternal, "查询球队会员状态失败", err)
	}
	return AppTeamDetail{Team: team, MyRole: member.Role, Membership: membership}, nil
}

func (s AppQueryService) ListMembers(ctx context.Context, actor sharedauth.Actor, teamID int64) ([]AppTeamMember, error) {
	if _, _, err := s.authorize(ctx, actor, teamID); err != nil {
		return nil, err
	}
	rows, err := s.repository.ListAppMembers(ctx, teamID)
	if err != nil {
		return nil, sharederror.Wrap(sharederror.KindInternal, "查询球队成员失败", err)
	}
	items := make([]AppTeamMember, 0, len(rows))
	for _, row := range rows {
		items = append(items, AppTeamMember{
			UserID: row.UserID, Nickname: row.Nickname, AvatarURL: row.AvatarURL,
			RealName: row.RealName, Role: row.Role, Status: row.Status, JoinedAt: row.JoinedAt,
		})
	}
	return items, nil
}

func (s AppQueryService) authorize(ctx context.Context, actor sharedauth.Actor, teamID int64) (domain.Team, domain.Member, error) {
	team, found, err := s.repository.FindByID(ctx, teamID)
	if err != nil {
		return domain.Team{}, domain.Member{}, sharederror.Wrap(sharederror.KindInternal, "查询球队失败", err)
	}
	if !found {
		return domain.Team{}, domain.Member{}, sharederror.New(sharederror.KindNotFound, "球队不存在")
	}
	if !actor.IsUser() || team.Status != domain.TeamActive {
		return domain.Team{}, domain.Member{}, sharederror.ErrForbidden
	}
	member, found, err := s.repository.FindActiveMember(ctx, teamID, actor.ID)
	if err != nil {
		return domain.Team{}, domain.Member{}, sharederror.Wrap(sharederror.KindInternal, "查询球队权限失败", err)
	}
	if !found {
		return domain.Team{}, domain.Member{}, sharederror.ErrForbidden
	}
	return team, member, nil
}
