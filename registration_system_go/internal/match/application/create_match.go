package application

import (
	"context"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type CreateMatch struct {
	repository    ports.Repository
	teamAccess    ports.TeamAccess
	defaultLimits ports.DefaultLimits
	clock         ports.Clock
}

type CreateMatchCommand struct {
	Name            string
	PublicationMode domain.PublicationMode
	// HostTeamID 为 nil 表示散人约球（online_pickup）这类无主队模式。
	HostTeamID          *int64
	OpponentName        *string
	PlayersPerTeam      int
	HostCapacityLimit   *int
	StartTime           time.Time
	EndTime             time.Time
	RegistrationStartAt *time.Time
	RegistrationEndAt   *time.Time
	Location            string
	LocationLatitude    *float64
	LocationLongitude   *float64
	Description         *string
	HostColor           *string
	AwayColor           *string
	// IsFree 为 nil 时默认免费；历史迁移数据显式传 false。
	IsFree *bool
	// PaymentMode 报名费支付节奏；FeePerPersonCents 人均报名费（分），0 表示免费。
	PaymentMode       domain.PaymentMode
	FeePerPersonCents int64
}

type CreateMatchResult struct {
	Match  domain.Match
	Groups []domain.RegistrationGroup
}

func NewCreateMatch(repository ports.Repository, teamAccess ports.TeamAccess, defaultLimits ports.DefaultLimits, clock ports.Clock) CreateMatch {
	return CreateMatch{repository: repository, teamAccess: teamAccess, defaultLimits: defaultLimits, clock: clock}
}

func derefPositive(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func (u CreateMatch) Execute(ctx context.Context, actor sharedauth.Actor, command CreateMatchCommand) (CreateMatchResult, error) {
	if !actor.IsUser() && !actor.IsAdmin() {
		return CreateMatchResult{}, sharederror.ErrForbidden
	}
	if command.PublicationMode == domain.OnlinePickup {
		// 散人约球没有球队概念，任何登录用户可发布；不能再挂主队。
		if command.HostTeamID != nil {
			return CreateMatchResult{}, sharederror.New(sharederror.KindValidation, "散人约球不能以球队名义发布")
		}
	} else if actor.IsUser() {
		if err := u.teamAccess.EnsureManager(ctx, derefPositive(command.HostTeamID), actor.ID); err != nil {
			return CreateMatchResult{}, err
		}
	} else if err := u.teamAccess.EnsureExists(ctx, derefPositive(command.HostTeamID)); err != nil {
		return CreateMatchResult{}, err
	}
	var limits domain.IndividualLimits
	var err error
	if command.PublicationMode == domain.OnlineIndividual {
		limits, err = u.defaultLimits.Resolve(ctx, command.PlayersPerTeam)
		if err != nil {
			return CreateMatchResult{}, err
		}
	}
	if command.PublicationMode == domain.OnlinePickup {
		// 散人约球全场都是散人：成行人数 = 每队人数 × 2，缺省上限再放宽 4 人；
		// 发布页可显式给出最大人数（HostCapacityLimit）。
		defaults, lerr := domain.ResolveIndividualLimits(command.PlayersPerTeam*2, nil)
		if lerr != nil {
			return CreateMatchResult{}, lerr
		}
		if command.HostCapacityLimit != nil {
			defaults.MaxPlayers = *command.HostCapacityLimit
		}
		if defaults.MinPlayers > defaults.MaxPlayers {
			return CreateMatchResult{}, sharederror.New(sharederror.KindValidation, "最大人数不能少于成行人数")
		}
		limits = defaults
	}
	var createdByUserID, createdByAdminID *int64
	if actor.IsUser() {
		createdByUserID = &actor.ID
	} else {
		createdByAdminID = &actor.ID
	}
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name:                command.Name,
		PublicationMode:     command.PublicationMode,
		HostTeamID:          command.HostTeamID,
		CreatedByUserID:     createdByUserID,
		CreatedByAdminID:    createdByAdminID,
		OpponentName:        command.OpponentName,
		PlayersPerTeam:      command.PlayersPerTeam,
		HostCapacityLimit:   command.HostCapacityLimit,
		StartTime:           command.StartTime,
		EndTime:             command.EndTime,
		RegistrationStartAt: command.RegistrationStartAt,
		RegistrationEndAt:   command.RegistrationEndAt,
		Location:            command.Location,
		LocationLatitude:    command.LocationLatitude,
		LocationLongitude:   command.LocationLongitude,
		Description:         command.Description,
		HostColor:           command.HostColor,
		AwayColor:           command.AwayColor,
		IsFree:              command.IsFree,
		PaymentMode:         command.PaymentMode,
		FeePerPersonCents:   command.FeePerPersonCents,
		CreatedAt:           u.clock.Now(),
	}, limits)
	if err != nil {
		return CreateMatchResult{}, err
	}
	if err := u.repository.CreateWithGroups(ctx, match, groups); err != nil {
		return CreateMatchResult{}, sharederror.Wrap(sharederror.KindInternal, "创建比赛失败", err)
	}
	return CreateMatchResult{Match: match, Groups: groups}, nil
}
