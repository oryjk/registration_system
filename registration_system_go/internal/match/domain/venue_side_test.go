package domain

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func venueTestSides(t *testing.T) (RegistrationGroup, RegistrationGroup) {
	t.Helper()
	teamless := NewMatchInput{
		Name: "场馆组局", PublicationMode: VenueHosted, PlayersPerTeam: 5, Location: "球场",
		CreatedByUserID: int64Ptr(1), StartTime: time.Now().Add(time.Hour), EndTime: time.Now().Add(2 * time.Hour),
	}
	_, groups, err := NewMatch(teamless, IndividualLimits{MinPlayers: 5, MaxPlayers: 5})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if len(groups) != 2 || *groups[0].Side != SideA || *groups[1].Side != SideB {
		t.Fatalf("expected sides a and b, got %+v", groups)
	}
	return groups[0], groups[1]
}

func int64Ptr(value int64) *int64 { return &value }

func TestNewVenueMatchRejectsHostTeamAndPrepaid(t *testing.T) {
	base := NewMatchInput{
		Name: "场馆组局", PublicationMode: VenueHosted, PlayersPerTeam: 5, Location: "球场",
		CreatedByUserID: int64Ptr(1), StartTime: time.Now().Add(time.Hour), EndTime: time.Now().Add(2 * time.Hour),
	}
	limits := IndividualLimits{MinPlayers: 5, MaxPlayers: 5}

	withHost := base
	withHost.HostTeamID = int64Ptr(9)
	if _, _, err := NewMatch(withHost, limits); err == nil {
		t.Fatal("venue match must not have a host team")
	}
	prepaid := base
	prepaid.PaymentMode, prepaid.FeePerPersonCents, prepaid.FeeType = PaymentPrepaid, 100, FeeFixed
	if _, _, err := NewMatch(prepaid, limits); err == nil {
		t.Fatal("venue match must not accept prepaid fees")
	}
	offlineFixed := base
	offlineFixed.FeePerPersonCents, offlineFixed.FeeType = 5000, FeeFixed
	if _, _, err := NewMatch(offlineFixed, limits); err != nil {
		t.Fatalf("postpaid fixed amount should be allowed: %v", err)
	}
}

func TestVenueMatchRejectsPrepaidOnUpdate(t *testing.T) {
	match := Match{PublicationMode: VenueHosted, PaymentMode: PaymentPostpaid}
	if err := match.UpdateFeeConfig(FeeFixed, PaymentPrepaid, 100); err == nil {
		t.Fatal("venue match must not switch to prepaid")
	}
}

func TestSelectVenueIndividualSideFillsSideAFirst(t *testing.T) {
	a, b := venueTestSides(t)
	selected, ok := SelectVenueIndividualSide([]VenueSideState{{Group: a, Attending: 2}, {Group: b}}, 1)
	if !ok || selected.ID != a.ID {
		t.Fatalf("expected side a, got %+v", selected)
	}
	selected, ok = SelectVenueIndividualSide([]VenueSideState{{Group: a, Attending: 5}, {Group: b}}, 1)
	if !ok || selected.ID != b.ID {
		t.Fatalf("expected side b once side a is full, got %+v", selected)
	}
	team := NewVenueTeamGroup(uuid.New(), SideB, 7, time.Now())
	if _, ok = SelectVenueIndividualSide([]VenueSideState{{Group: a, Attending: 5}, {Group: team}}, 1); ok {
		t.Fatal("team side must not accept individuals")
	}
}

func TestSelectVenueClaimableSideSkipsSidesWithIndividuals(t *testing.T) {
	a, b := venueTestSides(t)
	selected, ok := SelectVenueClaimableSide([]VenueSideState{{Group: a, Attending: 1}, {Group: b}})
	if !ok || selected.ID != b.ID {
		t.Fatalf("expected empty side b, got %+v", selected)
	}
	if _, ok = SelectVenueClaimableSide([]VenueSideState{{Group: a, Attending: 1}, {Group: b, Attending: 1}}); ok {
		t.Fatal("sides with individuals must not be claimable")
	}
}

func TestVenueSidesReadyRequiresBothSides(t *testing.T) {
	a, b := venueTestSides(t)
	if VenueSidesReady([]VenueSideState{{Group: a, Attending: 5}, {Group: b, Attending: 4}}, 5) {
		t.Fatal("side b is below the minimum")
	}
	team := NewVenueTeamGroup(uuid.New(), SideB, 7, time.Now())
	if VenueSidesReady([]VenueSideState{{Group: a, Attending: 5}, {Group: team, Attending: 4}}, 5) {
		t.Fatal("team side uses players per team as its minimum")
	}
	if !VenueSidesReady([]VenueSideState{{Group: a, Attending: 5}, {Group: team, Attending: 5}}, 5) {
		t.Fatal("both sides meet the minimum")
	}
}
