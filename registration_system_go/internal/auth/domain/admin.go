package domain

import (
	"strings"
	"time"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type AdminRole string

const (
	AdminRoleAdmin AdminRole = "admin"
	AdminRoleSuper AdminRole = "super_admin"
)

type AdminStatus string

const (
	AdminStatusActive AdminStatus = "active"
	AdminStatusFrozen AdminStatus = "frozen"
)

type Admin struct {
	ID           int64
	Username     string
	PasswordHash string
	Role         AdminRole
	Status       AdminStatus
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func NewAdmin(username, passwordHash string, role AdminRole) (Admin, error) {
	username = strings.TrimSpace(username)
	if username == "" || strings.TrimSpace(passwordHash) == "" {
		return Admin{}, sharederror.New(sharederror.KindValidation, "管理员账号信息不完整")
	}
	if role != AdminRoleAdmin && role != AdminRoleSuper {
		return Admin{}, sharederror.New(sharederror.KindValidation, "管理员角色无效")
	}
	return Admin{Username: username, PasswordHash: passwordHash, Role: role, Status: AdminStatusActive}, nil
}

func (a Admin) IsActive() bool { return a.Status == AdminStatusActive }
func (a Admin) IsSuper() bool  { return a.Role == AdminRoleSuper }
