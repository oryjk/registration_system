package legacyteams

import (
	"context"
	"time"
)

type LegacyTeam struct {
	ID            string
	Name          string
	Description   *string
	LogoURL       *string
	CaptainUserID int64
	Status        int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type LegacyUser struct {
	ID          int64
	OpenID      string
	Nickname    string
	AvatarURL   *string
	RealName    string
	PhoneNumber string
	Status      int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type LegacyMembership struct {
	UserID    int64
	Role      string
	Status    int
	JoinedAt  time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Snapshot struct {
	Team        LegacyTeam
	Users       []LegacyUser
	Memberships []LegacyMembership
}

type Source interface {
	Load(context.Context) (Snapshot, error)
}

type Report struct {
	UsersInserted       int
	UsersUpdated        int
	TeamsInserted       int
	TeamsUpdated        int
	MembershipsInserted int
	MembershipsUpdated  int
}
