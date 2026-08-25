package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

// ListSettlementAttendees 供队费结算装配可扣名单（散人/已预付由上层规则过滤）。
func (r *Repository) ListSettlementAttendees(ctx context.Context, matchID uuid.UUID) ([]domain.SettlementAttendee, error) {
	rows, err := r.queries.ListSettlementAttendees(ctx, pgUUID(matchID))
	if err != nil {
		return nil, err
	}
	attendees := make([]domain.SettlementAttendee, 0, len(rows))
	for _, row := range rows {
		attendee := domain.SettlementAttendee{
			UserID:   row.UserID,
			Nickname: row.Nickname,
			Paid:     row.Paid,
		}
		if row.TeamID != nil {
			attendee.TeamID = *row.TeamID
		}
		attendees = append(attendees, attendee)
	}
	return attendees, nil
}
