package domain

import (
	"strings"
	"time"
	"unicode/utf8"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Status string

const (
	StatusActive Status = "active"
	StatusFrozen Status = "frozen"
)

type User struct {
	ID          int64
	OpenID      string
	Nickname    string
	AvatarURL   *string
	RealName    *string
	PhoneNumber *string
	Status      Status
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (u User) UpdateProfile(realName, phoneNumber string) (User, error) {
	realName = strings.TrimSpace(realName)
	phoneNumber = strings.TrimSpace(phoneNumber)
	if utf8.RuneCountInString(realName) > 120 {
		return User{}, sharederror.New(sharederror.KindValidation, "真实姓名不能超过 120 个字符")
	}
	if utf8.RuneCountInString(phoneNumber) > 32 {
		return User{}, sharederror.New(sharederror.KindValidation, "手机号不能超过 32 个字符")
	}
	u.RealName = optionalString(realName)
	u.PhoneNumber = optionalString(phoneNumber)
	return u, nil
}

func optionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
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
