package legacymatches

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type Importer struct {
	target        *pgxpool.Pool
	source        Source
	hostTeamID    int64
	createdByUser int64
}

func NewImporter(target *pgxpool.Pool, source Source, hostTeamID, createdByUser int64) Importer {
	return Importer{target: target, source: source, hostTeamID: hostTeamID, createdByUser: createdByUser}
}

func (i Importer) Run(ctx context.Context, dryRun bool) (Report, error) {
	return i.RunWithOptions(ctx, RunOptions{DryRun: dryRun})
}

func validateSnapshot(snapshot Snapshot) error {
	if len(snapshot.Matches) == 0 {
		return errors.New("旧库没有可导入的比赛")
	}
	matches := make(map[string]struct{}, len(snapshot.Matches))
	for _, match := range snapshot.Matches {
		id := strings.TrimSpace(match.SourceID)
		if id == "" || strings.TrimSpace(match.Name) == "" {
			return errors.New("旧比赛 ID 或名称为空")
		}
		if _, exists := matches[id]; exists {
			return fmt.Errorf("旧比赛 ID %s 重复", id)
		}
		matches[id] = struct{}{}
	}
	users := make(map[int64]struct{}, len(snapshot.Users))
	openIDs := make(map[string]struct{}, len(snapshot.Users))
	for _, user := range snapshot.Users {
		openID := strings.TrimSpace(user.OpenID)
		if user.SourceID <= 0 || openID == "" {
			return errors.New("旧 PostgreSQL 用户 ID 或 openid 为空")
		}
		if _, exists := users[user.SourceID]; exists {
			return fmt.Errorf("旧 PostgreSQL 用户 ID %d 重复", user.SourceID)
		}
		if _, exists := openIDs[openID]; exists {
			return errors.New("旧 PostgreSQL 用户 openid 重复")
		}
		users[user.SourceID] = struct{}{}
		openIDs[openID] = struct{}{}
	}
	for _, registration := range snapshot.Registrations {
		if _, exists := matches[strings.TrimSpace(registration.ActivitySourceID)]; !exists {
			return fmt.Errorf("报名引用未导入的比赛 %s", registration.ActivitySourceID)
		}
		if _, exists := users[registration.UserSourceID]; !exists {
			return fmt.Errorf("报名引用未导入的 PostgreSQL 用户 %d", registration.UserSourceID)
		}
	}
	return nil
}

func ensurePendingTeam(ctx context.Context, tx pgx.Tx) (int64, bool, error) {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM teams WHERE name=$1 ORDER BY id LIMIT 1`, pendingTeamName).Scan(&id)
	if err == nil {
		return id, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, false, fmt.Errorf("find pending team: %w", err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO teams (name) VALUES ($1) RETURNING id`, pendingTeamName).Scan(&id); err != nil {
		return 0, false, fmt.Errorf("insert pending team: %w", err)
	}
	return id, true, nil
}

func ensureHostGroup(ctx context.Context, tx pgx.Tx, matchID uuid.UUID, teamID int64, capacityLimit *int, now time.Time) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `SELECT id FROM match_registration_groups WHERE match_id=$1 AND kind='host_team' AND status<>'cancelled'`, matchID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, fmt.Errorf("find host group: %w", err)
	}
	id = uuid.New()
	if _, err := tx.Exec(ctx, `INSERT INTO match_registration_groups (id,match_id,kind,team_id,max_players,status,created_at,updated_at) VALUES ($1,$2,'host_team',$3,$4,'open',$5,$5)`, id, matchID, teamID, capacityLimit, now); err != nil {
		return uuid.Nil, fmt.Errorf("insert host group: %w", err)
	}
	return id, nil
}

func resolveOpponent(opposing string, pendingTeamID int64) (*string, *int64) {
	trimmed := strings.TrimSpace(opposing)
	if trimmed == "" || trimmed == "待定" || trimmed == "对手待定" {
		name := pendingTeamName
		teamID := pendingTeamID
		return &name, &teamID
	}
	return &trimmed, nil
}

func normalizePlayersPerTeam(value int) int {
	if value <= 0 {
		return 8
	}
	return value
}

func mapMatchStatus(status int) domain.MatchStatus {
	switch status {
	case 1:
		return domain.MatchOngoing
	case 2:
		return domain.MatchEnded
	case 3:
		return domain.MatchCancelled
	default:
		return domain.MatchRegistering
	}
}

func mapStand(stand int) domain.RegistrationStatus {
	switch stand {
	case 1:
		return domain.RegistrationAttending
	case 2:
		return domain.RegistrationLeave
	case 3:
		return domain.RegistrationAbsent
	default:
		return domain.RegistrationUnknown
	}
}
