package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/ports"
)

type fakeAttendanceRepository struct {
	records      []ports.AttendanceRecord
	ranking      []ports.AttendanceRankingItem
	matchHeader  ports.MatchAttendanceHeader
	matchMembers []ports.MatchAttendanceMember
	matchFound   bool
}

func (f *fakeAttendanceRepository) ListMemberAttendanceRecords(_ context.Context, _, _ int64, _, _ *time.Time) ([]ports.AttendanceRecord, error) {
	return f.records, nil
}

func (f *fakeAttendanceRepository) ListAttendanceRanking(_ context.Context, _ int64, _, _ *time.Time) ([]ports.AttendanceRankingItem, error) {
	return f.ranking, nil
}

func (f *fakeAttendanceRepository) ListMatchAttendance(_ context.Context, _ int64, _ uuid.UUID) (ports.MatchAttendanceHeader, []ports.MatchAttendanceMember, bool, error) {
	return f.matchHeader, f.matchMembers, f.matchFound, nil
}

type fakeAttendanceAccess struct {
	managers   map[int64]bool
	memberIDs  map[int64]bool
	membersAny map[int64]bool
}

func (f fakeAttendanceAccess) EnsureManager(_ context.Context, teamID, userID int64) error {
	if f.managers[userID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func (f fakeAttendanceAccess) EnsureActiveMember(_ context.Context, teamID, userID int64) error {
	if f.memberIDs[userID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func (f fakeAttendanceAccess) EnsureMember(_ context.Context, teamID, userID int64) error {
	if f.membersAny[userID] {
		return nil
	}
	return sharederror.ErrForbidden
}

func TestAppAttendanceMemberRecordsRequiresManager(t *testing.T) {
	service := NewAppAttendanceService(&fakeAttendanceRepository{}, fakeAttendanceAccess{
		memberIDs: map[int64]bool{10: true, 99: true},
	})

	// 普通队员不能逐个查看他人出勤。
	if _, err := service.MemberRecords(context.Background(), userActor(10), 1, 99, nil, nil); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for ordinary member, got %v", err)
	}

	// 队长查看非本队成员要报成员不存在。
	leaders := NewAppAttendanceService(&fakeAttendanceRepository{}, fakeAttendanceAccess{
		managers:   map[int64]bool{10: true},
		membersAny: map[int64]bool{10: true},
	})
	if _, err := leaders.MemberRecords(context.Background(), userActor(10), 1, 99, nil, nil); err == nil {
		t.Fatal("expected missing membership error for outsider")
	}
}

func TestAppAttendanceMemberRecordsReturnsRecordsForManager(t *testing.T) {
	repository := &fakeAttendanceRepository{records: []ports.AttendanceRecord{{
		ActivityID: "m-1", ActivityName: "周四友谊赛", Stand: "attending", Registered: true,
	}}}
	service := NewAppAttendanceService(repository, fakeAttendanceAccess{
		managers:   map[int64]bool{10: true},
		membersAny: map[int64]bool{10: true, 99: true},
	})

	records, err := service.MemberRecords(context.Background(), userActor(10), 1, 99, nil, nil)
	if err != nil {
		t.Fatalf("member records: %v", err)
	}
	if len(records) != 1 || records[0].ActivityID != "m-1" || !records[0].Registered {
		t.Fatalf("unexpected records: %+v", records)
	}
}

func TestAppAttendanceSummaryAllowsOrdinaryMember(t *testing.T) {
	repository := &fakeAttendanceRepository{
		records: []ports.AttendanceRecord{{ActivityID: "m-1", Stand: "leave"}},
		ranking: []ports.AttendanceRankingItem{{UserID: 10, UserName: "队员", AttendedCount: 3}},
	}
	service := NewAppAttendanceService(repository, fakeAttendanceAccess{
		memberIDs: map[int64]bool{10: true},
	})

	summary, err := service.Summary(context.Background(), userActor(10), 1, nil, nil)
	if err != nil {
		t.Fatalf("summary for ordinary member: %v", err)
	}
	if len(summary.MyRecords) != 1 || summary.MyRecords[0].Stand != "leave" {
		t.Fatalf("unexpected my records: %+v", summary.MyRecords)
	}
	if len(summary.Ranking) != 1 || summary.Ranking[0].AttendedCount != 3 {
		t.Fatalf("unexpected ranking: %+v", summary.Ranking)
	}
}

func TestAppAttendanceSummaryRejectsOutsider(t *testing.T) {
	service := NewAppAttendanceService(&fakeAttendanceRepository{}, fakeAttendanceAccess{})

	if _, err := service.Summary(context.Background(), userActor(42), 1, nil, nil); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for outsider, got %v", err)
	}
}

func userActor(id int64) sharedauth.Actor {
	return sharedauth.Actor{Kind: sharedauth.ActorUser, ID: id}
}

func TestAppAttendanceMemberRecordsAllowsInactiveMember(t *testing.T) {
	// 离队成员（不再是 active）仍可被队长查看历史出勤。
	service := NewAppAttendanceService(&fakeAttendanceRepository{}, fakeAttendanceAccess{
		managers:   map[int64]bool{10: true},
		memberIDs:  map[int64]bool{10: true},
		membersAny: map[int64]bool{10: true, 99: true},
	})

	if _, err := service.MemberRecords(context.Background(), userActor(10), 1, 99, nil, nil); err != nil {
		t.Fatalf("expected inactive member records to be visible, got %v", err)
	}
}

func TestAppAttendanceMatchAttendanceRequiresManagerAndValidMatch(t *testing.T) {
	repository := &fakeAttendanceRepository{
		matchFound:   true,
		matchHeader:  ports.MatchAttendanceHeader{ActivityID: "m-1", ActivityName: "周四友谊赛"},
		matchMembers: []ports.MatchAttendanceMember{{UserID: 4, Nickname: "队长", Stand: "attending", Registered: true}},
	}

	memberService := NewAppAttendanceService(repository, fakeAttendanceAccess{memberIDs: map[int64]bool{10: true}})
	if _, _, err := memberService.MatchAttendance(context.Background(), userActor(10), 1, uuid.New()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("expected forbidden for ordinary member, got %v", err)
	}

	managerService := NewAppAttendanceService(repository, fakeAttendanceAccess{managers: map[int64]bool{10: true}})
	header, members, err := managerService.MatchAttendance(context.Background(), userActor(10), 1, uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	if err != nil || header.ActivityID != "m-1" || len(members) != 1 {
		t.Fatalf("unexpected match attendance: header=%+v members=%+v err=%v", header, members, err)
	}

	missing := NewAppAttendanceService(&fakeAttendanceRepository{}, fakeAttendanceAccess{managers: map[int64]bool{10: true}})
	if _, _, err := missing.MatchAttendance(context.Background(), userActor(10), 1, uuid.New()); err == nil {
		t.Fatal("expected not found for unknown match")
	}
}
