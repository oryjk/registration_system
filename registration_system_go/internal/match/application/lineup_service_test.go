package application

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

type fakeLineupRepository struct {
	match        domain.Match
	matchFound   bool
	matchErr     error
	lineup       domain.MatchLineup
	lineupFound  bool
	lineupErr    error
	upserted     *domain.MatchLineup
	upsertErr    error
	users        map[int64]ports.LineupPlayer
	usersErr     error
	queriedIDs   []int64
	usersCallCnt int
}

func (f *fakeLineupRepository) FindMatch(context.Context, uuid.UUID) (domain.Match, bool, error) {
	return f.match, f.matchFound, f.matchErr
}

func (f *fakeLineupRepository) FindLineup(context.Context, uuid.UUID) (domain.MatchLineup, bool, error) {
	return f.lineup, f.lineupFound, f.lineupErr
}

func (f *fakeLineupRepository) UpsertLineup(_ context.Context, lineup domain.MatchLineup) (domain.MatchLineup, error) {
	if f.upsertErr != nil {
		return domain.MatchLineup{}, f.upsertErr
	}
	copied := lineup
	f.upserted = &copied
	return lineup, nil
}

func (f *fakeLineupRepository) FindUsersByIDs(_ context.Context, ids []int64) ([]ports.LineupPlayer, error) {
	f.usersCallCnt++
	f.queriedIDs = append([]int64(nil), ids...)
	if f.usersErr != nil {
		return nil, f.usersErr
	}
	result := make([]ports.LineupPlayer, 0, len(ids))
	for _, id := range ids {
		if u, ok := f.users[id]; ok {
			result = append(result, u)
		}
	}
	return result, nil
}

type fakeLineupMiniCodeGenerator struct {
	page        string
	scene       string
	environment string
	url         string
	err         error
	calls       int
}

func (f *fakeLineupMiniCodeGenerator) GenerateForPage(_ context.Context, page, scene, environment string) (string, error) {
	f.calls++
	f.page = page
	f.scene = scene
	f.environment = environment
	return f.url, f.err
}

type fixedLineupClock struct{ now time.Time }

func (c fixedLineupClock) Now() time.Time { return c.now }

func makeLineupTestMatch(mode domain.PublicationMode, playersPerTeam int, status domain.MatchStatus) domain.Match {
	id := uuid.New()
	teamID := int64(7)
	creatorID := int64(42)
	m := domain.Match{
		ID:              id,
		Name:            "周末友谊赛",
		PublicationMode: mode,
		Status:          status,
		PlayersPerTeam:  playersPerTeam,
		CreatedByUserID: &creatorID,
	}
	if mode != domain.OnlinePickup && mode != domain.VenueHosted {
		m.HostTeamID = &teamID
	}
	return m
}

func makeLineupTestSlots(n int, starter1, sub1 int64) []domain.LineupSlot {
	slots := make([]domain.LineupSlot, n)
	for i := 0; i < n; i++ {
		slots[i] = domain.LineupSlot{
			Slot: i,
			X:    0.5,
			Y:    float64(i) / float64(n),
		}
	}
	if starter1 > 0 && n > 0 {
		id := starter1
		slots[0].PlayerID = &id
	}
	if sub1 > 0 && n > 0 {
		slots[0].SubPlayerIDs = []int64{sub1}
	}
	return slots
}

func TestLineupServiceGet(t *testing.T) {
	match := makeLineupTestMatch(domain.OfflineConfirmed, 5, domain.MatchRegistering)
	avatar := "https://cdn.example.com/u10.png"
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 999}

	t.Run("match not found returns 404 kind", func(t *testing.T) {
		repo := &fakeLineupRepository{matchFound: false}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, nil, fixedLineupClock{now: time.Now()})
		_, found, err := svc.Get(context.Background(), actor, match.ID)
		if !sharederror.ErrNotFound.Is(err) || found {
			t.Fatalf("期望 NotFound，得到 found=%v err=%v", found, err)
		}
	})

	t.Run("unsaved lineup returns found=false without error", func(t *testing.T) {
		repo := &fakeLineupRepository{match: match, matchFound: true, lineupFound: false}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, nil, fixedLineupClock{now: time.Now()})
		_, found, err := svc.Get(context.Background(), actor, match.ID)
		if err != nil || found {
			t.Fatalf("期望 found=false, err=nil，得到 found=%v err=%v", found, err)
		}
	})

	t.Run("any logged-in user gets saved lineup with starter and sub players", func(t *testing.T) {
		repo := &fakeLineupRepository{
			match:       match,
			matchFound:  true,
			lineupFound: true,
			lineup: domain.MatchLineup{
				MatchID:        match.ID,
				PlayersPerTeam: 5,
				Formation:      "1-2-1",
				Slots:          makeLineupTestSlots(5, 10, 20),
			},
			users: map[int64]ports.LineupPlayer{
				10: {UserID: 10, Nickname: "门神", AvatarURL: &avatar},
				20: {UserID: 20, Nickname: "替补门将"},
			},
		}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, nil, fixedLineupClock{now: time.Now()})
		view, found, err := svc.Get(context.Background(), actor, match.ID)
		if err != nil || !found {
			t.Fatalf("Get 应成功: found=%v err=%v", found, err)
		}
		if len(view.Players) != 2 || view.Players[0].UserID != 10 || view.Players[1].UserID != 20 {
			t.Fatalf("players 返回不符: %+v", view.Players)
		}
		for i, s := range view.Lineup.Slots {
			if s.SubPlayerIDs == nil {
				t.Fatalf("slot %d sub_player_ids 不应为 nil", i)
			}
		}
	})

	t.Run("all-empty slots skips FindUsersByIDs and returns empty slice", func(t *testing.T) {
		repo := &fakeLineupRepository{
			match:       match,
			matchFound:  true,
			lineupFound: true,
			lineup: domain.MatchLineup{
				MatchID:        match.ID,
				PlayersPerTeam: 5,
				Formation:      "1-2-1",
				Slots:          makeLineupTestSlots(5, 0, 0),
			},
		}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, nil, fixedLineupClock{now: time.Now()})
		view, found, err := svc.Get(context.Background(), actor, match.ID)
		if err != nil || !found {
			t.Fatalf("Get 应成功: found=%v err=%v", found, err)
		}
		if repo.usersCallCnt != 0 || view.Players == nil || len(view.Players) != 0 {
			t.Fatalf("全占位阵型不应查用户且 players 应为空切片: calls=%d players=%#v", repo.usersCallCnt, view.Players)
		}
	})
}

func TestLineupServiceSaveAuthorizationAndRules(t *testing.T) {
	now := time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC)

	t.Run("team match allows host team manager and rejects non-manager", func(t *testing.T) {
		match := makeLineupTestMatch(domain.OnlineTeam, 5, domain.MatchRegistering)
		repo := &fakeLineupRepository{
			match:      match,
			matchFound: true,
			users: map[int64]ports.LineupPlayer{
				10: {UserID: 10, Nickname: "张三"},
				20: {UserID: 20, Nickname: "李四"},
			},
		}
		auth := fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}
		svc := NewLineupService(repo, auth, nil, fixedLineupClock{now: now})

		// 非管理员拒绝
		if _, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, match.ID, "1-2-1", makeLineupTestSlots(5, 10, 20)); !sharederror.ErrForbidden.Is(err) {
			t.Fatalf("非主队管理者应被拒绝，得到 %v", err)
		}

		// 管理员成功
		view, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID, "1-2-1", makeLineupTestSlots(5, 10, 20))
		if err != nil {
			t.Fatalf("主队管理者保存阵型应成功: %v", err)
		}
		if repo.upserted == nil || view.Lineup.Formation != "1-2-1" || view.Lineup.PlayersPerTeam != 5 {
			t.Fatalf("保存结果不符: %+v", view.Lineup)
		}
		if len(view.Players) != 2 {
			t.Fatalf("期望返回 2 位球员信息，得到 %+v", view.Players)
		}
	})

	for _, mode := range []domain.PublicationMode{domain.OnlinePickup, domain.VenueHosted} {
		t.Run(string(mode)+" allows creator only", func(t *testing.T) {
			match := makeLineupTestMatch(mode, 7, domain.MatchRegistering)
			repo := &fakeLineupRepository{match: match, matchFound: true}
			svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, nil, fixedLineupClock{now: now})

			if _, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 88}, match.ID, "2-3-1", makeLineupTestSlots(7, 0, 0)); !sharederror.ErrForbidden.Is(err) {
				t.Fatalf("%s 非创建者应被拒绝，得到 %v", mode, err)
			}
			if _, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID, "2-3-1", makeLineupTestSlots(7, 0, 0)); err != nil {
				t.Fatalf("%s 创建者保存应成功: %v", mode, err)
			}
		})
	}

	for _, status := range []domain.MatchStatus{domain.MatchEnded, domain.MatchCancelled} {
		t.Run("rejects "+string(status)+" match", func(t *testing.T) {
			match := makeLineupTestMatch(domain.OfflineConfirmed, 5, status)
			repo := &fakeLineupRepository{match: match, matchFound: true}
			svc := NewLineupService(repo, fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}, nil, fixedLineupClock{now: now})

			_, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID, "1-2-1", makeLineupTestSlots(5, 0, 0))
			if !sharederror.ErrConflict.Is(err) {
				t.Fatalf("%s 比赛应返回 Conflict，得到 %v", status, err)
			}
		})
	}

	t.Run("rejects unsupported match players_per_team", func(t *testing.T) {
		match := makeLineupTestMatch(domain.OfflineConfirmed, 3, domain.MatchRegistering)
		repo := &fakeLineupRepository{match: match, matchFound: true}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{allowed: map[int64]bool{42: true}}, nil, fixedLineupClock{now: now})

		_, err := svc.Save(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, match.ID, "1-2-1", makeLineupTestSlots(3, 0, 0))
		if !sharederror.ErrValidation.Is(err) {
			t.Fatalf("3人制应返回 Validation 错误，得到 %v", err)
		}
	})
}

func TestLineupServiceGenerateMiniCode(t *testing.T) {
	match := makeLineupTestMatch(domain.OfflineConfirmed, 5, domain.MatchRegistering)
	actor := sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}

	t.Run("generates mini code with 32-char hex scene and lineup page", func(t *testing.T) {
		repo := &fakeLineupRepository{match: match, matchFound: true}
		codes := &fakeLineupMiniCodeGenerator{url: "https://cdn.example.com/code.png"}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, codes, fixedLineupClock{now: time.Now()})

		got, err := svc.GenerateMiniCode(context.Background(), actor, match.ID, "trial")
		if err != nil {
			t.Fatalf("GenerateMiniCode 应成功: %v", err)
		}
		wantScene := hex.EncodeToString(match.ID[:])
		if got != "https://cdn.example.com/code.png" || codes.page != "pages/matches/lineup/index" || codes.scene != wantScene || len(codes.scene) != 32 || strings.Contains(codes.scene, "-") || codes.environment != "trial" {
			t.Fatalf("调用参数不符: url=%q page=%q scene=%q env=%q", got, codes.page, codes.scene, codes.environment)
		}
	})

	t.Run("rejects invalid env or missing match or generator error", func(t *testing.T) {
		repo := &fakeLineupRepository{match: match, matchFound: true}
		codes := &fakeLineupMiniCodeGenerator{err: errors.New("wechat down")}
		svc := NewLineupService(repo, fakeUserMatchAuthorizer{}, codes, fixedLineupClock{now: time.Now()})

		if _, err := svc.GenerateMiniCode(context.Background(), actor, match.ID, "invalid"); !sharederror.ErrValidation.Is(err) {
			t.Fatalf("非法 env 应返回 Validation，得到 %v", err)
		}
		if _, err := svc.GenerateMiniCode(context.Background(), actor, match.ID, "release"); !sharederror.ErrInternal.Is(err) {
			t.Fatalf("生成失败应返回 Internal，得到 %v", err)
		}

		repo.matchFound = false
		if _, err := svc.GenerateMiniCode(context.Background(), actor, match.ID, "release"); !sharederror.ErrNotFound.Is(err) {
			t.Fatalf("比赛不存在应返回 NotFound，得到 %v", err)
		}
	})
}
