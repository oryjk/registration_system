package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

func TestMatchCoverImagePersistenceAndQueries(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)
	if _, err := pool.Exec(ctx, `INSERT INTO team_members (team_id,user_id,role,status) VALUES ($1,$2,'captain','active')`, teamID, ownerID); err != nil {
		t.Fatal(err)
	}
	match, groups := newPersistableMatch(t, ownerID, teamID)
	match.CoverImageURL = "https://example.com/custom.webp"
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatal(err)
	}
	persisted, _, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found || persisted.CoverImageURL != match.CoverImageURL {
		t.Fatalf("cover not persisted: cover=%q found=%v err=%v", persisted.CoverImageURL, found, err)
	}
	admin, _, found, err := repository.FindForAdmin(ctx, match.ID)
	if err != nil || !found || admin.Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("admin detail cover=%q err=%v", admin.Match.CoverImageURL, err)
	}
	user, _, found, err := repository.FindForUser(ctx, match.ID, ownerID)
	if err != nil || !found || user.Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("app detail cover=%q err=%v", user.Match.CoverImageURL, err)
	}
	adminList, err := repository.ListForAdmin(ctx, ports.AdminMatchFilter{Limit: 20})
	if err != nil || len(adminList) != 1 || adminList[0].Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("admin list=%+v err=%v", adminList, err)
	}
	userList, err := repository.ListForUser(ctx, ports.MatchListFilter{UserID: ownerID, Scope: ports.MatchScopeAll, Limit: 20})
	if err != nil || len(userList) != 1 || userList[0].Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("app list=%+v err=%v", userList, err)
	}
	ended, err := repository.ListHomeEndedItems(ctx, ownerID, 20)
	if err != nil || len(ended) != 1 || ended[0].Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("home ended=%+v err=%v", ended, err)
	}
	// The home action query selects current matches; fixtures use a fixed historical date.
	match.StartTime = time.Now().UTC().Add(time.Hour)
	match.EndTime = match.StartTime.Add(time.Hour)
	if err := repository.UpdateDetails(ctx, match, nil); err != nil {
		t.Fatal(err)
	}
	home, err := repository.ListHomeActionItems(ctx, ownerID, 20)
	if err != nil || len(home) != 1 || home[0].Item.Match.CoverImageURL != match.CoverImageURL {
		t.Fatalf("home=%+v err=%v", home, err)
	}
	match.CoverImageURL = ""
	if err := repository.UpdateDetails(ctx, match, nil); err != nil {
		t.Fatal(err)
	}
	persisted, _, _, err = repository.FindByID(ctx, match.ID)
	if err != nil || persisted.CoverImageURL != "" {
		t.Fatalf("clear cover=%q err=%v", persisted.CoverImageURL, err)
	}
	// A legacy insert that omits the additive column still succeeds and inherits the default.
	legacyID := uuid.New()
	if _, err := pool.Exec(ctx, `INSERT INTO matches (id,name,publication_mode,opponent_state,host_team_id,players_per_team,start_time,end_time,location,created_by_user_id)
 VALUES ($1,'legacy','online_team','recruiting',$2,8,$3,$4,'legacy venue',$5)`, legacyID, teamID, match.StartTime, match.EndTime, ownerID); err != nil {
		t.Fatal(err)
	}
	legacy, found, err := repository.FindMatch(ctx, legacyID)
	if err != nil || !found || legacy.CoverImageURL != "" {
		t.Fatalf("legacy default cover=%q found=%v err=%v", legacy.CoverImageURL, found, err)
	}
}
