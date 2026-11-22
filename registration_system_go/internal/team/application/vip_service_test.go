package application

import (
	"context"
	"errors"
	"testing"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
)

func TestVipServiceGetStatusRequiresActiveMemberAndReturnsCatalog(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	vipUntil := now.Add(15 * 24 * time.Hour)
	repo := &fakeVipRepository{
		team:      domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		teamFound: true,
		member:    domain.Member{TeamID: 7, UserID: 42, Role: domain.RoleMember, Status: domain.MemberActive},
		memberOK:  true,
		status: domain.VipStatus{
			TeamID:            7,
			VipUntil:          &vipUntil,
			VipCredits:        2,
			DefaultShareBgURL: "https://cdn.example.com/bg.jpg",
		},
		statusFound: true,
	}
	service := NewVipService(repo).WithClock(func() time.Time { return now })

	view, err := service.GetStatus(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil {
		t.Fatal(err)
	}
	if !view.IsVip || view.VipCredits != 2 || view.DefaultShareBgURL != "https://cdn.example.com/bg.jpg" {
		t.Fatalf("unexpected status view: %+v", view)
	}
	if len(view.Plans) != 3 || len(view.Benefits) == 0 || view.FreeTierNote != domain.VipFreeTierNote {
		t.Fatalf("unexpected catalog/note: %+v", view)
	}

	// 非成员被拒绝。
	repo.memberOK = false
	if _, err := service.GetStatus(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 99}, 7); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("non-member error = %v, want forbidden", err)
	}

	// 球队不存在返回 not found。
	repo.teamFound = false
	if _, err := service.GetStatus(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("missing team error = %v, want not found", err)
	}
}

func TestVipServiceAccessAndCreditConsumption(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	future := now.Add(48 * time.Hour)
	expired := now.Add(-1 * time.Hour)
	repo := &fakeVipRepository{
		status:      domain.VipStatus{TeamID: 7, VipUntil: &expired, VipCredits: 1},
		statusFound: true,
		consumeOK:   true,
	}
	service := NewVipService(repo).WithClock(func() time.Time { return now })

	// 本场已解锁直接返回 true，不查库。
	ok, err := service.HasCustomShareBgAccess(context.Background(), 7, true)
	if err != nil || !ok {
		t.Fatalf("unlocked match: ok=%v err=%v", ok, err)
	}
	if repo.findVipCalls != 0 {
		t.Fatalf("expected short-circuit when matchUnlocked=true, got %d queries", repo.findVipCalls)
	}

	// 会员已过期且未解锁 -> false，需要扣次。
	ok, err = service.HasCustomShareBgAccess(context.Background(), 7, false)
	if err != nil || ok {
		t.Fatalf("expired vip: ok=%v err=%v", ok, err)
	}

	consumed, err := service.ConsumeCreditForCustomShareBg(context.Background(), 7)
	if err != nil || !consumed || repo.consumeCalls != 1 {
		t.Fatalf("consume: consumed=%v err=%v calls=%d", consumed, err, repo.consumeCalls)
	}

	// 会员有效 -> true。
	repo.status.VipUntil = &future
	ok, err = service.HasCustomShareBgAccess(context.Background(), 7, false)
	if err != nil || !ok {
		t.Fatalf("active vip: ok=%v err=%v", ok, err)
	}
}

func TestVipServiceShareBackgroundLibraryAndNewMatchDefault(t *testing.T) {
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	future := now.Add(24 * time.Hour)
	expired := now.Add(-24 * time.Hour)
	repo := &fakeVipRepository{
		team:        domain.Team{ID: 7, Name: "东安联队", Status: domain.TeamActive},
		teamFound:   true,
		memberOK:    true,
		status:      domain.VipStatus{TeamID: 7, VipUntil: &future, DefaultShareBgURL: "https://cdn.example.com/a.jpg"},
		statusFound: true,
		backgrounds: []domain.ShareBackground{
			{ID: 1, TeamID: 7, ImageURL: "https://cdn.example.com/a.jpg", CreatedAt: now},
		},
		defaultBgURL: "https://cdn.example.com/a.jpg",
		hasBg:        true,
	}
	service := NewVipService(repo).WithClock(func() time.Time { return now })

	// 写入资源库。
	uid := int64(42)
	if err := service.RecordShareBackground(context.Background(), 7, " https://cdn.example.com/b.jpg ", &uid); err != nil {
		t.Fatal(err)
	}
	if repo.recordedURL != "https://cdn.example.com/b.jpg" || repo.recordedBy == nil || *repo.recordedBy != 42 {
		t.Fatalf("recorded url=%q by=%v", repo.recordedURL, repo.recordedBy)
	}
	if err := service.RecordShareBackground(context.Background(), 7, "   ", &uid); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("blank url error = %v, want validation", err)
	}

	// 成员查询资源库。
	list, err := service.ListShareBackgrounds(context.Background(), sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, 7)
	if err != nil || len(list.Items) != 1 || list.DefaultImageURL != "https://cdn.example.com/a.jpg" {
		t.Fatalf("list = %+v, err = %v", list, err)
	}

	// 校验图片归属。
	exists, err := service.HasTeamShareBackground(context.Background(), 7, "https://cdn.example.com/a.jpg")
	if err != nil || !exists {
		t.Fatalf("exists=%v err=%v", exists, err)
	}

	// 新建比赛继承：VIP 有效且有默认图 -> 自动预填且 unlocked=true。
	url, unlocked, err := service.ResolveDefaultShareBgForNewMatch(context.Background(), 7)
	if err != nil || url != "https://cdn.example.com/a.jpg" || !unlocked {
		t.Fatalf("vip new match default: url=%q unlocked=%v err=%v", url, unlocked, err)
	}

	// VIP 过期后新建比赛不再自动沿用。
	repo.status.VipUntil = &expired
	url, unlocked, err = service.ResolveDefaultShareBgForNewMatch(context.Background(), 7)
	if err != nil || url != "" || unlocked {
		t.Fatalf("expired new match default: url=%q unlocked=%v err=%v", url, unlocked, err)
	}
}

type fakeVipRepository struct {
	team         domain.Team
	teamFound    bool
	member       domain.Member
	memberOK     bool
	status       domain.VipStatus
	statusFound  bool
	findVipCalls int
	consumeOK    bool
	consumeCalls int
	recordedURL  string
	recordedBy   *int64
	backgrounds  []domain.ShareBackground
	defaultBgURL string
	hasBg        bool
}

func (f *fakeVipRepository) FindByID(context.Context, int64) (domain.Team, bool, error) {
	return f.team, f.teamFound, nil
}

func (f *fakeVipRepository) FindActiveMember(context.Context, int64, int64) (domain.Member, bool, error) {
	return f.member, f.memberOK, nil
}

func (f *fakeVipRepository) FindVipStatus(context.Context, int64) (domain.VipStatus, bool, error) {
	f.findVipCalls++
	return f.status, f.statusFound, nil
}

func (f *fakeVipRepository) ConsumeVipCredit(context.Context, int64) (bool, error) {
	f.consumeCalls++
	return f.consumeOK, nil
}

func (f *fakeVipRepository) RecordShareBackground(_ context.Context, _ int64, imageURL string, uploadedByUserID *int64) error {
	f.recordedURL = imageURL
	f.recordedBy = uploadedByUserID
	return nil
}

func (f *fakeVipRepository) ListShareBackgrounds(context.Context, int64) ([]domain.ShareBackground, string, error) {
	return f.backgrounds, f.defaultBgURL, nil
}

func (f *fakeVipRepository) HasTeamShareBackground(context.Context, int64, string) (bool, error) {
	return f.hasBg, nil
}
