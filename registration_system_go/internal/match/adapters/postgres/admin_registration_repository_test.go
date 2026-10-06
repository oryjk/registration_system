package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	matchapplication "github.com/oryjk/registration_system/registration_system_go/internal/match/application"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestAdminRegistrationRepositoryPersistsInactiveMemberAttendance(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	memberID := seedMatchUser(t, pool)
	outsiderID := seedMatchUser(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'inactive')`, teamID, memberID); err != nil {
		t.Fatal(err)
	}
	match, groups := newPersistableMatch(t, ownerID, teamID)
	match.Status = domain.MatchEnded
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatal(err)
	}
	now := match.EndTime.Add(time.Hour)
	service := matchapplication.NewAdminRegistrationService(repository, repositoryTestClock{now: now})
	actor := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	created, err := service.Put(ctx, actor, match.ID, groups[0].ID, memberID, domain.RegistrationAttending)
	if err != nil || created.RegistrationCount != 1 {
		t.Fatalf("create attendance: %+v err=%v", created, err)
	}
	// 模拟既有收费记录，修改出勤时不得覆盖收费字段。
	if _, err := pool.Exec(ctx, `UPDATE match_registrations SET paid = true WHERE id = $1`, created.ID); err != nil {
		t.Fatal(err)
	}
	updated, err := service.Put(ctx, actor, match.ID, groups[0].ID, memberID, domain.RegistrationLeave)
	if err != nil || updated.ID != created.ID || !updated.Paid || !updated.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("update attendance: %+v err=%v", updated, err)
	}
	repeated, err := service.Put(ctx, actor, match.ID, groups[0].ID, memberID, domain.RegistrationLeave)
	if err != nil || repeated.ID != updated.ID {
		t.Fatalf("repeat update: %+v err=%v", repeated, err)
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM match_registrations WHERE group_id = $1 AND user_id = $2`, groups[0].ID, memberID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("record count=%d err=%v", count, err)
	}

	var savedPaid bool
	var savedStatus string
	if err := pool.QueryRow(ctx, `SELECT paid, status FROM match_registrations WHERE id = $1`, created.ID).Scan(&savedPaid, &savedStatus); err != nil || !savedPaid || savedStatus != string(domain.RegistrationLeave) {
		t.Fatalf("saved paid=%v status=%s err=%v", savedPaid, savedStatus, err)
	}
	roster, err := repository.ListRosterForGroup(ctx, groups[0])
	if err != nil || len(roster) != 1 || roster[0].Status == nil || *roster[0].Status != domain.RegistrationLeave {
		t.Fatalf("saved roster=%+v err=%v", roster, err)
	}
	if _, err := service.Put(ctx, actor, match.ID, groups[0].ID, outsiderID, domain.RegistrationAttending); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("outsider should be rejected: %v", err)
	}

	// legacy 数据可能同时含多个组的记录；当前组较早也必须查出其他组冲突。
	otherGroupID := uuid.New()
	if _, err := pool.Exec(ctx, `INSERT INTO match_registration_groups (id, match_id, kind, min_players, max_players, status) VALUES ($1, $2, 'individual_opponent', 1, 8, 'open')`, otherGroupID, match.ID); err != nil {
		t.Fatal(err)
	}
	other, err := domain.NewRegistration(otherGroupID, memberID, domain.RegistrationAttending, 1, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.CreateRegistration(ctx, other); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Put(ctx, actor, match.ID, groups[0].ID, memberID, domain.RegistrationAbsent); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("current group must not hide another active registration: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE match_registration_groups SET status = 'cancelled', cancelled_at = $2 WHERE id = $1`, otherGroupID, now); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Put(ctx, actor, match.ID, groups[0].ID, memberID, domain.RegistrationAbsent); err != nil {
		t.Fatalf("cancelled group should not block edits: %v", err)
	}
}
