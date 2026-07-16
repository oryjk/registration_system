package application

import (
	"context"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/user/ports"
)

type ProfileService struct {
	repository ports.Repository
}

func NewProfileService(repository ports.Repository) ProfileService {
	return ProfileService{repository: repository}
}

func (s ProfileService) Update(ctx context.Context, actor sharedauth.Actor, userID int64, realName, phoneNumber string) (domain.User, error) {
	if !actor.IsAdmin() {
		return domain.User{}, sharederror.ErrForbidden
	}
	user, found, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		return domain.User{}, sharederror.Wrap(sharederror.KindInternal, "查询球员失败", err)
	}
	if !found {
		return domain.User{}, sharederror.New(sharederror.KindNotFound, "球员不存在")
	}
	user, err = user.UpdateProfile(realName, phoneNumber)
	if err != nil {
		return domain.User{}, err
	}
	updated, err := s.repository.UpdateProfile(ctx, user)
	if err != nil {
		return domain.User{}, sharederror.Wrap(sharederror.KindInternal, "更新球员资料失败", err)
	}
	return updated, nil
}
