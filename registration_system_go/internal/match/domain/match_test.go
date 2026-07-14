package domain

import (
	"testing"
	"time"
)

func TestNewMatchPublicationModes(t *testing.T) {
	tests := []struct {
		name              string
		input             NewMatchInput
		limits            IndividualLimits
		wantMode          PublicationMode
		wantOpponentState OpponentState
		wantGroups        []GroupKind
		wantError         bool
	}{
		{
			name:      "offline requires opponent",
			input:     validInput(OfflineConfirmed),
			wantError: true,
		},
		{
			name:              "offline opens host registration",
			input:             withOpponent(validInput(OfflineConfirmed), "周末联队"),
			wantMode:          OfflineConfirmed,
			wantOpponentState: OpponentNoRecruitment,
			wantGroups:        []GroupKind{GroupHostTeam},
		},
		{
			name:              "team online recruits while host registers",
			input:             validInput(OnlineTeam),
			wantMode:          OnlineTeam,
			wantOpponentState: OpponentRecruiting,
			wantGroups:        []GroupKind{GroupHostTeam},
		},
		{
			name:              "individual opens host and opponent groups",
			input:             validInput(OnlineIndividual),
			limits:            IndividualLimits{MinPlayers: 8, MaxPlayers: 10},
			wantMode:          OnlineIndividual,
			wantOpponentState: OpponentRecruiting,
			wantGroups:        []GroupKind{GroupHostTeam, GroupIndividualOpponent},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			match, groups, err := NewMatch(test.input, test.limits)
			if test.wantError {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("new match: %v", err)
			}
			if match.PublicationMode != test.wantMode || match.OpponentState != test.wantOpponentState {
				t.Fatalf("unexpected match mode/state: %+v", match)
			}
			if len(groups) != len(test.wantGroups) {
				t.Fatalf("expected %d groups, got %d", len(test.wantGroups), len(groups))
			}
			for index, kind := range test.wantGroups {
				if groups[index].Kind != kind || groups[index].Status != GroupOpen {
					t.Fatalf("unexpected group %d: %+v", index, groups[index])
				}
			}
		})
	}
}

func TestResolveIndividualLimitsUsesSingleSideFormula(t *testing.T) {
	limits, err := ResolveIndividualLimits(8, nil)
	if err != nil {
		t.Fatalf("resolve limits: %v", err)
	}
	if limits.MinPlayers != 8 || limits.MaxPlayers != 10 {
		t.Fatalf("expected 8/10, got %d/%d", limits.MinPlayers, limits.MaxPlayers)
	}
}

func TestNewMatchRejectsOnlineOpponentName(t *testing.T) {
	input := withOpponent(validInput(OnlineTeam), "不应出现")
	if _, _, err := NewMatch(input, IndividualLimits{}); err == nil {
		t.Fatal("expected online match opponent name to fail")
	}
}

func TestNewMatchRejectsPartialCoordinates(t *testing.T) {
	input := validInput(OnlineTeam)
	latitude := 28.2
	input.LocationLatitude = &latitude
	if _, _, err := NewMatch(input, IndividualLimits{}); err == nil {
		t.Fatal("expected partial coordinates to fail")
	}
}

func validInput(mode PublicationMode) NewMatchInput {
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	return NewMatchInput{
		Name:              "周末友谊赛",
		PublicationMode:   mode,
		HostTeamID:        7,
		CreatedByUserID:   42,
		PlayersPerTeam:    8,
		HostCapacityLimit: intPointer(12),
		StartTime:         start,
		EndTime:           start.Add(2 * time.Hour),
		Location:          "东安球场",
		CreatedAt:         start.Add(-48 * time.Hour),
	}
}

func withOpponent(input NewMatchInput, opponent string) NewMatchInput {
	input.OpponentName = &opponent
	return input
}

func intPointer(value int) *int {
	return &value
}
