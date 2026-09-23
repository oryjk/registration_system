package domain

import (
	"testing"
)

func TestExplicitFeeType(t *testing.T) {
	for _, tc := range []struct {
		kind          FeeType
		mode          PaymentMode
		cents         int64
		free, invalid bool
	}{
		{FeeOfflineAA, PaymentPostpaid, 0, false, false},
		{FeeFree, PaymentPostpaid, 0, true, false},
		{FeeFixed, PaymentPrepaid, 2500, false, false},
		{FeeFixed, PaymentPostpaid, 2500, false, false},
		{FeeFixed, PaymentPostpaid, 0, false, true},
		{FeeOfflineAA, PaymentPrepaid, 2500, false, true},
		{FeeFree, PaymentPostpaid, 2500, false, true},
		{"invalid", PaymentPostpaid, 0, false, true},
		{"", PaymentPostpaid, 0, true, false},
	} {
		t.Run(string(tc.kind)+string(tc.mode), func(t *testing.T) {
			input := validInput(OnlinePickup)
			input.HostTeamID = nil
			input.FeeType, input.PaymentMode, input.FeePerPersonCents = tc.kind, tc.mode, tc.cents
			match, _, err := NewMatch(input, IndividualLimits{MinPlayers: 16, MaxPlayers: 20})
			if tc.invalid {
				if err == nil {
					t.Fatal("expected validation error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if match.FeeType != tc.kind || match.IsFree != tc.free {
				t.Fatalf("fee config: %s free=%v", match.FeeType, match.IsFree)
			}
		})
	}
}

func TestTeamFundRequiresTeamAndDoesNotCharge(t *testing.T) {
	input := validInput(OnlineTeam)
	input.FeeType = FeeTeamFund
	match, _, err := NewMatch(input, IndividualLimits{})
	if err != nil {
		t.Fatal(err)
	}
	if match.IsFree || match.FeeType != FeeTeamFund || match.FeePerPersonCents != 0 {
		t.Fatal("incorrect team fund config")
	}
	input.PublicationMode = OnlinePickup
	input.HostTeamID = nil
	if _, _, err := NewMatch(input, IndividualLimits{MinPlayers: 16, MaxPlayers: 20}); err == nil {
		t.Fatal("pickup cannot use team fund")
	}
}
