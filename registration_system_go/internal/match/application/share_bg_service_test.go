package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport/imagefixture"
)

type fakeShareBgRepository struct {
	match           domain.Match
	found           bool
	findErr         error
	updateErr       error
	updateCalls     int
	updatedMatchID  uuid.UUID
	updatedImageURL string
	updatedUnlocked bool
}

func (f *fakeShareBgRepository) FindMatch(_ context.Context, _ uuid.UUID) (domain.Match, bool, error) {
	return f.match, f.found, f.findErr
}

func (f *fakeShareBgRepository) UpdateShareBgImage(_ context.Context, matchID uuid.UUID, imageURL string, unlocked bool) error {
	f.updateCalls++
	f.updatedMatchID = matchID
	f.updatedImageURL = imageURL
	f.updatedUnlocked = unlocked
	return f.updateErr
}

type fakeShareBgAuthorizer struct {
	err error
}

func (f fakeShareBgAuthorizer) EnsureManager(context.Context, int64, int64) error {
	return f.err
}

type fakeShareBgStore struct {
	url   string
	err   error
	calls int
	key   string
	ctype string
}

func (f *fakeShareBgStore) Save(_ context.Context, key, contentType string, _ []byte) (string, error) {
	f.calls++
	f.key = key
	f.ctype = contentType
	if f.err != nil {
		return "", f.err
	}
	if f.url != "" {
		return f.url, nil
	}
	return "https://cdn.example.com/" + key, nil
}

type fakeTeamVipEntitlement struct {
	hasAccess        bool
	hasAccessErr     error
	consumeSuccess   bool
	consumeErr       error
	consumeCalls     int
	hasBackground    bool
	hasBackgroundErr error
	recordCalls      int
	recordedTeamID   int64
	recordedImageURL string
	recordedUserID   int64
	recordErr        error
	defaultURL       string
	defaultUnlocked  bool
	defaultErr       error
}

func (f *fakeTeamVipEntitlement) HasCustomShareBgAccess(context.Context, int64, bool) (bool, error) {
	return f.hasAccess, f.hasAccessErr
}

func (f *fakeTeamVipEntitlement) ConsumeCreditForCustomShareBg(context.Context, int64) (bool, error) {
	f.consumeCalls++
	return f.consumeSuccess, f.consumeErr
}

func (f *fakeTeamVipEntitlement) RecordShareBackground(_ context.Context, teamID int64, imageURL string, uploadedByUserID int64) error {
	f.recordCalls++
	f.recordedTeamID = teamID
	f.recordedImageURL = imageURL
	f.recordedUserID = uploadedByUserID
	return f.recordErr
}

func (f *fakeTeamVipEntitlement) HasTeamShareBackground(context.Context, int64, string) (bool, error) {
	return f.hasBackground, f.hasBackgroundErr
}

func (f *fakeTeamVipEntitlement) ResolveDefaultShareBgForNewMatch(context.Context, int64) (string, bool, error) {
	return f.defaultURL, f.defaultUnlocked, f.defaultErr
}

func shareBgTestMatch() domain.Match {
	teamID := int64(7)
	return domain.Match{
		ID:         uuid.New(),
		Status:     domain.MatchRegistering,
		HostTeamID: &teamID,
	}
}

func TestShareBgServiceUploadWithVipAccess(t *testing.T) {
	match := shareBgTestMatch()
	repo := &fakeShareBgRepository{match: match, found: true}
	vip := &fakeTeamVipEntitlement{hasAccess: true}
	store := &fakeShareBgStore{}
	service := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, store)

	result, err := service.Upload(context.Background(), userActor(42), match.ID, imagefixture.WebP())
	if err != nil {
		t.Fatalf("upload with vip: %v", err)
	}
	if !strings.HasPrefix(store.key, "match-share-bgs/") || !strings.HasSuffix(store.key, ".webp") {
		t.Fatalf("unexpected storage key: %q", store.key)
	}
	// match-share-bgs/ + 16 hex chars + .webp
	if parts := strings.TrimPrefix(store.key, "match-share-bgs/"); len(strings.TrimSuffix(parts, ".webp")) != 16 {
		t.Fatalf("expected 16 hex chars in key, got %q", store.key)
	}
	if store.calls != 1 || vip.consumeCalls != 0 {
		t.Fatalf("expected 1 store call and 0 credit consumes, got store=%d consume=%d", store.calls, vip.consumeCalls)
	}
	if !result.ShareBgUnlocked || result.ShareBgImageURL == "" || repo.updatedImageURL != result.ShareBgImageURL || !repo.updatedUnlocked {
		t.Fatalf("unexpected upload result/repo: result=%+v repo=%+v", result, repo)
	}
	if vip.recordCalls != 1 || vip.recordedTeamID != 7 || vip.recordedImageURL != result.ShareBgImageURL || vip.recordedUserID != 42 {
		t.Fatalf("expected background recorded to team library: %+v", vip)
	}
}

func TestShareBgServiceUploadConsumesCreditWhenNotVip(t *testing.T) {
	match := shareBgTestMatch()
	repo := &fakeShareBgRepository{match: match, found: true}
	vip := &fakeTeamVipEntitlement{hasAccess: false, consumeSuccess: true}
	store := &fakeShareBgStore{url: "https://cdn.example.com/match-share-bgs/abcd1234abcd1234.png"}
	service := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, store)

	result, err := service.Upload(context.Background(), userActor(42), match.ID, imagefixture.PNG())
	if err != nil {
		t.Fatalf("upload with credit: %v", err)
	}
	if vip.consumeCalls != 1 || store.calls != 1 || repo.updateCalls != 1 || vip.recordCalls != 1 {
		t.Fatalf("unexpected call counts: consume=%d store=%d update=%d record=%d", vip.consumeCalls, store.calls, repo.updateCalls, vip.recordCalls)
	}
	if !result.ShareBgUnlocked || !repo.updatedUnlocked {
		t.Fatalf("match should be unlocked after credit consumption: result=%+v repo=%+v", result, repo)
	}
}

func TestShareBgServiceUploadRejectsWithoutVipOrCreditAndSkipsMinIO(t *testing.T) {
	match := shareBgTestMatch()
	repo := &fakeShareBgRepository{match: match, found: true}
	vip := &fakeTeamVipEntitlement{hasAccess: false, consumeSuccess: false}
	store := &fakeShareBgStore{}
	service := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, store)

	_, err := service.Upload(context.Background(), userActor(42), match.ID, imagefixture.WebP())
	if err == nil || !errors.Is(err, sharederror.ErrForbidden) || !strings.Contains(err.Error(), "更换自定义分享背景需开通球队会员") {
		t.Fatalf("expected forbidden vip message, got %v", err)
	}
	if store.calls != 0 || repo.updateCalls != 0 || vip.recordCalls != 0 {
		t.Fatalf("must not upload or persist when lacking entitlement: store=%d update=%d record=%d", store.calls, repo.updateCalls, vip.recordCalls)
	}
}

func TestShareBgServiceUploadValidatesImageBeforeConsumingCredit(t *testing.T) {
	match := shareBgTestMatch()
	repo := &fakeShareBgRepository{match: match, found: true}
	vip := &fakeTeamVipEntitlement{hasAccess: false, consumeSuccess: true}
	store := &fakeShareBgStore{}
	service := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, store)

	for _, payload := range [][]byte{nil, []byte("<svg/>"), make([]byte, MaxShareBgUploadBytes+1)} {
		if _, err := service.Upload(context.Background(), userActor(42), match.ID, payload); err == nil {
			t.Fatalf("expected invalid payload (len=%d) to fail", len(payload))
		}
	}
	if vip.consumeCalls != 0 || store.calls != 0 {
		t.Fatalf("invalid image must not consume credit or upload: consume=%d store=%d", vip.consumeCalls, store.calls)
	}
}

func TestShareBgServiceGuardsActorMatchStatusAndRole(t *testing.T) {
	match := shareBgTestMatch()

	// 非用户态拒绝
	service := NewShareBgService(&fakeShareBgRepository{match: match, found: true}, fakeShareBgAuthorizer{}, &fakeTeamVipEntitlement{hasAccess: true}, &fakeShareBgStore{})
	if _, err := service.Upload(context.Background(), adminActor(1), match.ID, imagefixture.WebP()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("admin should be forbidden: %v", err)
	}

	// 比赛不存在
	missingSvc := NewShareBgService(&fakeShareBgRepository{found: false}, fakeShareBgAuthorizer{}, &fakeTeamVipEntitlement{hasAccess: true}, &fakeShareBgStore{})
	if _, err := missingSvc.Upload(context.Background(), userActor(42), match.ID, imagefixture.WebP()); !errors.Is(err, sharederror.ErrNotFound) {
		t.Fatalf("missing match should return not found: %v", err)
	}

	// 散人约球无主队拒绝
	pickup := match
	pickup.HostTeamID = nil
	pickupSvc := NewShareBgService(&fakeShareBgRepository{match: pickup, found: true}, fakeShareBgAuthorizer{}, &fakeTeamVipEntitlement{hasAccess: true}, &fakeShareBgStore{})
	if _, err := pickupSvc.Upload(context.Background(), userActor(42), match.ID, imagefixture.WebP()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("pickup match should be forbidden: %v", err)
	}

	// 已结束/已取消拒绝
	for _, st := range []domain.MatchStatus{domain.MatchEnded, domain.MatchCancelled} {
		closed := match
		closed.Status = st
		closedSvc := NewShareBgService(&fakeShareBgRepository{match: closed, found: true}, fakeShareBgAuthorizer{}, &fakeTeamVipEntitlement{hasAccess: true}, &fakeShareBgStore{})
		if _, err := closedSvc.Upload(context.Background(), userActor(42), match.ID, imagefixture.WebP()); !errors.Is(err, sharederror.ErrConflict) {
			t.Fatalf("status %s should return conflict: %v", st, err)
		}
	}

	// 非管理者拒绝
	nonMgrSvc := NewShareBgService(&fakeShareBgRepository{match: match, found: true}, fakeShareBgAuthorizer{err: sharederror.ErrForbidden}, &fakeTeamVipEntitlement{hasAccess: true}, &fakeShareBgStore{})
	if _, err := nonMgrSvc.Upload(context.Background(), userActor(99), match.ID, imagefixture.WebP()); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("non-manager should be forbidden: %v", err)
	}
}

func TestShareBgServiceSelectFromTeamLibrary(t *testing.T) {
	match := shareBgTestMatch()
	bgURL := "https://cdn.example.com/match-share-bgs/existing12345678.webp"

	t.Run("rejects empty or non-library image without consuming credit", func(t *testing.T) {
		repo := &fakeShareBgRepository{match: match, found: true}
		vip := &fakeTeamVipEntitlement{hasBackground: false, consumeSuccess: true}
		svc := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, &fakeShareBgStore{})

		if _, err := svc.Select(context.Background(), userActor(42), match.ID, "   "); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("empty url should fail validation: %v", err)
		}
		if _, err := svc.Select(context.Background(), userActor(42), match.ID, bgURL); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("non-library url should fail validation: %v", err)
		}
		if vip.consumeCalls != 0 || repo.updateCalls != 0 {
			t.Fatalf("must not consume credit or update on non-library image: consume=%d update=%d", vip.consumeCalls, repo.updateCalls)
		}
	})

	t.Run("consumes credit and switches background when valid", func(t *testing.T) {
		repo := &fakeShareBgRepository{match: match, found: true}
		vip := &fakeTeamVipEntitlement{hasBackground: true, hasAccess: false, consumeSuccess: true}
		svc := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, &fakeShareBgStore{})

		result, err := svc.Select(context.Background(), userActor(42), match.ID, bgURL)
		if err != nil {
			t.Fatalf("select from library: %v", err)
		}
		if result.ShareBgImageURL != bgURL || !result.ShareBgUnlocked {
			t.Fatalf("unexpected select result: %+v", result)
		}
		if vip.consumeCalls != 1 || repo.updatedImageURL != bgURL || !repo.updatedUnlocked || vip.recordCalls != 1 || vip.recordedImageURL != bgURL {
			t.Fatalf("select side effects mismatch: consume=%d repo=%+v vip=%+v", vip.consumeCalls, repo, vip)
		}
	})

	t.Run("rejects when lacking vip and credits", func(t *testing.T) {
		repo := &fakeShareBgRepository{match: match, found: true}
		vip := &fakeTeamVipEntitlement{hasBackground: true, hasAccess: false, consumeSuccess: false}
		svc := NewShareBgService(repo, fakeShareBgAuthorizer{}, vip, &fakeShareBgStore{})

		if _, err := svc.Select(context.Background(), userActor(42), match.ID, bgURL); !errors.Is(err, sharederror.ErrForbidden) {
			t.Fatalf("expected forbidden, got %v", err)
		}
		if repo.updateCalls != 0 || vip.recordCalls != 0 {
			t.Fatalf("must not update when forbidden: update=%d record=%d", repo.updateCalls, vip.recordCalls)
		}
	})
}

func TestShareBgServiceClearPreservesUnlockedFlag(t *testing.T) {
	match := shareBgTestMatch()
	match.ShareBgImageURL = "https://cdn.example.com/match-share-bgs/old.webp"
	match.ShareBgUnlocked = true
	repo := &fakeShareBgRepository{match: match, found: true}
	service := NewShareBgService(repo, fakeShareBgAuthorizer{}, &fakeTeamVipEntitlement{}, &fakeShareBgStore{})

	result, err := service.Clear(context.Background(), userActor(42), match.ID)
	if err != nil {
		t.Fatalf("clear share bg: %v", err)
	}
	if result.ShareBgImageURL != "" || !result.ShareBgUnlocked {
		t.Fatalf("clear should empty url and preserve unlocked: %+v", result)
	}
	if repo.updateCalls != 1 || repo.updatedImageURL != "" || !repo.updatedUnlocked {
		t.Fatalf("repo should receive empty url with unlocked=true: %+v", repo)
	}
}
