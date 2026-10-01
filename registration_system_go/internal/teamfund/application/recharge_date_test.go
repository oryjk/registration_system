package application

import (
	"context"
	"errors"
	"testing"
	"time"

	sharedauth "github.com/oryjk/registration_system/registration_system_go/internal/shared/auth"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestRechargeValidatesAndPassesReceiptDate(t *testing.T) {
	admin := sharedauth.Actor{Kind: sharedauth.ActorAdmin, ID: 1}
	for _, test := range []struct {
		date  string
		valid bool
	}{
		{"", true},
		{"2025-01-03", true},
		{"2025-02-30", false},
		{"2025-1-3", false},
		{time.Now().AddDate(0, 0, 2).Format("2006-01-02"), false},
	} {
		t.Run(test.date, func(t *testing.T) {
			repository := &fakeManualFundRepository{}
			service := NewManualFundService(repository, nil, &fakeNotifications{})
			_, err := service.Recharge(context.Background(), admin, ManualFundRequest{
				TeamID: 1, UserID: 2, AmountCents: 100, ReceivedOn: test.date,
			})
			if !test.valid {
				if !errors.Is(err, sharederror.ErrValidation) || len(repository.recharges) != 0 {
					t.Fatalf("invalid date must not reach repository: error=%v actions=%+v", err, repository.recharges)
				}
				return
			}
			if err != nil || len(repository.recharges) != 1 {
				t.Fatalf("valid recharge failed: %v", err)
			}
			got := repository.recharges[0].ReceivedOn
			if test.date == "" {
				if got != nil {
					t.Fatal("old request should keep the default receipt time")
				}
			} else if got == nil || got.Format("2006-01-02") != test.date {
				t.Fatalf("receipt date was not forwarded: %v", got)
			}
		})
	}
}
