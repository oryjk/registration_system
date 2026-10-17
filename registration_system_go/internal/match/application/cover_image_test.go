package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

func TestCreateMatchPersistsCustomCover(t *testing.T) {
	repository := &fakeMatchRepository{}
	command := validCreateCommand(domain.OnlineTeam)
	cover := "https://example.com/cover.webp"
	command.CoverImageURL = &cover
	result, err := NewCreateMatch(repository, &fakeTeamAccess{}, &fakeDefaultLimits{}, fixedClock()).Execute(context.Background(), adminActor(3), command)
	if err != nil || result.Match.CoverImageURL != cover || repository.created.CoverImageURL != cover {
		t.Fatalf("cover not persisted: result=%+v err=%v", result.Match, err)
	}
}

func TestAdminUpdateCoverTriState(t *testing.T) {
	replacement, empty, invalid := "https://example.com/new.webp", "", "javascript:alert(1)"
	for _, tt := range []struct {
		name    string
		value   *string
		want    string
		invalid bool
	}{
		{name: "old client omission preserves", want: "https://example.com/old.webp"},
		{name: "custom", value: &replacement, want: replacement},
		{name: "default", value: &empty},
		{name: "invalid rejected", value: &invalid, invalid: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			match, groups := updatableAdminMatchFixture(uuid.New())
			match.CoverImageURL = "https://example.com/old.webp"
			repository := &fakeAdminMatchRepository{match: match, groups: groups, found: true}
			result, err := NewAdminMatchService(repository, fixedClock(), &fakeAdminAccess{}).UpdateDetails(context.Background(), adminActor(3), match.ID, UpdateMatchCommand{
				Name: match.Name, StartTime: match.StartTime, EndTime: match.EndTime, Location: match.Location, CoverImageURL: tt.value,
			})
			if tt.invalid {
				if err == nil || repository.updatedDetails.ID != uuid.Nil {
					t.Fatalf("invalid cover must not update: err=%v", err)
				}
				return
			}
			if err != nil || result.CoverImageURL != tt.want || repository.updatedDetails.CoverImageURL != tt.want {
				t.Fatalf("cover=%q persisted=%q err=%v want=%q", result.CoverImageURL, repository.updatedDetails.CoverImageURL, err, tt.want)
			}
		})
	}
}
