package domain

import (
	"github.com/google/uuid"
	"testing"
	"time"
)

func TestParticipationBonusBoundaries(t *testing.T) {
	start := time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		delay time.Duration
		want  int32
	}{
		{-time.Second, 0}, {0, 30}, {time.Hour, 30}, {time.Hour + time.Nanosecond, 24},
		{6 * time.Hour, 24}, {6*time.Hour + time.Nanosecond, 15}, {24 * time.Hour, 15}, {24*time.Hour + time.Nanosecond, 6},
	} {
		r, _ := NewRegistration(uuid.New(), 1, RegistrationAttending, 1, start)
		r.ConfirmParticipation(start.Add(tc.delay), start)
		if r.EarlyRegistrationBonus != tc.want {
			t.Fatalf("delay %s: bonus=%d want=%d", tc.delay, r.EarlyRegistrationBonus, tc.want)
		}
	}
}

func TestParticipationConfirmationLifecycle(t *testing.T) {
	start := time.Now().UTC()
	r, _ := NewRegistration(uuid.New(), 1, RegistrationAttending, 1, start)
	if r.ParticipationConfirmedAt != nil || r.EarlyRegistrationBonus != 0 {
		t.Fatal("generic/admin creation must not grant early reward")
	}
	r.ConfirmParticipation(start, start)
	if err := r.ApplyAdminStatus(RegistrationAbsent, start.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := r.ApplyAdminStatus(RegistrationAttending, start.Add(48*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if r.ParticipationConfirmedAt == nil || !r.ParticipationConfirmedAt.Equal(start) || r.EarlyRegistrationBonus != 30 {
		t.Fatal("admin correction lost original reward")
	}
	r.Cancel(start.Add(time.Minute))
	if r.ParticipationConfirmedAt != nil || r.EarlyRegistrationBonus != 0 {
		t.Fatal("user cancellation must clear reward")
	}
	if err := r.ApplyUserStatus(RegistrationAttending, 1, start.Add(8*time.Hour)); err != nil {
		t.Fatal(err)
	}
	r.ConfirmParticipation(start.Add(8*time.Hour), start)
	if r.EarlyRegistrationBonus != 15 {
		t.Fatal("re-registration must use new time")
	}
	if err := r.ApplyUserStatus(RegistrationLeave, 1, start.Add(9*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if r.ParticipationConfirmedAt != nil || r.EarlyRegistrationBonus != 0 {
		t.Fatal("user leave must clear reward")
	}
}
