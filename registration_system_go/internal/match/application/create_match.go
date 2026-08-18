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
	Name                string
	PublicationMode     domain.PublicationMode
	HostTeamID          int64
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
}

type CreateMatchResult struct {
	Match  domain.Match
	Groups []domain.RegistrationGroup
}

func NewCreateMatch(repository ports.Repository, teamAccess ports.TeamAccess, defaultLimits ports.DefaultLimits, clock ports.Clock) CreateMatch {
	return CreateMatch{repository: repository, teamAccess: teamAccess, defaultLimits: defaultLimits, clock: clock}
}

func (u CreateMatch) Execute(ctx context.Context, actor sharedauth.Actor, command CreateMatchCommand) (CreateMatchResult, error) {
	if !actor.IsUser() && !actor.IsAdmin() {
		return CreateMatchResult{}, sharederror.ErrForbidden
	}
	if actor.IsUser() {
		if err := u.teamAccess.EnsureManager(ctx, command.HostTeamID, actor.ID); err != nil {
			return CreateMatchResult{}, err
		}
	} else if err := u.teamAccess.EnsureExists(ctx, command.HostTeamID); err != nil {
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
