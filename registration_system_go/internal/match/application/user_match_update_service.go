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

// UserMatchUpdateService 为主队管理者和散人约球创建者保存原发布表单。
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
	PlayersPerTeam    *int
	FeeType           *domain.FeeType
	PaymentMode       *domain.PaymentMode
	FeePerPersonCents *int64
	LocationLatitude  *float64
	LocationLongitude *float64
	HostColor         *string
	AwayColor         *string
	Name              *string
	Location          *string
	Description       *string
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
	if command.PlayersPerTeam == nil && command.FeeType == nil && command.PaymentMode == nil && command.FeePerPersonCents == nil && command.LocationLatitude == nil && command.LocationLongitude == nil && command.HostColor == nil && command.AwayColor == nil && command.Name == nil && command.Location == nil && command.Description == nil && command.OpponentName == nil && command.HostCapacityLimit == nil && command.StartTime == nil && command.EndTime == nil && command.PublicationMode == nil {
		return domain.Match{}, sharederror.New(sharederror.KindValidation, "没有要修改的内容")
	}
	match, groups, found, err := s.repository.FindByID(ctx, id)
	if err != nil {
		return domain.Match{}, sharederror.Wrap(sharederror.KindInternal, "查询比赛失败", err)
	}
	if !found {
		return domain.Match{}, sharederror.New(sharederror.KindNotFound, "比赛不存在")
	}
	if match.PublicationMode == domain.OnlinePickup {
		if match.CreatedByUserID == nil || *match.CreatedByUserID != actor.ID {
			return domain.Match{}, sharederror.ErrForbidden
		}
	} else {
		if match.HostTeamID == nil {
			return domain.Match{}, sharederror.ErrForbidden
		}
		if err := s.authorizer.EnsureManager(ctx, *match.HostTeamID, actor.ID); err != nil {
			return domain.Match{}, err
		}
	}
	if command.PlayersPerTeam != nil {
		match.PlayersPerTeam = *command.PlayersPerTeam
	}
	if command.FeeType != nil || command.PaymentMode != nil || command.FeePerPersonCents != nil {
		kind, mode, cents := match.FeeType, match.PaymentMode, match.FeePerPersonCents
		if command.FeeType != nil {
			kind = *command.FeeType
		}
		if command.PaymentMode != nil {
			mode = *command.PaymentMode
		}
		if command.FeePerPersonCents != nil {
			cents = *command.FeePerPersonCents
		}
		if err := match.UpdateFeeConfig(kind, mode, cents); err != nil {
			return domain.Match{}, err
		}
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
	name, location, description := match.Name, match.Location, match.Description
	latitude, longitude := match.LocationLatitude, match.LocationLongitude
	if command.Name != nil {
		name = *command.Name
	}
	if command.Location != nil && *command.Location != match.Location {
		location = *command.Location
		latitude = nil
		longitude = nil
	}
	if command.LocationLatitude != nil || command.LocationLongitude != nil {
		latitude = command.LocationLatitude
		longitude = command.LocationLongitude
	}
	if command.Description != nil {
		description = command.Description
	}
	if err := match.UpdateDetails(domain.UpdateMatchDetails{
		Name: name, StartTime: startTime, EndTime: endTime,
		RegistrationStartAt: match.RegistrationStartAt, RegistrationEndAt: match.RegistrationEndAt,
		Location: location, LocationLatitude: latitude, LocationLongitude: longitude,
		Description: description, OpponentName: command.OpponentName,
		HostColor: command.HostColor, AwayColor: command.AwayColor,
	}, now); err != nil {
		return domain.Match{}, err
	}
	var hostGroup *domain.RegistrationGroup
	if command.HostCapacityLimit != nil || (match.PublicationMode == domain.OnlinePickup && command.PlayersPerTeam != nil) {
		if match.PublicationMode == domain.OnlinePickup {
			for i := range groups {
				if groups[i].Kind == domain.GroupIndividualOpponent {
					hostGroup = &groups[i]
					break
				}
			}
		} else {
			hostGroup = findUserMatchHostGroup(groups)
		}
		if hostGroup == nil {
			return domain.Match{}, sharederror.New(sharederror.KindInternal, "比赛报名组不存在")
		}
		limit := hostGroup.MaxPlayers
		if command.HostCapacityLimit != nil {
			limit = command.HostCapacityLimit
		}
		if match.PublicationMode == domain.OnlinePickup {
			min := match.PlayersPerTeam * 2
			if limit == nil || *limit < min {
				return domain.Match{}, sharederror.New(sharederror.KindValidation, "人数上限不能少于成行人数")
			}
			hostGroup.MinPlayers = &min
		}
		if limit == nil {
			return domain.Match{}, sharederror.New(sharederror.KindValidation, "请填写人数上限")
		}
		if err := hostGroup.UpdateHostCapacity(*limit, now); err != nil {
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
