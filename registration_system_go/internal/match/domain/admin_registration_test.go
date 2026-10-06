package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
)

func TestAdminRegistrationStatusPreservesMetadataAndReactivates(t *testing.T) {
	now := time.Now().UTC()
	registration, _ := NewRegistration(uuid.New(), 42, RegistrationAttending, 2, now)
	registration.Paid = true
	registration.Cancel(now.Add(time.Minute))
	if err := registration.ApplyAdminStatus(RegistrationUnknown, now.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if registration.Status != RegistrationUnknown || registration.CancelledAt != nil || registration.RegistrationCount != 2 || !registration.Paid || registration.CreatedAt != now {
		t.Fatalf("incorrect transition: %+v", registration)
	}
	updated := registration.UpdatedAt
	if err := registration.ApplyAdminStatus(RegistrationUnknown, now.Add(3*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if registration.UpdatedAt != updated {
		t.Fatal("same status should be idempotent")
	}
	for _, status := range []RegistrationStatus{RegistrationCancelled, "unregistered", "invalid"} {
		if err := registration.ApplyAdminStatus(status, now); !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("invalid status %q accepted: %v", status, err)
		}
	}
}
