package legacyteams

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

type reconcileResult struct {
	targetID int64
	action   mapping.Action
}

type targetUser struct {
	ID                               int64
	OpenID, Nickname                 string
	AvatarURL, RealName, PhoneNumber *string
	Status                           string
}

type targetTeam struct {
	ID                   int64
	Name                 string
	Description, LogoURL *string
	CaptainID            *int64
	Status               string
}

type targetMembership struct {
	ID, TeamID, UserID int64
	Role, Status       string
	JoinedAt           time.Time
}

func normalizeRunOptions(options RunOptions) (RunOptions, error) {
	mode, err := mapping.ParseMode(string(options.Mode))
	if err != nil {
		return RunOptions{}, err
	}
	options.Mode = mode
	return options, nil
}

func (i Importer) RunWithOptions(ctx context.Context, options RunOptions) (Report, error) {
	options, err := normalizeRunOptions(options)
	if err != nil {
		return Report{}, err
	}
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

	store := mapping.NewStore(tx)
	report := Report{}
	userIDs := make(map[int64]int64, len(snapshot.Users))
	for _, user := range snapshot.Users {
		result, err := reconcileUser(ctx, tx, store, options.ExplicitMappings, user)
		if err != nil {
			report.Conflicts++
			return report, err
		}
		userIDs[user.ID] = result.targetID
		addUserAction(&report, result.action)
	}
	captainID, ok := userIDs[snapshot.Team.CaptainUserID]
	if !ok {
		return report, fmt.Errorf("队长引用未导入的旧用户 ID %d", snapshot.Team.CaptainUserID)
	}
	teamResult, err := reconcileTeam(ctx, tx, store, options.ExplicitMappings, snapshot.Team, captainID)
	if err != nil {
		report.Conflicts++
		return report, err
	}
	addTeamAction(&report, teamResult.action)

	presentMemberships := make(map[string]struct{}, len(snapshot.Memberships))
	activeCaptainMembership := false
	for _, membership := range snapshot.Memberships {
		userID, exists := userIDs[membership.UserID]
		if !exists {
			return report, fmt.Errorf("成员引用未导入的旧用户 ID %d", membership.UserID)
		}
		sourceID := membershipSourceID(snapshot.Team.ID, membership.UserID)
		presentMemberships[sourceID] = struct{}{}
		result, err := reconcileMembership(ctx, tx, store, options.ExplicitMappings, sourceID, teamResult.targetID, userID, membership)
		if err != nil {
			report.Conflicts++
			return report, err
		}
		addMembershipAction(&report, result.action)
		if membership.UserID == snapshot.Team.CaptainUserID && mapMemberStatus(membership.Status) == "active" {
			activeCaptainMembership = true
		}
	}
	if !activeCaptainMembership {
		return report, fmt.Errorf("队长必须是球队 active 成员")
	}
	if options.Mode == mapping.ModeFull {
		inactivated, err := inactivateMissingMemberships(ctx, tx, store, presentMemberships)
		if err != nil {
			return report, err
		}
		report.MembershipsInactivated = inactivated
	}
	if options.DryRun {
		if err := tx.Rollback(ctx); err != nil {
			return report, fmt.Errorf("rollback dry run: %w", err)
		}
		return report, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return report, fmt.Errorf("commit import: %w", err)
	}
	return report, nil
}

func reconcileUser(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, user LegacyUser) (reconcileResult, error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyMySQL, EntityType: mapping.EntityUser, SourceID: strconv.FormatInt(user.ID, 10)}
	sourceFingerprint, err := sourceUserFingerprint(user)
	if err != nil {
		return reconcileResult{}, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult{}, err
	}
	var current targetUser
	targetExists := false
	if found {
		id, err := parsePositiveID(existing.TargetID)
		if err != nil {
			return reconcileResult{}, err
		}
		current, targetExists, err = loadTargetUserByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := parsePositiveID(explicit)
		if err != nil {
			return reconcileResult{}, err
		}
		current, explicitExists, err = loadTargetUserByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		candidate, exists, err := loadTargetUserByOpenID(ctx, tx, strings.TrimSpace(user.OpenID))
		if err != nil {
			return reconcileResult{}, err
		}
		if exists {
			current = candidate
			candidates = []string{strconv.FormatInt(candidate.ID, 10)}
		}
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetUserFingerprint(current)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{
		Existing: optionalRecord(existing, found), TargetExists: targetExists,
		ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists,
		DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint,
		CurrentTargetFingerprint: currentFingerprint,
	})
	if err != nil {
		return reconcileResult{}, fmt.Errorf("resolve legacy user %d: %w", user.ID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult{}, fmt.Errorf("legacy user %d source and target both changed", user.ID)
	}
	if decision.Action == mapping.ActionSkip || decision.Action == mapping.ActionTargetModified {
		return reconcileResult{targetID: current.ID, action: decision.Action}, nil
	}
	createdAt, updatedAt := normalizedTimes(user.CreatedAt, user.UpdatedAt)
	if decision.Action == mapping.ActionCreate {
		err = tx.QueryRow(ctx, `INSERT INTO users (openid,nickname,avatar_url,real_name,phone_number,status,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, strings.TrimSpace(user.OpenID), strings.TrimSpace(user.Nickname), normalizeAvatarURL(user.AvatarURL), nullableText(user.RealName), nullableText(user.PhoneNumber), mapUserStatus(user.Status), createdAt, updatedAt).Scan(&current.ID)
	} else {
		current.ID, err = parsePositiveID(decision.TargetID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE users SET openid=$2,nickname=$3,avatar_url=$4,real_name=$5,phone_number=$6,status=$7,updated_at=$8 WHERE id=$1`, current.ID, strings.TrimSpace(user.OpenID), strings.TrimSpace(user.Nickname), normalizeAvatarURL(user.AvatarURL), nullableText(user.RealName), nullableText(user.PhoneNumber), mapUserStatus(user.Status), updatedAt)
		}
	}
	if err != nil {
		return reconcileResult{}, fmt.Errorf("write target user: %w", err)
	}
	current, _, err = loadTargetUserByID(ctx, tx, current.ID)
	if err != nil {
		return reconcileResult{}, err
	}
	targetFingerprint, err := targetUserFingerprint(current)
	if err != nil {
		return reconcileResult{}, err
	}
	if err := store.Upsert(ctx, newRecord(key, current.ID, timePointer(user.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
		return reconcileResult{}, err
	}
	return reconcileResult{targetID: current.ID, action: decision.Action}, nil
}

func reconcileTeam(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, team LegacyTeam, captainID int64) (reconcileResult, error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyMySQL, EntityType: mapping.EntityTeam, SourceID: strings.TrimSpace(team.ID)}
	sourceFingerprint, err := sourceTeamFingerprint(team, captainID)
	if err != nil {
		return reconcileResult{}, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult{}, err
	}
	var current targetTeam
	targetExists := false
	if found {
		id, err := parsePositiveID(existing.TargetID)
		if err != nil {
			return reconcileResult{}, err
		}
		current, targetExists, err = loadTargetTeamByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := parsePositiveID(explicit)
		if err != nil {
			return reconcileResult{}, err
		}
		current, explicitExists, err = loadTargetTeamByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		teams, err := loadTargetTeamsByName(ctx, tx, strings.TrimSpace(team.Name))
		if err != nil {
			return reconcileResult{}, err
		}
		for _, candidate := range teams {
			candidates = append(candidates, strconv.FormatInt(candidate.ID, 10))
			current = candidate
		}
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetTeamFingerprint(current)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{Existing: optionalRecord(existing, found), TargetExists: targetExists, ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists, DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint, CurrentTargetFingerprint: currentFingerprint})
	if err != nil {
		return reconcileResult{}, fmt.Errorf("resolve legacy team %s: %w", team.ID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult{}, fmt.Errorf("legacy team %s source and target both changed", team.ID)
	}
	if decision.Action == mapping.ActionSkip || decision.Action == mapping.ActionTargetModified {
		return reconcileResult{targetID: current.ID, action: decision.Action}, nil
	}
	createdAt, updatedAt := normalizedTimes(team.CreatedAt, team.UpdatedAt)
	if decision.Action == mapping.ActionCreate {
		err = tx.QueryRow(ctx, `INSERT INTO teams (name,description,logo_url,captain_id,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, strings.TrimSpace(team.Name), team.Description, team.LogoURL, captainID, mapTeamStatus(team.Status), createdAt, updatedAt).Scan(&current.ID)
	} else {
		current.ID, err = parsePositiveID(decision.TargetID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE teams SET name=$2,description=$3,logo_url=$4,captain_id=$5,status=$6,updated_at=$7 WHERE id=$1`, current.ID, strings.TrimSpace(team.Name), team.Description, team.LogoURL, captainID, mapTeamStatus(team.Status), updatedAt)
		}
	}
	if err != nil {
		return reconcileResult{}, fmt.Errorf("write target team: %w", err)
	}
	current, _, err = loadTargetTeamByID(ctx, tx, current.ID)
	if err != nil {
		return reconcileResult{}, err
	}
	targetFingerprint, err := targetTeamFingerprint(current)
	if err != nil {
		return reconcileResult{}, err
	}
	if err := store.Upsert(ctx, newRecord(key, current.ID, timePointer(team.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
		return reconcileResult{}, err
	}
	return reconcileResult{targetID: current.ID, action: decision.Action}, nil
}

func reconcileMembership(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, sourceID string, teamID, userID int64, membership LegacyMembership) (reconcileResult, error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyMySQL, EntityType: mapping.EntityMembership, SourceID: sourceID}
	sourceFingerprint, err := sourceMembershipFingerprint(teamID, userID, membership)
	if err != nil {
		return reconcileResult{}, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult{}, err
	}
	var current targetMembership
	targetExists := false
	if found {
		id, err := parsePositiveID(existing.TargetID)
		if err != nil {
			return reconcileResult{}, err
		}
		current, targetExists, err = loadTargetMembershipByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := parsePositiveID(explicit)
		if err != nil {
			return reconcileResult{}, err
		}
		current, explicitExists, err = loadTargetMembershipByID(ctx, tx, id)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		candidate, exists, err := loadTargetMembershipByPair(ctx, tx, teamID, userID)
		if err != nil {
			return reconcileResult{}, err
		}
		if exists {
			current = candidate
			candidates = []string{strconv.FormatInt(candidate.ID, 10)}
		}
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetMembershipFingerprint(current)
		if err != nil {
			return reconcileResult{}, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{Existing: optionalRecord(existing, found), TargetExists: targetExists, ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists, DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint, CurrentTargetFingerprint: currentFingerprint})
	if err != nil {
		return reconcileResult{}, fmt.Errorf("resolve legacy membership %s: %w", sourceID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult{}, fmt.Errorf("legacy membership %s source and target both changed", sourceID)
	}
	if decision.Action == mapping.ActionSkip || decision.Action == mapping.ActionTargetModified {
		return reconcileResult{targetID: current.ID, action: decision.Action}, nil
	}
	joinedAt, createdAt := normalizedTimes(membership.JoinedAt, membership.CreatedAt)
	_, updatedAt := normalizedTimes(createdAt, membership.UpdatedAt)
	if decision.Action == mapping.ActionCreate {
		err = tx.QueryRow(ctx, `INSERT INTO team_members (team_id,user_id,role,status,joined_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, teamID, userID, mapRole(membership.Role), mapMemberStatus(membership.Status), joinedAt, createdAt, updatedAt).Scan(&current.ID)
	} else {
		current.ID, err = parsePositiveID(decision.TargetID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE team_members SET team_id=$2,user_id=$3,role=$4,status=$5,joined_at=$6,updated_at=$7 WHERE id=$1`, current.ID, teamID, userID, mapRole(membership.Role), mapMemberStatus(membership.Status), joinedAt, updatedAt)
		}
	}
	if err != nil {
		return reconcileResult{}, fmt.Errorf("write target membership: %w", err)
	}
	current, _, err = loadTargetMembershipByID(ctx, tx, current.ID)
	if err != nil {
		return reconcileResult{}, err
	}
	targetFingerprint, err := targetMembershipFingerprint(current)
	if err != nil {
		return reconcileResult{}, err
	}
	if err := store.Upsert(ctx, newRecord(key, current.ID, timePointer(membership.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
		return reconcileResult{}, err
	}
	return reconcileResult{targetID: current.ID, action: decision.Action}, nil
}

func sourceUserFingerprint(user LegacyUser) (string, error) {
	return mapping.Fingerprint(map[string]any{"openid": strings.TrimSpace(user.OpenID), "nickname": strings.TrimSpace(user.Nickname), "avatar_url": normalizeAvatarURL(user.AvatarURL), "real_name": nullableText(user.RealName), "phone_number": nullableText(user.PhoneNumber), "status": mapUserStatus(user.Status)})
}
func targetUserFingerprint(user targetUser) (string, error) {
	return mapping.Fingerprint(map[string]any{"openid": user.OpenID, "nickname": user.Nickname, "avatar_url": user.AvatarURL, "real_name": user.RealName, "phone_number": user.PhoneNumber, "status": user.Status})
}
func sourceTeamFingerprint(team LegacyTeam, captainID int64) (string, error) {
	return mapping.Fingerprint(map[string]any{"name": strings.TrimSpace(team.Name), "description": team.Description, "logo_url": team.LogoURL, "captain_id": captainID, "status": mapTeamStatus(team.Status)})
}
func targetTeamFingerprint(team targetTeam) (string, error) {
	return mapping.Fingerprint(map[string]any{"name": team.Name, "description": team.Description, "logo_url": team.LogoURL, "captain_id": team.CaptainID, "status": team.Status})
}
func sourceMembershipFingerprint(teamID, userID int64, member LegacyMembership) (string, error) {
	return mapping.Fingerprint(map[string]any{"team_id": teamID, "user_id": userID, "role": mapRole(member.Role), "status": mapMemberStatus(member.Status), "joined_at": member.JoinedAt})
}
func targetMembershipFingerprint(member targetMembership) (string, error) {
	return mapping.Fingerprint(map[string]any{"team_id": member.TeamID, "user_id": member.UserID, "role": member.Role, "status": member.Status, "joined_at": member.JoinedAt})
}

func loadTargetUserByID(ctx context.Context, tx pgx.Tx, id int64) (targetUser, bool, error) {
	var u targetUser
	err := tx.QueryRow(ctx, `SELECT id,openid,nickname,avatar_url,real_name,phone_number,status FROM users WHERE id=$1`, id).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL, &u.RealName, &u.PhoneNumber, &u.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return targetUser{}, false, nil
	}
	return u, err == nil, err
}
func loadTargetUserByOpenID(ctx context.Context, tx pgx.Tx, openID string) (targetUser, bool, error) {
	var u targetUser
	err := tx.QueryRow(ctx, `SELECT id,openid,nickname,avatar_url,real_name,phone_number,status FROM users WHERE openid=$1`, openID).Scan(&u.ID, &u.OpenID, &u.Nickname, &u.AvatarURL, &u.RealName, &u.PhoneNumber, &u.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return targetUser{}, false, nil
	}
	return u, err == nil, err
}
func loadTargetTeamByID(ctx context.Context, tx pgx.Tx, id int64) (targetTeam, bool, error) {
	var v targetTeam
	err := tx.QueryRow(ctx, `SELECT id,name,description,logo_url,captain_id,status FROM teams WHERE id=$1`, id).Scan(&v.ID, &v.Name, &v.Description, &v.LogoURL, &v.CaptainID, &v.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return targetTeam{}, false, nil
	}
	return v, err == nil, err
}
func loadTargetTeamsByName(ctx context.Context, tx pgx.Tx, name string) ([]targetTeam, error) {
	rows, err := tx.Query(ctx, `SELECT id,name,description,logo_url,captain_id,status FROM teams WHERE name=$1 ORDER BY id`, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []targetTeam
	for rows.Next() {
		var v targetTeam
		if err := rows.Scan(&v.ID, &v.Name, &v.Description, &v.LogoURL, &v.CaptainID, &v.Status); err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}
func loadTargetMembershipByID(ctx context.Context, tx pgx.Tx, id int64) (targetMembership, bool, error) {
	var v targetMembership
	err := tx.QueryRow(ctx, `SELECT id,team_id,user_id,role,status,joined_at FROM team_members WHERE id=$1`, id).Scan(&v.ID, &v.TeamID, &v.UserID, &v.Role, &v.Status, &v.JoinedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return targetMembership{}, false, nil
	}
	return v, err == nil, err
}
func loadTargetMembershipByPair(ctx context.Context, tx pgx.Tx, teamID, userID int64) (targetMembership, bool, error) {
	var v targetMembership
	err := tx.QueryRow(ctx, `SELECT id,team_id,user_id,role,status,joined_at FROM team_members WHERE team_id=$1 AND user_id=$2`, teamID, userID).Scan(&v.ID, &v.TeamID, &v.UserID, &v.Role, &v.Status, &v.JoinedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return targetMembership{}, false, nil
	}
	return v, err == nil, err
}

func inactivateMissingMemberships(ctx context.Context, tx pgx.Tx, store mapping.Store, present map[string]struct{}) (int, error) {
	owned, err := store.ListOwnedTargetIDs(ctx, mapping.SourceLegacyMySQL, mapping.EntityMembership)
	if err != nil {
		return 0, err
	}
	total := 0
	for sourceID, targetID := range owned {
		if _, ok := present[sourceID]; ok {
			continue
		}
		id, err := parsePositiveID(targetID)
		if err != nil {
			return total, err
		}
		result, err := tx.Exec(ctx, `UPDATE team_members SET status='inactive',updated_at=NOW() WHERE id=$1 AND status<>'inactive'`, id)
		if err != nil {
			return total, err
		}
		total += int(result.RowsAffected())
	}
	return total, nil
}
func membershipSourceID(teamSourceID string, userSourceID int64) string {
	return strings.TrimSpace(teamSourceID) + ":" + strconv.FormatInt(userSourceID, 10)
}
func parsePositiveID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid target ID %q", value)
	}
	return id, nil
}
func optionalRecord(record mapping.Record, found bool) *mapping.Record {
	if !found {
		return nil
	}
	return &record
}
func timePointer(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	value = value.UTC()
	return &value
}
func newRecord(key mapping.EntityKey, targetID int64, sourceUpdatedAt *time.Time, sourceFingerprint, targetFingerprint string) mapping.Record {
	return mapping.Record{EntityKey: key, TargetID: strconv.FormatInt(targetID, 10), SourceUpdatedAt: sourceUpdatedAt, SourceFingerprint: sourceFingerprint, TargetFingerprint: targetFingerprint, FingerprintVersion: mapping.FingerprintVersion, MigratedAt: time.Now().UTC()}
}
func addUserAction(r *Report, a mapping.Action) {
	switch a {
	case mapping.ActionCreate:
		r.UsersInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		r.UsersUpdated++
	case mapping.ActionSkip:
		r.UsersSkipped++
	case mapping.ActionTargetModified:
		r.UsersTargetModified++
	}
}
func addTeamAction(r *Report, a mapping.Action) {
	switch a {
	case mapping.ActionCreate:
		r.TeamsInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		r.TeamsUpdated++
	case mapping.ActionSkip:
		r.TeamsSkipped++
	case mapping.ActionTargetModified:
		r.TeamsTargetModified++
	}
}
func addMembershipAction(r *Report, a mapping.Action) {
	switch a {
	case mapping.ActionCreate:
		r.MembershipsInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		r.MembershipsUpdated++
	case mapping.ActionSkip:
		r.MembershipsSkipped++
	case mapping.ActionTargetModified:
		r.MembershipsTargetModified++
	}
}
