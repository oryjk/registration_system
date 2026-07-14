package domain

import "time"

type Role string

const (
	RoleCaptain     Role = "captain"
	RoleLeader      Role = "leader"
	RoleViceCaptain Role = "vice_captain"
	RoleMember      Role = "member"
)

type TeamStatus string

const (
	TeamActive TeamStatus = "active"
	TeamFrozen TeamStatus = "frozen"
)

type MemberStatus string

const (
	MemberActive   MemberStatus = "active"
	MemberInactive MemberStatus = "inactive"
)

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

type TeamMembership struct {
	Team   Team
	Member Member
}

func (m Member) CanManageMatches() bool {
	return m.Status == MemberActive && (m.Role == RoleCaptain || m.Role == RoleLeader)
}
