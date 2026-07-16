package legacyteams

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Importer struct {
	target *pgxpool.Pool
	source Source
}

func NewImporter(target *pgxpool.Pool, source Source) Importer {
	return Importer{target: target, source: source}
}

func (i Importer) Run(ctx context.Context, dryRun bool) (Report, error) {
	snapshot, err := i.source.Load(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("load legacy team snapshot: %w", err)
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
	userIDs := make(map[int64]int64, len(snapshot.Users))
	for _, user := range snapshot.Users {
		userID, inserted, err := importUser(ctx, tx, user)
		if err != nil {
			return Report{}, err
		}
		userIDs[user.ID] = userID
		if inserted {
			report.UsersInserted++
		} else {
			report.UsersUpdated++
		}
	}

	teamID, inserted, err := importTeam(ctx, tx, snapshot.Team)
	if err != nil {
		return Report{}, err
	}
	if inserted {
		report.TeamsInserted++
	} else {
		report.TeamsUpdated++
	}

	for _, membership := range snapshot.Memberships {
		userID, ok := userIDs[membership.UserID]
		if !ok {
			return Report{}, fmt.Errorf("成员引用未导入的旧用户 ID %d", membership.UserID)
		}
		inserted, err := importMembership(ctx, tx, teamID, userID, membership)
		if err != nil {
			return Report{}, err
		}
		if inserted {
			report.MembershipsInserted++
		} else {
			report.MembershipsUpdated++
		}
	}

	captainID, ok := userIDs[snapshot.Team.CaptainUserID]
	if !ok {
		return Report{}, fmt.Errorf("队长引用未导入的旧用户 ID %d", snapshot.Team.CaptainUserID)
	}
	if _, err := tx.Exec(ctx, `UPDATE teams SET captain_id=$2, updated_at=$3 WHERE id=$1`, teamID, captainID, snapshot.Team.UpdatedAt); err != nil {
		return Report{}, fmt.Errorf("set imported captain: %w", err)
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
	if strings.TrimSpace(snapshot.Team.ID) == "" || strings.TrimSpace(snapshot.Team.Name) == "" {
		return errors.New("旧球队 ID 或名称为空")
	}
	if len(snapshot.Users) == 0 || len(snapshot.Memberships) == 0 {
		return errors.New("旧球队没有可导入的用户或成员")
	}
	seenUsers := make(map[int64]struct{}, len(snapshot.Users))
	seenOpenIDs := make(map[string]struct{}, len(snapshot.Users))
	for _, user := range snapshot.Users {
		openID := strings.TrimSpace(user.OpenID)
		if user.ID <= 0 || openID == "" {
			return errors.New("旧用户 ID 或 openid 为空")
		}
		if _, exists := seenUsers[user.ID]; exists {
			return fmt.Errorf("旧用户 ID %d 重复", user.ID)
		}
		if _, exists := seenOpenIDs[openID]; exists {
			return errors.New("旧用户 openid 重复")
		}
		seenUsers[user.ID] = struct{}{}
		seenOpenIDs[openID] = struct{}{}
	}
	return nil
}

func importUser(ctx context.Context, tx pgx.Tx, user LegacyUser) (int64, bool, error) {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM users WHERE openid=$1`, strings.TrimSpace(user.OpenID)).Scan(&id)
	inserted := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !inserted {
		return 0, false, fmt.Errorf("find target user: %w", err)
	}
	realName := nullableText(user.RealName)
	phoneNumber := nullableText(user.PhoneNumber)
	createdAt, updatedAt := normalizedTimes(user.CreatedAt, user.UpdatedAt)
	if inserted {
		err = tx.QueryRow(ctx, `
            INSERT INTO users (openid,nickname,avatar_url,real_name,phone_number,status,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
			strings.TrimSpace(user.OpenID), strings.TrimSpace(user.Nickname), normalizeAvatarURL(user.AvatarURL),
			realName, phoneNumber, mapUserStatus(user.Status), createdAt, updatedAt,
		).Scan(&id)
	} else {
		_, err = tx.Exec(ctx, `
            UPDATE users SET nickname=$2,avatar_url=$3,real_name=$4,phone_number=$5,status=$6,updated_at=$7
            WHERE id=$1`, id, strings.TrimSpace(user.Nickname), normalizeAvatarURL(user.AvatarURL),
			realName, phoneNumber, mapUserStatus(user.Status), updatedAt)
	}
	if err != nil {
		return 0, false, fmt.Errorf("write target user: %w", err)
	}
	return id, inserted, nil
}

func importTeam(ctx context.Context, tx pgx.Tx, team LegacyTeam) (int64, bool, error) {
	rows, err := tx.Query(ctx, `SELECT id FROM teams WHERE name=$1 ORDER BY id`, strings.TrimSpace(team.Name))
	if err != nil {
		return 0, false, fmt.Errorf("find target team: %w", err)
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return 0, false, fmt.Errorf("scan target team: %w", err)
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, false, fmt.Errorf("iterate target teams: %w", err)
	}
	if len(ids) > 1 {
		return 0, false, fmt.Errorf("目标库存在多个同名球队 %q", team.Name)
	}
	createdAt, updatedAt := normalizedTimes(team.CreatedAt, team.UpdatedAt)
	if len(ids) == 0 {
		var id int64
		err := tx.QueryRow(ctx, `
            INSERT INTO teams (name,description,logo_url,status,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
			strings.TrimSpace(team.Name), team.Description, team.LogoURL, mapTeamStatus(team.Status), createdAt, updatedAt,
		).Scan(&id)
		if err != nil {
			return 0, false, fmt.Errorf("insert target team: %w", err)
		}
		return id, true, nil
	}
	_, err = tx.Exec(ctx, `UPDATE teams SET description=$2,logo_url=$3,status=$4,updated_at=$5 WHERE id=$1`,
		ids[0], team.Description, team.LogoURL, mapTeamStatus(team.Status), updatedAt)
	if err != nil {
		return 0, false, fmt.Errorf("update target team: %w", err)
	}
	return ids[0], false, nil
}

func importMembership(ctx context.Context, tx pgx.Tx, teamID, userID int64, membership LegacyMembership) (bool, error) {
	var id int64
	err := tx.QueryRow(ctx, `SELECT id FROM team_members WHERE team_id=$1 AND user_id=$2`, teamID, userID).Scan(&id)
	inserted := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !inserted {
		return false, fmt.Errorf("find target membership: %w", err)
	}
	joinedAt, createdAt := normalizedTimes(membership.JoinedAt, membership.CreatedAt)
	_, updatedAt := normalizedTimes(createdAt, membership.UpdatedAt)
	if inserted {
		_, err = tx.Exec(ctx, `
            INSERT INTO team_members (team_id,user_id,role,status,joined_at,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`, teamID, userID, mapRole(membership.Role), mapMemberStatus(membership.Status), joinedAt, createdAt, updatedAt)
	} else {
		_, err = tx.Exec(ctx, `
            UPDATE team_members SET role=$2,status=$3,joined_at=$4,updated_at=$5 WHERE id=$1`,
			id, mapRole(membership.Role), mapMemberStatus(membership.Status), joinedAt, updatedAt)
	}
	if err != nil {
		return false, fmt.Errorf("write target membership: %w", err)
	}
	return inserted, nil
}

func nullableText(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func normalizeAvatarURL(value *string) *string {
	if value == nil {
		return nil
	}
	avatar := strings.TrimSpace(*value)
	if avatar == "" {
		return nil
	}
	for prefix, mediaType := range map[string]string{
		"/9j/":   "image/jpeg",
		"iVBOR":  "image/png",
		"R0lGOD": "image/gif",
		"UklGR":  "image/webp",
	} {
		if strings.HasPrefix(avatar, prefix) {
			normalized := "data:" + mediaType + ";base64," + avatar
			return &normalized
		}
	}
	return &avatar
}

func mapRole(role string) string {
	switch role {
	case "captain", "vice_captain":
		return role
	default:
		return "member"
	}
}

func mapMemberStatus(status int) string {
	if status == 1 {
		return "active"
	}
	return "inactive"
}

func mapUserStatus(status int) string {
	if status == 1 {
		return "active"
	}
	return "frozen"
}

func mapTeamStatus(status int) string { return mapUserStatus(status) }

func normalizedTimes(first, second time.Time) (time.Time, time.Time) {
	now := time.Now()
	if first.IsZero() {
		first = now
	}
	if second.IsZero() {
		second = first
	}
	return first, second
}
