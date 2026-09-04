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
		{
			name:      "pickup rejects host team",
			input:     validInput(OnlinePickup),
			limits:    IndividualLimits{MinPlayers: 16, MaxPlayers: 20},
			wantError: true,
		},
		{
			name: "pickup opens single individual group without host",
			input: func() NewMatchInput {
				input := validInput(OnlinePickup)
				input.HostTeamID = nil
				return input
			}(),
			limits:            IndividualLimits{MinPlayers: 16, MaxPlayers: 20},
			wantMode:          OnlinePickup,
			wantOpponentState: OpponentRecruiting,
			wantGroups:        []GroupKind{GroupIndividualOpponent},
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

func TestNewMatchPreservesRegistrationWindow(t *testing.T) {
	input := validInput(OnlineTeam)
	registrationStart := input.CreatedAt.Add(time.Hour)
	registrationEnd := input.StartTime.Add(-time.Hour)
	input.RegistrationStartAt = &registrationStart
	input.RegistrationEndAt = &registrationEnd

	match, _, err := NewMatch(input, IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if match.RegistrationStartAt == nil || !match.RegistrationStartAt.Equal(registrationStart) {
		t.Fatalf("registration start was not preserved: %+v", match.RegistrationStartAt)
	}
	if match.RegistrationEndAt == nil || !match.RegistrationEndAt.Equal(registrationEnd) {
		t.Fatalf("registration end was not preserved: %+v", match.RegistrationEndAt)
	}
}

func TestNewMatchRejectsInvertedRegistrationWindow(t *testing.T) {
	input := validInput(OnlineTeam)
	registrationStart := input.CreatedAt.Add(2 * time.Hour)
	registrationEnd := input.CreatedAt.Add(time.Hour)
	input.RegistrationStartAt = &registrationStart
	input.RegistrationEndAt = &registrationEnd

	if _, _, err := NewMatch(input, IndividualLimits{}); err == nil {
		t.Fatal("expected inverted registration window to fail")
	}
}

func TestMatchRegistrationOpenAtHonorsConfiguredBounds(t *testing.T) {
	start := time.Date(2026, 8, 16, 9, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	tests := []struct {
		name  string
		match Match
		now   time.Time
		want  bool
	}{
		{name: "no bounds", match: Match{}, now: start.Add(-time.Hour), want: true},
		{name: "before start", match: Match{RegistrationStartAt: &start}, now: start.Add(-time.Nanosecond), want: false},
		{name: "at start", match: Match{RegistrationStartAt: &start}, now: start, want: true},
		{name: "before end", match: Match{RegistrationEndAt: &end}, now: end.Add(-time.Nanosecond), want: true},
		{name: "at end", match: Match{RegistrationEndAt: &end}, now: end, want: false},
		{name: "inside complete window", match: Match{RegistrationStartAt: &start, RegistrationEndAt: &end}, now: start.Add(time.Hour), want: true},
		{name: "after match end", match: Match{EndTime: end}, now: end, want: false},
		{name: "after match end even without window", match: Match{EndTime: end}, now: end.Add(time.Hour), want: false},
		{name: "before match end", match: Match{EndTime: end}, now: end.Add(-time.Nanosecond), want: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := test.match.RegistrationOpenAt(test.now); got != test.want {
				t.Fatalf("RegistrationOpenAt(%s) = %t, want %t", test.now, got, test.want)
			}
		})
	}
}

func validInput(mode PublicationMode) NewMatchInput {
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	return NewMatchInput{
		Name:              "周末友谊赛",
		PublicationMode:   mode,
		HostTeamID:        int64Pointer(7),
		CreatedByUserID:   int64Pointer(42),
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

func UpdateDetailsInput(m Match, fn func(*UpdateMatchDetails)) UpdateMatchDetails {
	input := UpdateMatchDetails{
		Name: m.Name, StartTime: m.StartTime, EndTime: m.EndTime,
		RegistrationStartAt: m.RegistrationStartAt, RegistrationEndAt: m.RegistrationEndAt,
		Location: m.Location, LocationLatitude: m.LocationLatitude, LocationLongitude: m.LocationLongitude,
		Description: m.Description,
	}
	fn(&input)
	return input
}

func TestNormalizeJerseyColor(t *testing.T) {
	got, err := NormalizeJerseyColor("  #2F6BFF ")
	if err != nil || got != "#2f6bff" {
		t.Fatalf("want #2f6bff, got %q err=%v", got, err)
	}
	if got, err := NormalizeJerseyColor(""); err != nil || got != "" {
		t.Fatalf("empty should pass through, got %q err=%v", got, err)
	}
	if _, err := NormalizeJerseyColor("#fff"); err == nil {
		t.Fatal("3-digit hex should be rejected")
	}
	if _, err := NormalizeJerseyColor("2f6bff"); err == nil {
		t.Fatal("missing # should be rejected")
	}
}

func TestNewMatchStoresNormalizedJerseyColors(t *testing.T) {
	host, away := "#2F6BFF", "#C8FF00"
	input := validInput(OnlineTeam)
	input.HostColor, input.AwayColor = &host, &away
	match, _, err := NewMatch(input, IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if match.HostColor != "#2f6bff" || match.AwayColor != "#c8ff00" {
		t.Fatalf("colors not normalized: %q %q", match.HostColor, match.AwayColor)
	}

	bad := "magenta"
	input2 := validInput(OnlineTeam)
	input2.HostColor = &bad
	if _, _, err := NewMatch(input2, IndividualLimits{}); err == nil {
		t.Fatal("invalid color should fail creation")
	}
}

func TestUpdateDetailsJerseyColorThreeStates(t *testing.T) {
	match, _, err := NewMatch(validInput(OnlineTeam), IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	now := time.Now().UTC()

	set := "#ff0000"
	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) { u.HostColor = &set }), now); err != nil {
		t.Fatalf("set color: %v", err)
	}
	if match.HostColor != "#ff0000" {
		t.Fatalf("want #ff0000, got %q", match.HostColor)
	}

	clear := ""
	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) { u.HostColor = &clear }), now); err != nil {
		t.Fatalf("clear color: %v", err)
	}
	if match.HostColor != "" {
		t.Fatalf("cleared color should be empty, got %q", match.HostColor)
	}

	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) {}), now); err != nil {
		t.Fatalf("nil color keeps value: %v", err)
	}
}

func TestFinishByHost(t *testing.T) {
	ended := time.Date(2026, 7, 20, 20, 0, 0, 0, time.UTC)
	afterEnd := ended.Add(time.Minute)
	tests := []struct {
		name    string
		status  MatchStatus
		next    MatchStatus
		now     time.Time
		want    MatchStatus
		wantErr bool
	}{
		{name: "registering match ends after end time", status: MatchRegistering, next: MatchEnded, now: afterEnd, want: MatchEnded},
		{name: "ongoing match ends after end time", status: MatchOngoing, next: MatchEnded, now: afterEnd, want: MatchEnded},
		{name: "registering match cancelled after end time", status: MatchRegistering, next: MatchCancelled, now: afterEnd, want: MatchCancelled},
		{name: "registering match cancelled before end time", status: MatchRegistering, next: MatchCancelled, now: ended.Add(-time.Hour), want: MatchCancelled},
		{name: "ongoing match cancelled before end time", status: MatchOngoing, next: MatchCancelled, now: ended.Add(-time.Hour), want: MatchCancelled},
		{name: "idempotent when already ended", status: MatchEnded, next: MatchEnded, now: afterEnd, want: MatchEnded},
		{name: "idempotent when already cancelled", status: MatchCancelled, next: MatchCancelled, now: afterEnd, want: MatchCancelled},
		{name: "rejects ended before end time", status: MatchOngoing, next: MatchEnded, now: ended.Add(-time.Minute), wantErr: true},
		{name: "rejects at exact end time", status: MatchOngoing, next: MatchEnded, now: ended, wantErr: true},
		{name: "rejects switching ended to cancelled", status: MatchEnded, next: MatchCancelled, now: afterEnd, wantErr: true},
		{name: "rejects cancelled switching to ended", status: MatchCancelled, next: MatchEnded, now: afterEnd, wantErr: true},
		{name: "rejects invalid target status", status: MatchOngoing, next: MatchRegistering, now: afterEnd, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			match := Match{Status: test.status, EndTime: ended}
			err := match.FinishByHost(test.next, test.now)
			if test.wantErr {
				if err == nil {
					t.Fatalf("FinishByHost(%s) expected error", test.next)
				}
				return
			}
			if err != nil {
				t.Fatalf("FinishByHost(%s): %v", test.next, err)
			}
			if match.Status != test.want {
				t.Fatalf("status = %s, want %s", match.Status, test.want)
			}
		})
	}
}

func TestNewMatchPaymentConfig(t *testing.T) {
	start := time.Date(2026, 7, 20, 18, 0, 0, 0, time.UTC)
	base := func() NewMatchInput {
		input := validInput(OnlinePickup)
		input.HostTeamID = nil
		input.CreatedAt = start.Add(-48 * time.Hour)
		return input
	}

	if _, _, err := NewMatch(base(), IndividualLimits{MinPlayers: 16, MaxPlayers: 20}); err != nil {
		t.Fatalf("postpaid default should pass: %v", err)
	}

	prepaidWithoutFee := base()
	prepaidWithoutFee.PaymentMode = PaymentPrepaid
	if _, _, err := NewMatch(prepaidWithoutFee, IndividualLimits{MinPlayers: 16, MaxPlayers: 20}); err == nil {
		t.Fatal("prepaid without fee should be rejected")
	}

	prepaidWithFee := base()
	prepaidWithFee.PaymentMode = PaymentPrepaid
	prepaidWithFee.FeePerPersonCents = 2500
	match, _, err := NewMatch(prepaidWithFee, IndividualLimits{MinPlayers: 16, MaxPlayers: 20})
	if err != nil {
		t.Fatalf("prepaid with fee: %v", err)
	}
	if match.PaymentMode != PaymentPrepaid || match.FeePerPersonCents != 2500 || match.IsFree {
		t.Fatalf("unexpected payment fields: %+v", match)
	}

	feeForcesPaid := base()
	feeForcesPaid.FeePerPersonCents = 2500
	match, _, err = NewMatch(feeForcesPaid, IndividualLimits{MinPlayers: 16, MaxPlayers: 20})
	if err != nil {
		t.Fatalf("fee without payment mode: %v", err)
	}
	if match.PaymentMode != PaymentPostpaid || match.IsFree {
		t.Fatalf("fee should force paid match: %+v", match)
	}
}
