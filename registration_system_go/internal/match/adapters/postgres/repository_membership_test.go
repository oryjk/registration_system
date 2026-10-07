package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	teampostgres "github.com/oryjk/registration_system/registration_system_go/internal/team/adapters/postgres"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestParticipantMembershipIsScopedToRegistrationTeam(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	owner, team := seedMatchOwner(t, pool)
	_, otherTeam := seedMatchOwner(t, pool)
	paid, ordinary, inactive, outsider := seedMatchUser(t, pool), seedMatchUser(t, pool), seedMatchUser(t, pool), seedMatchUser(t, pool)
	top, tied := seedMatchUser(t, pool), seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status,is_paid_member)
		VALUES ($1,$2,'member','active',true), ($1,$3,'member','active',false),
		($1,$4,'member','left',true), ($5,$3,'member','active',true)`, team, paid, ordinary, inactive, otherTeam); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status,is_paid_member)
   VALUES ($1,$2,'member','active',false), ($1,$3,'member','active',false)`, team, top, tied); err != nil {
		t.Fatal(err)
	}
	match, groups := newPersistableIndividualMatch(t, owner, team, 1, 8)
	match.StartTime = time.Now().UTC().Add(30 * 24 * time.Hour)
	match.EndTime = match.StartTime.Add(2 * time.Hour)
	repo := NewRepository(pool)
	if err := repo.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatal(err)
	}
	for _, group := range groups {
		for _, user := range []int64{paid, ordinary, inactive, outsider} {
			registration, err := domain.NewRegistration(group.ID, user, domain.RegistrationAttending, 1, time.Now().UTC())
			if err != nil {
				t.Fatal(err)
			}
			if err := repo.CreateRegistration(ctx, registration); err != nil {
				t.Fatal(err)
			}
		}
	}
	// 与既有球队出勤统计一致：正式结束、时间已过均计入；取消、未来、请假和其他队记录排除。
	past := time.Now().UTC().Add(-48 * time.Hour)
	bj, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatal(err)
	}
	current := time.Now().In(bj)
	yearStart := time.Date(current.Year(), 1, 1, 0, 0, 0, 0, bj)
	yearEnd := time.Date(current.Year(), current.Month(), current.Day(), 0, 0, 0, 0, time.UTC)
	rankingStart := time.Date(current.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	for _, fixture := range []struct {
		team, user int64
		status     domain.MatchStatus
		start      time.Time
		stand      domain.RegistrationStatus
	}{
		{team, paid, domain.MatchEnded, past, domain.RegistrationAttending},
		{team, paid, domain.MatchOngoing, past, domain.RegistrationAttending},
		{team, paid, domain.MatchCancelled, past, domain.RegistrationAttending},
		{team, paid, domain.MatchOngoing, past.Add(60 * 24 * time.Hour), domain.RegistrationAttending},
		{team, paid, domain.MatchEnded, past, domain.RegistrationLeave},
		{otherTeam, paid, domain.MatchEnded, past, domain.RegistrationAttending},
		{team, ordinary, domain.MatchEnded, past, domain.RegistrationAttending},
		{team, paid, domain.MatchEnded, yearStart.UTC().Add(-time.Second), domain.RegistrationAttending},
		{team, paid, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, paid, domain.MatchEnded, time.Now().UTC().Add(48 * time.Hour), domain.RegistrationAttending},
		{team, top, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, top, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, top, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, top, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, tied, domain.MatchEnded, yearStart.UTC(), domain.RegistrationAttending},
		{team, tied, domain.MatchEnded, yearStart.UTC(), domain.RegistrationLeave},
	} {
		_, groupID := seedHomeMatch(t, pool, owner, fixture.team, "出勤统计样本", fixture.status, fixture.start)
		registration, err := domain.NewRegistration(groupID, fixture.user, fixture.stand, 1, past)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.CreateRegistration(ctx, registration); err != nil {
			t.Fatal(err)
		}
	}
	expectedCounts := map[int64]int64{paid: 1, ordinary: 0, inactive: 0, outsider: 0, top: 4, tied: 1}
	if !past.Before(yearStart.UTC()) {
		expectedCounts[paid] += 2
		expectedCounts[ordinary] = 1
	}
	teamRepo := teampostgres.NewRepository(pool)
	ranking, err := teamRepo.ListAttendanceRanking(ctx, team, &rankingStart, &yearEnd)
	if err != nil {
		t.Fatal(err)
	}
	expectedRanks := make(map[int64]int64)
	expectedScoreRanks := make(map[int64]int64)
	for index, item := range ranking {
		if item.ParticipationPoints != expectedCounts[item.UserID]*70 {
			t.Fatalf("score total mismatch %+v", item)
		}
		if item.ParticipationPoints > 0 {
			expectedScoreRanks[item.UserID] = item.ParticipationRank
		}
		if item.AttendedCount != expectedCounts[item.UserID] {
			t.Fatalf("ranking count=%+v", item)
		}
		if item.AttendedCount > 0 {
			expectedRanks[item.UserID] = int64(index + 1)
		}
	}
	if expectedRanks[top] != 1 {
		t.Fatalf("highest attendance must belong to the player not signed up: %+v", ranking)
	}
	assertParticipants := func(participants []ports.UserParticipant, teamGroup bool) {
		t.Helper()
		if len(participants) != 4 {
			t.Fatalf("participants=%+v", participants)
		}
		for _, person := range participants {
			wantRank := expectedRanks[person.UserID]
			if !teamGroup {
				wantRank = 0
			}
			if wantRank == 0 && person.TeamAttendanceRank != nil || wantRank > 0 && (person.TeamAttendanceRank == nil || *person.TeamAttendanceRank != wantRank) {
				t.Fatalf("global team rank: user=%d want=%d got=%v", person.UserID, wantRank, person.TeamAttendanceRank)
			}
			if !teamGroup && person.TeamAttendedCount != nil {
				t.Fatalf("individual group attendance=%+v", person)
			}
			if !teamGroup && (person.TeamParticipationPoints != nil || person.TeamParticipationRank != nil) {
				t.Fatal("personal group borrowed team score")
			}
			if teamGroup && (person.TeamParticipationPoints == nil || *person.TeamParticipationPoints != expectedCounts[person.UserID]*70) {
				t.Fatalf("participant score mismatch %+v", person)
			}
			if teamGroup && expectedScoreRanks[person.UserID] > 0 && (person.TeamParticipationRank == nil || *person.TeamParticipationRank != expectedScoreRanks[person.UserID]) {
				t.Fatalf("participant score rank mismatch %+v", person)
			}
			if teamGroup && (person.TeamAttendedCount == nil || *person.TeamAttendedCount != expectedCounts[person.UserID]) {
				t.Fatalf("attendance=%+v", person)
			}
			if person.IsPaidMember != (teamGroup && person.UserID == paid) {
				t.Fatalf("teamGroup=%t participant=%+v", teamGroup, person)
			}
		}
	}
	// 查看者不属于球队，也必须看到同一份标识。
	_, states, found, err := repo.FindForUser(ctx, match.ID, outsider)
	if err != nil || !found {
		t.Fatalf("found=%t err=%v", found, err)
	}
	for _, state := range states {
		assertParticipants(state.Participants, state.Group.TeamID != nil)
	}
	actions := make([]ports.HomeMatchItem, 0, len(groups))
	for _, group := range groups {
		actions = append(actions, ports.HomeMatchItem{Group: ports.UserGroupState{Group: group}})
	}
	if err := repo.attachHomeActionParticipants(ctx, actions); err != nil {
		t.Fatal(err)
	}
	for _, action := range actions {
		assertParticipants(action.Group.Participants, action.Group.Group.TeamID != nil)
	}
	// 已结束列表合并所有组，保留最早报名记录及其所在球队的身份。
	ended := []ports.MatchItem{{Match: match}}
	if err := repo.attachHomeEndedParticipants(ctx, ended); err != nil {
		t.Fatal(err)
	}
	assertParticipants(ended[0].Participants, groups[0].TeamID != nil)
	members, err := teamRepo.ListAppMembers(ctx, team)
	if err != nil {
		t.Fatal(err)
	}
	for _, member := range members {
		wantRank := expectedRanks[member.UserID]
		if wantRank == 0 && member.AttendanceRank != nil || wantRank > 0 && (member.AttendanceRank == nil || *member.AttendanceRank != wantRank) {
			t.Fatalf("roster rank: user=%d want=%d got=%v", member.UserID, wantRank, member.AttendanceRank)
		}
		if member.AttendedCount != expectedCounts[member.UserID] {
			t.Fatalf("roster count=%+v", member)
		}
	}
}
