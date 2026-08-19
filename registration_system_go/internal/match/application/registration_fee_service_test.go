package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestRegistrationFeeMultipliesByRegistrationCount(t *testing.T) {
	now := time.Now()
	matchID := uuid.New()
	repository := &fakeUserMatchRepository{
		item: ports.MatchItem{Match: domain.Match{
			ID: matchID, PublicationMode: domain.OnlinePickup, Status: domain.MatchRegistering,
			PaymentMode: domain.PaymentPrepaid, FeePerPersonCents: 2500,
		}},
		groups: []ports.UserGroupState{{
			Group:          domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: 2, MaxPlayers: 10}, now),
			MyRegistration: &domain.Registration{Status: domain.RegistrationAttending, RegistrationCount: 3},
		}},
		found: true,
	}
	service := NewRegistrationFeeService(repository)

	fee, err := service.RegistrationFee(context.Background(), matchID, 42)
	if err != nil {
		t.Fatalf("registration fee: %v", err)
	}
	if fee.AmountCents != 7500 {
		t.Fatalf("expected 3 x 2500 cents, got %d", fee.AmountCents)
	}
}

func TestRegistrationFeeStaysPerPersonForSingleRegistration(t *testing.T) {
	now := time.Now()
	matchID := uuid.New()
	repository := &fakeUserMatchRepository{
		item: ports.MatchItem{Match: domain.Match{
			ID: matchID, PublicationMode: domain.OnlinePickup, Status: domain.MatchRegistering,
			PaymentMode: domain.PaymentPrepaid, FeePerPersonCents: 2000,
		}},
		groups: []ports.UserGroupState{{
			Group:          domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: 2, MaxPlayers: 10}, now),
			MyRegistration: &domain.Registration{Status: domain.RegistrationAttending, RegistrationCount: 1},
		}},
		found: true,
	}
	service := NewRegistrationFeeService(repository)

	fee, err := service.RegistrationFee(context.Background(), matchID, 42)
	if err != nil {
		t.Fatalf("registration fee: %v", err)
	}
	if fee.AmountCents != 2000 {
		t.Fatalf("expected per-person fee, got %d", fee.AmountCents)
	}
}

func TestRegistrationFeeRejectsPaidOrMissingRegistration(t *testing.T) {
	now := time.Now()
	matchID := uuid.New()
	base := func(registration *domain.Registration) *fakeUserMatchRepository {
		return &fakeUserMatchRepository{
			item: ports.MatchItem{Match: domain.Match{
				ID: matchID, PublicationMode: domain.OnlinePickup, Status: domain.MatchRegistering,
				PaymentMode: domain.PaymentPrepaid, FeePerPersonCents: 2500,
			}},
			groups: []ports.UserGroupState{{
				Group:          domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: 2, MaxPlayers: 10}, now),
				MyRegistration: registration,
			}},
			found: true,
		}
	}
	paid := &domain.Registration{Status: domain.RegistrationAttending, RegistrationCount: 2, Paid: true}
	if _, err := NewRegistrationFeeService(base(paid)).RegistrationFee(context.Background(), matchID, 42); err == nil {
		t.Fatal("paid registration must not create another order")
	}
	if _, err := NewRegistrationFeeService(base(nil)).RegistrationFee(context.Background(), matchID, 42); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("missing registration must fail with validation error, got %v", err)
	}
}
