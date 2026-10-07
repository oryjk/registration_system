package domain

import "time"

// EarlyRegistrationBonus stores exact tenths of a point (30 means 3 points).
// ConfirmParticipation is called only when a user enters attending, never on
// admin correction or repeated submissions. Reward values are persisted so
// later edits to the registration window do not rewrite earned rewards.
func (r *Registration) ConfirmParticipation(now, availableAt time.Time) {
	if r.Status != RegistrationAttending {
		return
	}
	r.ParticipationConfirmedAt = &now
	delay := now.Sub(availableAt)
	switch {
	case delay < 0:
		r.EarlyRegistrationBonus = 0
	case delay <= time.Hour:
		r.EarlyRegistrationBonus = 30
	case delay <= 6*time.Hour:
		r.EarlyRegistrationBonus = 24
	case delay <= 24*time.Hour:
		r.EarlyRegistrationBonus = 15
	default:
		r.EarlyRegistrationBonus = 6
	}
}
