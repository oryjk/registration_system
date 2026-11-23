package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/ports"
)

var _ ports.LineupRepository = (*Repository)(nil)

const (
	queryFindMatchLineup = `
SELECT match_id, players_per_team, formation, slots, updated_by_user_id, created_at, updated_at
FROM match_lineups
WHERE match_id = $1
`
	queryUpsertMatchLineup = `
INSERT INTO match_lineups (
    match_id, players_per_team, formation, slots, updated_by_user_id, created_at, updated_at
) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
ON CONFLICT (match_id) DO UPDATE SET
    players_per_team = EXCLUDED.players_per_team,
    formation = EXCLUDED.formation,
    slots = EXCLUDED.slots,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = EXCLUDED.updated_at
RETURNING match_id, players_per_team, formation, slots, updated_by_user_id, created_at, updated_at
`
	queryFindLineupUsersByIDs = `
SELECT id, nickname, avatar_url
FROM users
WHERE id = ANY($1::bigint[])
ORDER BY id ASC
`
	queryFindLineupTeamNamesByIDs = `
SELECT id, name
FROM teams
WHERE id = ANY($1::bigint[])
`
)

// FindLineup 读取指定比赛已保存的排阵；尚未排阵时返回 found=false, err=nil。
func (r *Repository) FindLineup(ctx context.Context, matchID uuid.UUID) (domain.MatchLineup, bool, error) {
	row := r.database.QueryRow(ctx, queryFindMatchLineup, pgUUID(matchID))
	lineup, err := scanMatchLineupRow(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.MatchLineup{}, false, nil
	}
	if err != nil {
		return domain.MatchLineup{}, false, err
	}
	return lineup, true, nil
}

// UpsertLineup 幂等写入或更新指定比赛的排阵，并返回落库后的最新记录。
func (r *Repository) UpsertLineup(ctx context.Context, lineup domain.MatchLineup) (domain.MatchLineup, error) {
	slotsJSON, err := json.Marshal(domain.NormalizeLineupSlots(lineup.Slots))
	if err != nil {
		return domain.MatchLineup{}, fmt.Errorf("marshal lineup slots: %w", err)
	}
	row := r.database.QueryRow(
		ctx,
		queryUpsertMatchLineup,
		pgUUID(lineup.MatchID),
		int32(lineup.PlayersPerTeam),
		lineup.Formation,
		slotsJSON,
		lineup.UpdatedByUserID,
		pgTimestamptzUTC(lineup.CreatedAt.UTC()),
		pgTimestamptzUTC(lineup.UpdatedAt.UTC()),
	)
	return scanMatchLineupRow(row)
}

// FindUsersByIDs 批量查询阵型引用的球员基础资料（昵称与头像）。
func (r *Repository) FindUsersByIDs(ctx context.Context, userIDs []int64) ([]ports.LineupPlayer, error) {
	if len(userIDs) == 0 {
		return []ports.LineupPlayer{}, nil
	}
	rows, err := r.database.Query(ctx, queryFindLineupUsersByIDs, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]ports.LineupPlayer, 0, len(userIDs))
	for rows.Next() {
		var player ports.LineupPlayer
		if err := rows.Scan(&player.UserID, &player.Nickname, &player.AvatarURL); err != nil {
			return nil, err
		}
		players = append(players, player)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return players, nil
}

// FindTeamNamesByIDs 批量查询主/客队名称，供阵型公开分享页展示球队身份。
func (r *Repository) FindTeamNamesByIDs(ctx context.Context, teamIDs []int64) (map[int64]string, error) {
	result := make(map[int64]string, len(teamIDs))
	if len(teamIDs) == 0 {
		return result, nil
	}
	rows, err := r.database.Query(ctx, queryFindLineupTeamNamesByIDs, teamIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			id   int64
			name string
		)
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		result[id] = name
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func scanMatchLineupRow(row pgx.Row) (domain.MatchLineup, error) {
	var (
		matchID         pgtype.UUID
		playersPerTeam  int32
		formation       string
		slotsJSON       []byte
		updatedByUserID *int64
		createdAt       pgtype.Timestamptz
		updatedAt       pgtype.Timestamptz
	)
	if err := row.Scan(
		&matchID,
		&playersPerTeam,
		&formation,
		&slotsJSON,
		&updatedByUserID,
		&createdAt,
		&updatedAt,
	); err != nil {
		return domain.MatchLineup{}, err
	}

	var slots []domain.LineupSlot
	if len(slotsJSON) > 0 {
		if err := json.Unmarshal(slotsJSON, &slots); err != nil {
			return domain.MatchLineup{}, fmt.Errorf("unmarshal lineup slots: %w", err)
		}
	}
	return domain.MatchLineup{
		MatchID:         uuid.UUID(matchID.Bytes),
		PlayersPerTeam:  int(playersPerTeam),
		Formation:       formation,
		Slots:           domain.NormalizeLineupSlots(slots),
		UpdatedByUserID: updatedByUserID,
		CreatedAt:       createdAt.Time.UTC(),
		UpdatedAt:       updatedAt.Time.UTC(),
	}, nil
}
