package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	matchsqlc "github.com/oryjk/registration_system/registration_system_go/internal/match/adapters/postgres/sqlc"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

// 详情读取：管理端与用户端的单场比赛详情（含报名组状态与参赛者）。

func (r *Repository) FindForAdmin(ctx context.Context, matchID uuid.UUID) (ports.AdminMatchItem, []domain.RegistrationGroup, bool, error) {
	row, err := r.queries.GetMatchForAdmin(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.AdminMatchItem{}, nil, false, nil
	}
	if err != nil {
		return ports.AdminMatchItem{}, nil, false, err
	}
	groupRows, err := r.queries.ListRegistrationGroupsByMatchID(ctx, pgUUID(matchID))
	if err != nil {
		return ports.AdminMatchItem{}, nil, false, err
	}
	groups := make([]domain.RegistrationGroup, 0, len(groupRows))
	for _, groupRow := range groupRows {
		groups = append(groups, mapGroup(groupRow))
	}
	return ports.AdminMatchItem{
		Match: mapAdminDetailMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
	}, groups, true, nil
}

func (r *Repository) FindForUser(ctx context.Context, matchID uuid.UUID, userID int64) (ports.MatchItem, []ports.UserGroupState, bool, error) {
	row, err := r.queries.GetMatchForAdmin(ctx, pgUUID(matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return ports.MatchItem{}, nil, false, nil
	}
	if err != nil {
		return ports.MatchItem{}, nil, false, err
	}
	groupRows, err := r.queries.ListRegistrationGroupStatesForUser(ctx, matchsqlc.ListRegistrationGroupStatesForUserParams{
		MatchID: pgUUID(matchID), UserID: userID,
	})
	if err != nil {
		return ports.MatchItem{}, nil, false, err
	}
	groups := make([]ports.UserGroupState, 0, len(groupRows))
	for _, groupRow := range groupRows {
		state := ports.UserGroupState{
			Group: domain.RegistrationGroup{
				ID: uuid.UUID(groupRow.ID.Bytes), MatchID: uuid.UUID(groupRow.MatchID.Bytes),
				Kind: domain.GroupKind(groupRow.Kind), TeamID: groupRow.TeamID,
				MinPlayers: intPointer(groupRow.MinPlayers), MaxPlayers: intPointer(groupRow.MaxPlayers),
				Status: domain.GroupStatus(groupRow.Status), CreatedAt: groupRow.CreatedAt.Time,
				UpdatedAt: groupRow.UpdatedAt.Time, CancelledAt: timestampPointer(groupRow.CancelledAt),
			},
			AttendingCount: int(groupRow.AttendingCount),
		}
		if groupRow.MyRegistrationID.Valid && groupRow.MyRegistrationStatus != nil && groupRow.MyRegistrationCount != nil {
			state.MyRegistration = &domain.Registration{
				ID: uuid.UUID(groupRow.MyRegistrationID.Bytes), GroupID: uuid.UUID(groupRow.ID.Bytes), UserID: userID,
				Status: domain.RegistrationStatus(*groupRow.MyRegistrationStatus), RegistrationCount: int(*groupRow.MyRegistrationCount),
				Paid:      groupRow.MyRegistrationPaid != nil && *groupRow.MyRegistrationPaid,
				CreatedAt: groupRow.MyRegistrationCreatedAt.Time, UpdatedAt: groupRow.MyRegistrationUpdatedAt.Time,
				CancelledAt: timestampPointer(groupRow.MyRegistrationCancelledAt),
			}
		}
		roster, err := r.listGroupRegistrationEntries(ctx, state.Group.ID)
		if err != nil {
			return ports.MatchItem{}, nil, false, err
		}
		state.Participants = mapUserParticipants(roster)
		groups = append(groups, state)
	}
	return ports.MatchItem{
		Match: mapAdminDetailMatch(row), HostTeamName: row.HostTeamName, AwayTeamName: row.AwayTeamName,
	}, groups, true, nil
}

func mapUserParticipants(entries []ports.AdminRosterEntry) []ports.UserParticipant {
	participants := make([]ports.UserParticipant, 0, len(entries))
	seen := make(map[int64]struct{}, len(entries))
	for _, entry := range entries {
		if entry.Status == nil || *entry.Status != domain.RegistrationAttending {
			continue
		}
		if _, exists := seen[entry.UserID]; exists {
			continue
		}
		seen[entry.UserID] = struct{}{}
		participants = append(participants, ports.UserParticipant{
			UserID: entry.UserID, Nickname: entry.Nickname, AvatarURL: entry.AvatarURL, Status: *entry.Status,
			RegistrationCount: entry.RegistrationCount, RegisteredAt: entry.RegisteredAt,
		})
	}
	return participants
}

func mapAdminDetailMatch(row matchsqlc.GetMatchForAdminRow) domain.Match {
	return domain.Match{
		ID: uuid.UUID(row.ID.Bytes), Name: row.Name, PublicationMode: domain.PublicationMode(row.PublicationMode),
		OpponentState: domain.OpponentState(row.OpponentState), Status: domain.MatchStatus(row.Status),
		HostTeamID: row.HostTeamID, AwayTeamID: row.AwayTeamID, OpponentName: row.OpponentName,
		PlayersPerTeam: int(row.PlayersPerTeam), StartTime: row.StartTime.Time, EndTime: row.EndTime.Time,
		RegistrationStartAt: timestampPointer(row.RegistrationStartAt), RegistrationEndAt: timestampPointer(row.RegistrationEndAt),
		Location: row.Location, LocationLatitude: row.LocationLatitude, LocationLongitude: row.LocationLongitude,
		Description: row.Description, CreatedByUserID: row.CreatedByUserID, CreatedByAdminID: row.CreatedByAdminID,
		IsFree: row.IsFree, PaymentMode: domain.PaymentMode(row.PaymentMode), FeePerPersonCents: row.FeePerPersonCents,
		HostColor: textValue(row.HostColor), AwayColor: textValue(row.AwayColor),
		CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}
