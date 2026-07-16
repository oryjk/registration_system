package domain

import (
	"strings"
	"time"
	"unicode/utf8"

	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type Role string

const (
	RoleCaptain     Role = "captain"
	RoleLeader      Role = "leader"
	RoleViceCaptain Role = "vice_captain"
	RoleMember      Role = "member"
)

func (r Role) IsValid() bool {
	return r == RoleCaptain || r == RoleLeader || r == RoleViceCaptain || r == RoleMember
}

func (r Role) CanAssignDirectly() bool {
	return r.IsValid() && r != RoleCaptain
}

type TeamStatus string

const (
	TeamActive TeamStatus = "active"
	TeamFrozen TeamStatus = "frozen"
)

func (s TeamStatus) IsValid() bool {
	return s == TeamActive || s == TeamFrozen
}

type MemberStatus string

const (
	MemberActive   MemberStatus = "active"
	MemberInactive MemberStatus = "inactive"
)

func (s MemberStatus) IsValid() bool {
	return s == MemberActive || s == MemberInactive
}

type Team struct {
	ID          int64
	Name        string
	Description *string
	LogoURL     *string
	CaptainID   *int64
	Status      TeamStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Member struct {
	ID       int64
	TeamID   int64
	UserID   int64
	Role     Role
	Status   MemberStatus
	JoinedAt time.Time
}

type MemberDetails struct {
	Member
	Nickname  string
	AvatarURL *string
}

type MemberCandidate struct {
	UserID    int64
	Nickname  string
	AvatarURL *string
}

type TeamMembership struct {
	Team   Team
	Member Member
}

func NewTeam(name string, description *string) (Team, error) {
	name, description, err := normalizeDetails(name, description)
	if err != nil {
		return Team{}, err
	}
	return Team{Name: name, Description: description, Status: TeamActive}, nil
}

func (t Team) Update(name string, description *string, status TeamStatus) (Team, error) {
	name, description, err := normalizeDetails(name, description)
	if err != nil {
		return Team{}, err
	}
	if !status.IsValid() {
		return Team{}, sharederror.New(sharederror.KindValidation, "球队状态无效")
	}
	t.Name = name
	t.Description = description
	t.Status = status
	return t, nil
}

func normalizeDetails(name string, description *string) (string, *string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", nil, sharederror.New(sharederror.KindValidation, "球队名称不能为空")
	}
	if utf8.RuneCountInString(name) > 120 {
		return "", nil, sharederror.New(sharederror.KindValidation, "球队名称不能超过 120 个字符")
	}
	if description != nil {
		value := strings.TrimSpace(*description)
		if value == "" {
			description = nil
		} else {
			description = &value
		}
	}
	return name, description, nil
}

func (m Member) CanManageMatches() bool {
	return m.Status == MemberActive && (m.Role == RoleCaptain || m.Role == RoleLeader)
}
