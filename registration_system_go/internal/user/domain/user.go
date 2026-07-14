package domain

import (
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Status string

const (
	StatusActive Status = "active"
	StatusFrozen Status = "frozen"
)

type User struct {
	ID        int64
	OpenID    string
	Nickname  string
	AvatarURL *string
	Status    Status
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewUser(openID string) (User, error) {
	openID = strings.TrimSpace(openID)
	if openID == "" {
		return User{}, sharederror.New(sharederror.KindValidation, "微信 openid 不能为空")
	}
	return User{OpenID: openID, Status: StatusActive}, nil
}

func (u User) IsActive() bool {
	return u.Status == StatusActive
}
