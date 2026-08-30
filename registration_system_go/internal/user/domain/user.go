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
	// IsMatchAdmin 是否为比赛管理员（管理端设置）：可在小程序端录入比赛比分。
	IsMatchAdmin bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
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

func (u User) UpdateAppProfile(nickname, realName, avatarURL *string) (User, error) {
	if nickname != nil {
		value := strings.TrimSpace(*nickname)
		if utf8.RuneCountInString(value) > 120 {
			return User{}, sharederror.New(sharederror.KindValidation, "昵称不能超过 120 个字符")
		}
		u.Nickname = value
	}
	if realName != nil {
		value := strings.TrimSpace(*realName)
		if utf8.RuneCountInString(value) > 120 {
			return User{}, sharederror.New(sharederror.KindValidation, "真实姓名不能超过 120 个字符")
		}
		u.RealName = optionalString(value)
	}
	if avatarURL != nil {
		value := strings.TrimSpace(*avatarURL)
		if utf8.RuneCountInString(value) > 2048 {
			return User{}, sharederror.New(sharederror.KindValidation, "头像地址不能超过 2048 个字符")
		}
		u.AvatarURL = optionalString(value)
	}
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
