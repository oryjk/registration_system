package legacyteams

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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
	return i.RunWithOptions(ctx, RunOptions{DryRun: dryRun})
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
