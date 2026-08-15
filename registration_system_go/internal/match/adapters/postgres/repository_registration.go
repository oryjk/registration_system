package postgres

import (
	"context"

	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

// 报名读写：个人报名写入与报名组名册（roster）读取。

func (r *Repository) CreateRegistration(ctx context.Context, registration domain.Registration) error {
	return r.queries.CreateRegistration(ctx, createRegistrationParams(registration))
}

func (r *Repository) ListRosterForGroup(ctx context.Context, group domain.RegistrationGroup) ([]ports.AdminRosterEntry, error) {
	switch group.Kind {
	case domain.GroupHostTeam, domain.GroupGuestTeam:
		if group.TeamID == nil {
			return nil, nil
		}
		rows, err := r.queries.ListTeamGroupRoster(ctx, matchsqlc.ListTeamGroupRosterParams{
			GroupID: pgUUID(group.ID), TeamID: *group.TeamID,
		})
		if err != nil {
			return nil, err
		}
		entries := make([]ports.AdminRosterEntry, 0, len(rows))
		for _, row := range rows {
			role := row.MemberRole
			entries = append(entries, ports.AdminRosterEntry{
				UserID: row.UserID, Nickname: row.Nickname, RealName: row.RealName, AvatarURL: row.AvatarUrl,
				MemberRole: &role, Status: registrationStatusPointer(row.RegistrationStatus),
			})
		}
		return entries, nil
	case domain.GroupIndividualOpponent:
		rows, err := r.queries.ListIndividualGroupRegistrations(ctx, pgUUID(group.ID))
		if err != nil {
			return nil, err
		}
		entries := make([]ports.AdminRosterEntry, 0, len(rows))
		for _, row := range rows {
			status := domain.RegistrationStatus(row.RegistrationStatus)
			entries = append(entries, ports.AdminRosterEntry{
				UserID: row.UserID, Nickname: row.Nickname, RealName: row.RealName, AvatarURL: row.AvatarUrl,
				Status: &status,
			})
		}
		return entries, nil
	default:
		return nil, nil
	}
}

func registrationStatusPointer(value *string) *domain.RegistrationStatus {
	if value == nil {
		return nil
	}
	status := domain.RegistrationStatus(*value)
	return &status
}

func createRegistrationParams(registration domain.Registration) matchsqlc.CreateRegistrationParams {
	return matchsqlc.CreateRegistrationParams{
		ID:                pgUUID(registration.ID),
		GroupID:           pgUUID(registration.GroupID),
		UserID:            registration.UserID,
		Status:            string(registration.Status),
		RegistrationCount: int32(registration.RegistrationCount),
		CreatedAt:         pgTimestamp(registration.CreatedAt),
		UpdatedAt:         pgTimestamp(registration.UpdatedAt),
	}
}
