package domain

import "time"

// ConfirmParticipation freezes the user's first response, including leave/absent.
// Later status changes and cancellation affect attendance eligibility only.
// The existing persisted field name is retained for database compatibility.
func (r *Registration) ConfirmParticipation(now, availableAt time.Time) {
	if r.ParticipationConfirmedAt != nil {
		return
	}
	switch r.Status {
	case RegistrationAttending, RegistrationLeave, RegistrationAbsent:
	default:
		return
	}
	r.ParticipationConfirmedAt = &now
	r.EarlyRegistrationBonus = ParticipationBonus(now, availableAt)
}

// ParticipationBonus returns exact tenths of a point (30 means 3 points).
func ParticipationBonus(responseAt, availableAt time.Time) int32 {
	delay := responseAt.Sub(availableAt)
	switch {
	case delay < 0:
		return 0
	case delay <= time.Hour:
		return 30
	case delay <= 6*time.Hour:
		return 24
	case delay <= 24*time.Hour:
		return 15
	default:
		return 6
	}
}
