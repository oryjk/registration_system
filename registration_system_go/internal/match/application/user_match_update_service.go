package application

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

// UserMatchUpdater 是用户端编辑比赛所需的最小仓储能力。
type UserMatchUpdater interface {
	FindByID(context.Context, uuid.UUID) (domain.Match, []domain.RegistrationGroup, bool, error)
	UpdateDetails(context.Context, domain.Match, *domain.RegistrationGroup) error
	// UpdateDetailsForModeChange 比赛类型变更：详情更新 + 附带写入（建散人组、拒申请）同事务。
	UpdateDetailsForModeChange(context.Context, domain.Match, *domain.RegistrationGroup, *ports.MatchModeChangeWrites) error
}

// UserMatchUpdateService 小程序端主队管理者编辑比赛：当前开放
// 手工对手名称、主队报名组人数上限、比赛起止时间与比赛类型转换，其余字段保持原值。
type UserMatchUpdateService struct {
	repository UserMatchUpdater
	authorizer TeamManagerAuthorizer
	now        func() time.Time
}

func NewUserMatchUpdateService(repository UserMatchUpdater, authorizer TeamManagerAuthorizer, now func() time.Time) *UserMatchUpdateService {
	return &UserMatchUpdateService{repository: repository, authorizer: authorizer, now: now}
}

// UserUpdateMatchCommand 字段为 nil 表示本次不改；OpponentName 空串表示清除。
// StartTime/EndTime 允许设为过去时间（补录历史赛果场景），仅需 End 晚于 Start。
// PublicationMode 仅支持线上约队（尚无球队接招）转为线下已约或散人对手。
type UserUpdateMatchCommand struct {
	OpponentName      *string
	HostCapacityLimit *int
	StartTime         *time.Time
	EndTime           *time.Time
	PublicationMode   *domain.PublicationMode
}

func (s UserMatchUpdateService) UpdateDetails(ctx context.Context, actor sharedauth.Actor, id uuid.UUID, command UserUpdateMatchCommand) (domain.Match, error) {
	if !actor.IsUser() {
		return domain.Match{}, sharederror.ErrForbidden
	}
	if command.OpponentName == nil && command.HostCapacityLimit == nil && command.StartTime == nil && command.EndTime == nil && command.PublicationMode == nil {
		return domain.Match{}, sharederror.New(sharederror.KindValidation, "没有要修改的内容")
	}
	match, groups, found, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if match.HostTeamID == nil {
		return domain.Match{}, sharederror.New(sharederror.KindValidation, "该比赛没有主队，暂不支持在此修改")
	}
	if err := s.authorizer.EnsureManager(ctx, *match.HostTeamID, actor.ID); err != nil {
		return domain.Match{}, err
	}
	now := s.now()
	var modeWrites *ports.MatchModeChangeWrites
	if command.PublicationMode != nil && *command.PublicationMode != match.PublicationMode {
		if err := match.SwitchFromTeamRecruitment(*command.PublicationMode, now); err != nil {
			return domain.Match{}, err
		}
		// 离开线上约队：待处理球队申请一并拒绝；转散人对手还需创建散人报名组。
		modeWrites = &ports.MatchModeChangeWrites{RejectTeamApplications: true}
		if *command.PublicationMode == domain.OnlineIndividual {
			limits, limitsErr := domain.ResolveIndividualLimits(match.PlayersPerTeam, nil)
			if limitsErr != nil {
				return domain.Match{}, limitsErr
			}
			group := domain.NewIndividualGroup(match.ID, limits, now)
			modeWrites.CreateIndividualGroup = &group
		}
	}
	// 其余字段回填当前值：domain 会重跑完整校验并拦截已结束/已取消的比赛，
	// 同时校验类型转换后的规则（线下已约必须有对手名称等）。
	startTime, endTime := match.StartTime, match.EndTime
	if command.StartTime != nil {
		startTime = *command.StartTime
	}
	if command.EndTime != nil {
		endTime = *command.EndTime
	}
	if err := match.UpdateDetails(domain.UpdateMatchDetails{
		Name: match.Name, StartTime: startTime, EndTime: endTime,
		RegistrationStartAt: match.RegistrationStartAt, RegistrationEndAt: match.RegistrationEndAt,
		Location: match.Location, LocationLatitude: match.LocationLatitude, LocationLongitude: match.LocationLongitude,
		Description: match.Description, OpponentName: command.OpponentName,
		HostColor: nil, AwayColor: nil,
	}, now); err != nil {
		return domain.Match{}, err
	}
	var hostGroup *domain.RegistrationGroup
	if command.HostCapacityLimit != nil {
		hostGroup = findUserMatchHostGroup(groups)
		if hostGroup == nil {
			return domain.Match{}, sharederror.New(sharederror.KindInternal, "主队报名组不存在")
		}
		if err := hostGroup.UpdateHostCapacity(*command.HostCapacityLimit, now); err != nil {
			return domain.Match{}, err
		}
	}
	if modeWrites != nil {
		if err = s.repository.UpdateDetailsForModeChange(ctx, match, hostGroup, modeWrites); err != nil {
			return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛失败", err)
		}
	} else if err := s.repository.UpdateDetails(ctx, match, hostGroup); err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "更新比赛失败", err)
	}
	return match, nil
}

func findUserMatchHostGroup(groups []domain.RegistrationGroup) *domain.RegistrationGroup {
	for index := range groups {
		if groups[index].Kind == domain.GroupHostTeam {
			return &groups[index]
		}
	}
	return nil
}
