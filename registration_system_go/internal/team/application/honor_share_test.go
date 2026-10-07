package application

import (
	"context"
	"encoding/base64"
	"errors"
	"github.com/google/uuid"
	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/team/domain"
	"testing"
	"time"
)

type honorRepository struct {
	record      domain.HonorShare
	active      bool
	year        int32
	createdUser int64
	createErr   error
}

func (r *honorRepository) CreateHonorShare(_ context.Context, team, user int64, year int32) (uuid.UUID, error) {
	if r.createErr != nil {
		return uuid.Nil, r.createErr
	}
	r.year = year
	r.createdUser = user
	return r.record.ID, nil
}
func (r *honorRepository) FindHonorShare(_ context.Context, id uuid.UUID) (domain.HonorShare, bool, error) {
	return r.record, r.active && id == r.record.ID, nil
}
func (r *honorRepository) FindActiveMember(_ context.Context, team, user int64) (domain.Member, bool, error) {
	return domain.Member{TeamID: team, UserID: user, Role: domain.RoleMember}, r.active && user == r.record.UserID, nil
}

type honorGenerator struct{ calls int }

func (g *honorGenerator) Generate(_ context.Context, code, env string) (string, error) {
	g.calls++
	return "https://assets.example/code.png", nil
}
func honorFixture() (*HonorShareService, *honorRepository, *honorGenerator, string) {
	r := &honorRepository{record: domain.HonorShare{ID: uuid.New(), TeamID: 11, UserID: 4, ScoreYear: 2026, Nickname: "Carl", ParticipationPoints: 2590}, active: true}
	g := &honorGenerator{}
	s := NewHonorShareService(r, g)
	s.now = func() time.Time { return time.Date(2026, 12, 31, 16, 0, 0, 0, time.UTC) }
	return s, r, g, base64.RawURLEncoding.EncodeToString(r.record.ID[:])
}
func TestHonorShareOwnIssueAndBeijingYear(t *testing.T) {
	s, r, _, _ := honorFixture()
	v, err := s.Issue(context.Background(), sharedauth.Actor{ID: 4, Kind: sharedauth.ActorUser}, 11)
	if err != nil || v.UserID != 4 || len(v.Code) != 22 || !v.IsMember || r.year != 2027 || r.createdUser != 4 {
		t.Fatalf("own share/year: view=%+v repository=%+v err=%v", v, r, err)
	}
}
func TestHonorShareNonMemberCannotIssue(t *testing.T) {
	s, r, _, _ := honorFixture()
	_, err := s.Issue(context.Background(), sharedauth.Actor{ID: 8, Kind: sharedauth.ActorUser}, 11)
	if !errors.Is(err, sharederror.ErrForbidden) || r.createdUser != 0 {
		t.Fatalf("nonmember issued: %v", err)
	}
}
func TestHonorShareResolveVisitorAndInvalidCodes(t *testing.T) {
	s, _, _, code := honorFixture()
	v, err := s.Resolve(context.Background(), sharedauth.Actor{ID: 8, Kind: sharedauth.ActorUser}, code)
	if err != nil || v.IsMember || v.ParticipationPoints != 2590 || v.ScoreYear != 2026 {
		t.Fatalf("visitor/year: %+v %v", v, err)
	}
	for _, bad := range []string{"", code + "=", code[:20], "../../private"} {
		if _, err := s.Resolve(context.Background(), sharedauth.Actor{ID: 8, Kind: sharedauth.ActorUser}, bad); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
}
func TestHonorShareRevokedAndCodeOwnerOnly(t *testing.T) {
	s, r, g, code := honorFixture()
	ctx := context.Background()
	if _, err := s.MiniCode(ctx, sharedauth.Actor{ID: 8, Kind: sharedauth.ActorUser}, code, "release"); !errors.Is(err, sharederror.ErrForbidden) {
		t.Fatalf("not owner: %v", err)
	}
	if _, err := s.MiniCode(ctx, sharedauth.Actor{ID: 4, Kind: sharedauth.ActorUser}, code, "unknown"); err == nil {
		t.Fatal("invalid environment accepted")
	}
	url, err := s.MiniCode(ctx, sharedauth.Actor{ID: 4, Kind: sharedauth.ActorUser}, code, "develop")
	if err != nil || url == "" || g.calls != 1 {
		t.Fatalf("own code: %s %v calls=%d", url, err, g.calls)
	}
	r.active = false
	if _, err := s.Resolve(ctx, sharedauth.Actor{ID: 4, Kind: sharedauth.ActorUser}, code); err == nil {
		t.Fatal("revoked share remained visible")
	}
}

func TestHonorShareRejectsUnavailableTeamAsForbidden(t *testing.T) {
	s, r, _, _ := honorFixture()
	r.createErr = sharederror.ErrForbidden
	_, err := s.Issue(context.Background(), sharedauth.Actor{ID: 4, Kind: sharedauth.ActorUser}, 11)
	var typed *sharederror.Error
	if !errors.As(err, &typed) || typed.Kind != sharederror.KindForbidden {
		t.Fatalf("unavailable team error kind: %v", err)
	}
}
