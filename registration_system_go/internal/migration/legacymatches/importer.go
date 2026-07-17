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

// Importer 把旧库历史比赛与报名写入目标库。
// 所有写入位于单个事务内：dry-run 或任一步失败都会整体回滚。
type Importer struct {
	target        *pgxpool.Pool
	source        Source
	hostTeamID    int64
	createdByUser int64
}

// NewImporter 构造导入器。
// hostTeamID 是目标库主队 ID（洺悦御府=11）；
// createdByUser 是目标库用作历史比赛 created_by_user_id 的用户（主队队长 user 37）。
func NewImporter(target *pgxpool.Pool, source Source, hostTeamID, createdByUser int64) Importer {
	return Importer{target: target, source: source, hostTeamID: hostTeamID, createdByUser: createdByUser}
}

func (i Importer) Run(ctx context.Context, dryRun bool) (Report, error) {
	snapshot, err := i.source.Load(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("load legacy match snapshot: %w", err)
	}
	if err := validateSnapshot(snapshot); err != nil {
		return Report{}, err
	}

	tx, err := i.target.Begin(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("begin target transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	report := Report{}

	openIDToUserID, unmapped, err := loadTargetUsers(ctx, tx, snapshot.Registrations)
	if err != nil {
		return Report{}, err
	}
	report.UnmappedOpenIDs = unmapped
	if unmapped > 0 {
		return report, fmt.Errorf("发现 %d 条报名引用的目标用户不存在，已中止导入", unmapped)
	}

	pendingTeamID, created, err := ensurePendingTeam(ctx, tx)
	if err != nil {
		return Report{}, err
	}
	report.PendingTeamCreated = created

	// 旧 activity.id → 目标 host_team 报名组 id，供报名行关联。
	hostGroupByActivity := make(map[string]uuid.UUID, len(snapshot.Matches))
	for _, match := range snapshot.Matches {
		inserted, groupID, err := i.importMatch(ctx, tx, match, pendingTeamID)
		if err != nil {
			return Report{}, err
		}
		hostGroupByActivity[match.SourceID] = groupID
		if inserted {
			report.MatchesInserted++
		} else {
			report.MatchesUpdated++
		}
	}

	for _, registration := range snapshot.Registrations {
		groupID, ok := hostGroupByActivity[registration.ActivitySourceID]
		if !ok {
			return Report{}, fmt.Errorf("报名引用未导入的比赛 %s", registration.ActivitySourceID)
		}
		userID, ok := openIDToUserID[registration.OpenID]
		if !ok {
			return Report{}, fmt.Errorf("报名引用未映射的用户 openid")
		}
		inserted, err := i.importRegistration(ctx, tx, groupID, userID, registration)
		if err != nil {
			return Report{}, err
		}
		if inserted {
			report.RegistrationsInserted++
		} else {
			report.RegistrationsUpdated++
		}
	}

	if dryRun {
		if err := tx.Rollback(ctx); err != nil {
			return Report{}, fmt.Errorf("rollback dry run: %w", err)
		}
		return report, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return Report{}, fmt.Errorf("commit import: %w", err)
	}
	return report, nil
}

func validateSnapshot(snapshot Snapshot) error {
	if len(snapshot.Matches) == 0 {
		return errors.New("旧库没有可导入的比赛")
	}
	seen := make(map[string]struct{}, len(snapshot.Matches))
	for _, match := range snapshot.Matches {
		id := strings.TrimSpace(match.SourceID)
		name := strings.TrimSpace(match.Name)
		if id == "" || name == "" {
			return errors.New("旧比赛 ID 或名称为空")
		}
		if _, exists := seen[id]; exists {
			return fmt.Errorf("旧比赛 ID %s 重复", id)
		}
		seen[id] = struct{}{}
	}
	return nil
}

func (i Importer) importMatch(ctx context.Context, tx pgx.Tx, match LegacyMatch, pendingTeamID int64) (bool, uuid.UUID, error) {
	opponentName, awayTeamID := resolveOpponent(match.Opposing, pendingTeamID)
	playersPerTeam := normalizePlayersPerTeam(match.PlayersPerTeam)
	status := mapMatchStatus(match.Status)
	createdAt, updatedAt := normalizedTimes(match.CreatedAt, match.UpdatedAt)

	var existingID uuid.UUID
	err := tx.QueryRow(ctx, `
        SELECT id FROM matches
        WHERE name=$1 AND start_time=$2 AND host_team_id=$3`,
		strings.TrimSpace(match.Name), match.StartTime, i.hostTeamID).Scan(&existingID)
	inserted := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !inserted {
		return false, uuid.Nil, fmt.Errorf("find target match: %w", err)
	}

	if inserted {
		matchID := uuid.New()
		_, err = tx.Exec(ctx, `
            INSERT INTO matches (id, name, publication_mode, opponent_state, status,
                host_team_id, away_team_id, opponent_name, players_per_team,
                start_time, end_time, location, location_latitude, location_longitude,
                description, created_by_user_id, created_at, updated_at)
            VALUES ($1,$2,'offline_confirmed','no_recruitment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
			matchID, strings.TrimSpace(match.Name), string(status),
			i.hostTeamID, awayTeamID, opponentName, playersPerTeam,
			match.StartTime, match.EndTime, strings.TrimSpace(match.Location),
			match.Latitude, match.Longitude, match.Description,
			i.createdByUser, createdAt, updatedAt)
		if err != nil {
			return false, uuid.Nil, fmt.Errorf("insert target match: %w", err)
		}
		existingID = matchID
	} else {
		_, err = tx.Exec(ctx, `
            UPDATE matches SET opponent_state='no_recruitment', status=$2, away_team_id=$3,
                opponent_name=$4, players_per_team=$5, location_latitude=$6, location_longitude=$7,
                description=$8, updated_at=$9 WHERE id=$1`,
			existingID, string(status), awayTeamID, opponentName, playersPerTeam,
			match.Latitude, match.Longitude, match.Description, updatedAt)
		if err != nil {
			return false, uuid.Nil, fmt.Errorf("update target match: %w", err)
		}
	}

	groupID, err := ensureHostGroup(ctx, tx, existingID, i.hostTeamID, createdAt)
	if err != nil {
		return false, uuid.Nil, err
	}
	return inserted, groupID, nil
}

func (i Importer) importRegistration(ctx context.Context, tx pgx.Tx, groupID uuid.UUID, userID int64, registration LegacyRegistration) (bool, error) {
	var existingID uuid.UUID
	err := tx.QueryRow(ctx, `SELECT id FROM match_registrations WHERE group_id=$1 AND user_id=$2`, groupID, userID).Scan(&existingID)
	inserted := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !inserted {
		return false, fmt.Errorf("find target registration: %w", err)
	}

	status := mapStand(registration.Stand)
	count := registration.RegistrationCount
	if count <= 0 {
		count = 1
	}
	createdAt, updatedAt := normalizedTimes(registration.CreatedAt, registration.UpdatedAt)

	if inserted {
		_, err = tx.Exec(ctx, `
            INSERT INTO match_registrations (id, group_id, user_id, status, registration_count, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			uuid.New(), groupID, userID, string(status), count, createdAt, updatedAt)
		if err != nil {
			return false, fmt.Errorf("insert target registration: %w", err)
		}
		return true, nil
	}
	_, err = tx.Exec(ctx, `
        UPDATE match_registrations SET status=$2, registration_count=$3, updated_at=$4 WHERE id=$1`,
		existingID, string(status), count, updatedAt)
	if err != nil {
		return false, fmt.Errorf("update target registration: %w", err)
	}
	return false, nil
}

func loadTargetUsers(ctx context.Context, tx pgx.Tx, registrations []LegacyRegistration) (map[string]int64, int, error) {
	openIDs := make(map[string]struct{}, len(registrations))
	for _, registration := range registrations {
		openID := strings.TrimSpace(registration.OpenID)
		if openID != "" {
			openIDs[openID] = struct{}{}
		}
	}
	if len(openIDs) == 0 {
		return map[string]int64{}, 0, nil
	}
	ids := make([]string, 0, len(openIDs))
	for openID := range openIDs {
		ids = append(ids, openID)
	}
	rows, err := tx.Query(ctx, `SELECT openid, id FROM users WHERE openid = ANY($1)`, ids)
	if err != nil {
		return nil, 0, fmt.Errorf("load target users: %w", err)
	}
	defer rows.Close()
	mapping := make(map[string]int64, len(ids))
	for rows.Next() {
		var openID string
		var userID int64
		if err := rows.Scan(&openID, &userID); err != nil {
			return nil, 0, fmt.Errorf("scan target user: %w", err)
		}
		mapping[openID] = userID
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate target users: %w", err)
	}
	return mapping, len(ids) - len(mapping), nil
}

func ensurePendingTeam(ctx context.Context, tx pgx.Tx) (int64, bool, error) {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM teams WHERE name=$1`, pendingTeamName).Scan(&id)
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

func ensureHostGroup(ctx context.Context, tx pgx.Tx, matchID uuid.UUID, teamID int64, now time.Time) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
        SELECT id FROM match_registration_groups
        WHERE match_id=$1 AND kind='host_team' AND status<>'cancelled'`, matchID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, fmt.Errorf("find host group: %w", err)
	}
	id = uuid.New()
	if _, err := tx.Exec(ctx, `
        INSERT INTO match_registration_groups (id, match_id, kind, team_id, status, created_at, updated_at)
        VALUES ($1,$2,'host_team',$3,'open',$4,$4)`,
		id, matchID, teamID, now); err != nil {
		return uuid.Nil, fmt.Errorf("insert host group: %w", err)
	}
	return id, nil
}

// resolveOpponent 把旧库 opposing 文本映射为目标 opponent_name 与 away_team_id。
// 有真实对手名时只填文本、不引用客队；空或“待定”时复用占位“待定”球队。
func resolveOpponent(opposing string, pendingTeamID int64) (*string, *int64) {
	trimmed := strings.TrimSpace(opposing)
	if trimmed == "" || trimmed == "待定" || trimmed == "对手待定" {
		name := pendingTeamName
		teamID := pendingTeamID
		return &name, &teamID
	}
	name := trimmed
	return &name, nil
}

func normalizePlayersPerTeam(value int) int {
	if value <= 0 {
		return 8
	}
	return value
}

func mapMatchStatus(status int) domain.MatchStatus {
	switch status {
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
