package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	matchdomain "github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type fakeRosterRepository struct {
	match       matchdomain.Match
	groups      []matchdomain.RegistrationGroup
	attendeeRow []matchdomain.SettlementAttendee
}

func (f *fakeRosterRepository) FindByID(_ context.Context, _ uuid.UUID) (matchdomain.Match, []matchdomain.RegistrationGroup, bool, error) {
	return f.match, f.groups, true, nil
}

func (f *fakeRosterRepository) ListSettlementAttendees(_ context.Context, _ uuid.UUID) ([]matchdomain.SettlementAttendee, error) {
	return f.attendeeRow, nil
}

func TestLoadSettlementRosterMapsTeamAndPaid(t *testing.T) {
	hostGroup := uuid.New()
	individualGroup := uuid.New()
	hostTeamID := int64(11)
	guestTeamID := int64(22)
	repository := &fakeRosterRepository{
		match: matchdomain.Match{
			ID: uuid.New(), Name: "周末球局", Status: matchdomain.MatchEnded,
			PaymentMode: matchdomain.PaymentPostpaid, FeePerPersonCents: 3000,
			HostTeamID: &hostTeamID,
		},
		// 组列表故意不含客队组：TeamID 必须以出场名单行的值为准，
		// 不能依赖组列表反查（反查 miss 会把队员当散人静默跳过扣款）。
		groups: []matchdomain.RegistrationGroup{
			{ID: hostGroup, Kind: matchdomain.GroupHostTeam, TeamID: &hostTeamID},
			{ID: individualGroup, Kind: matchdomain.GroupIndividualOpponent},
		},
		attendeeRow: []matchdomain.SettlementAttendee{
			{UserID: 1, Nickname: "甲", TeamID: hostTeamID},
			{UserID: 2, Nickname: "乙", TeamID: hostTeamID, Paid: true},
			{UserID: 3, Nickname: "散人"},
			{UserID: 4, Nickname: "客队丙", TeamID: guestTeamID},
		},
	}
	service := NewSettlementRosterService(repository)

	roster, found, err := service.LoadSettlementRoster(context.Background(), uuid.New())
	if err != nil || !found {
		t.Fatalf("found=%v err=%v", found, err)
	}
	if len(roster.Attendees) != 4 {
		t.Fatalf("应带回全部出场者: %+v", roster.Attendees)
	}
	if roster.Attendees[0].TeamID != hostTeamID || roster.Attendees[0].Paid || !roster.Attendees[1].Paid {
		t.Fatalf("球队归属/预付标记应正确映射: %+v", roster.Attendees)
	}
	if roster.Attendees[2].TeamID != 0 {
		t.Fatalf("散人 TeamID 应为 0: %+v", roster.Attendees[2])
	}
	if roster.Attendees[3].TeamID != guestTeamID {
		t.Fatalf("组列表缺失时 TeamID 仍应取出行内值，避免被当散人: %+v", roster.Attendees[3])
	}
	if roster.Status != matchdomain.MatchEnded || roster.FeePerPersonCents != 3000 {
		t.Fatalf("比赛信息应透传: %+v", roster)
	}
}

func TestLoadSettlementRosterReturnsNotFound(t *testing.T) {
	repository := &fakeNotFoundRosterRepository{}
	service := NewSettlementRosterService(repository)
	if _, found, err := service.LoadSettlementRoster(context.Background(), uuid.New()); found || err != nil {
		t.Fatalf("不存在的比赛应返回 found=false，得到 found=%v err=%v", found, err)
	}
}

type fakeNotFoundRosterRepository struct{}

func (f *fakeNotFoundRosterRepository) FindByID(_ context.Context, _ uuid.UUID) (matchdomain.Match, []matchdomain.RegistrationGroup, bool, error) {
	return matchdomain.Match{}, nil, false, nil
}

func (f *fakeNotFoundRosterRepository) ListSettlementAttendees(_ context.Context, _ uuid.UUID) ([]matchdomain.SettlementAttendee, error) {
	return nil, nil
}
