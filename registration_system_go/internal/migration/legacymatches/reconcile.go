package legacymatches

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/migration/mapping"
)

type reconcileResult[T comparable] struct {
	targetID T
	action   mapping.Action
}

type targetUser struct {
	ID                               int64
	OpenID, Nickname                 string
	AvatarURL, RealName, PhoneNumber *string
	Status                           string
}

type targetMatch struct {
	ID                                   uuid.UUID
	Name, PublicationMode, OpponentState string
	Status, Location                     string
	HostTeamID                           int64
	CreatedByUserID                      *int64
	AwayTeamID                           *int64
	OpponentName                         *string
	PlayersPerTeam                       int
	StartTime, EndTime                   time.Time
	Latitude, Longitude                  *float64
	Description                          *string
}

type targetRegistration struct {
	ID                uuid.UUID
	GroupID           uuid.UUID
	UserID            int64
	Status            string
	RegistrationCount int
	CancelledAt       *time.Time
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
	tx, err := i.target.Begin(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("begin target transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	store := mapping.NewStore(tx)
	tracked, err := store.ListOwnedTargetIDs(ctx, mapping.SourceLegacyPostgres, mapping.EntityMatch)
	if err != nil {
		return Report{}, err
	}
	trackedSourceIDs := make([]string, 0, len(tracked))
	for sourceID := range tracked {
		trackedSourceIDs = append(trackedSourceIDs, sourceID)
	}
	sort.Strings(trackedSourceIDs)
	snapshot, err := i.source.Load(ctx, LoadOptions{
		Mode: options.Mode, Since: options.Since, TrackedMatchSourceIDs: trackedSourceIDs,
	})
	if err != nil {
		return Report{}, fmt.Errorf("load legacy match snapshot: %w", err)
	}
	if err := validateSnapshot(snapshot); err != nil {
		return Report{}, err
	}
	if err := validateBootstrapTargets(ctx, tx, i.hostTeamID, i.createdByUser); err != nil {
		return Report{}, err
	}

	report := Report{}
	pendingTeamID, created, err := ensurePendingTeam(ctx, tx)
	if err != nil {
		return report, err
	}
	report.PendingTeamCreated = created

	userIDs := make(map[int64]int64, len(snapshot.Users))
	for _, user := range snapshot.Users {
		result, err := reconcileUser(ctx, tx, store, options.ExplicitMappings, user)
		if err != nil {
			report.Conflicts++
			return report, err
		}
		userIDs[user.SourceID] = result.targetID
		addUserAction(&report, result.action)
	}

	groupsByMatch := make(map[string]uuid.UUID, len(snapshot.Matches))
	presentMatches := make(map[string]struct{}, len(snapshot.Matches))
	for _, legacyMatch := range snapshot.Matches {
		result, groupID, err := i.reconcileMatch(ctx, tx, store, options.ExplicitMappings, legacyMatch, pendingTeamID)
		if err != nil {
			report.Conflicts++
			return report, err
		}
		presentMatches[strings.TrimSpace(legacyMatch.SourceID)] = struct{}{}
		groupsByMatch[strings.TrimSpace(legacyMatch.SourceID)] = groupID
		addMatchAction(&report, result.action)
	}

	presentRegistrations := make(map[string]struct{}, len(snapshot.Registrations))
	for _, registration := range snapshot.Registrations {
		groupID, matchExists := groupsByMatch[strings.TrimSpace(registration.ActivitySourceID)]
		userID, userExists := userIDs[registration.UserSourceID]
		if !matchExists || !userExists {
			report.OrphanReferences++
			return report, fmt.Errorf("legacy registration %s references an unmapped match or user", registrationSourceID(registration.ActivitySourceID, registration.UserSourceID))
		}
		sourceID := registrationSourceID(registration.ActivitySourceID, registration.UserSourceID)
		presentRegistrations[sourceID] = struct{}{}
		result, err := reconcileRegistration(ctx, tx, store, options.ExplicitMappings, sourceID, groupID, userID, registration)
		if err != nil {
			report.Conflicts++
			return report, err
		}
		addRegistrationAction(&report, result.action)
	}
	if options.Mode == mapping.ModeFull {
		report.RegistrationsCancelled, err = cancelMissingRegistrations(ctx, tx, store, presentMatches, presentRegistrations)
		if err != nil {
			return report, err
		}
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
	// 用户按旧库 ID 显式插入，序列不会自动前进；导入后重置，避免应用侧新用户撞 ID。
	if _, err := i.target.Exec(ctx, `SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT max(id) FROM users), 1))`); err != nil {
		return report, fmt.Errorf("reset users id sequence: %w", err)
	}
	return report, nil
}

func reconcileUser(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, user LegacyUser) (reconcileResult[int64], error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyPostgres, EntityType: mapping.EntityUser, SourceID: strconv.FormatInt(user.SourceID, 10)}
	sourceFingerprint, err := sourceUserFingerprint(user)
	if err != nil {
		return reconcileResult[int64]{}, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult[int64]{}, err
	}
	current, targetExists, explicit, explicitExists, candidates, err := resolveUserTargets(ctx, tx, config, key, existing, found, user.OpenID)
	if err != nil {
		return reconcileResult[int64]{}, err
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetUserFingerprint(current)
		if err != nil {
			return reconcileResult[int64]{}, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{
		Existing: optionalRecord(existing, found), TargetExists: targetExists,
		ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists,
		DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint,
		CurrentTargetFingerprint: currentFingerprint,
	})
	if err != nil {
		return reconcileResult[int64]{}, fmt.Errorf("resolve legacy postgres user %d: %w", user.SourceID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult[int64]{}, fmt.Errorf("legacy postgres user %d source and target both changed", user.SourceID)
	}
	if decision.Action == mapping.ActionSkip || decision.Action == mapping.ActionTargetModified {
		return reconcileResult[int64]{targetID: current.ID, action: decision.Action}, nil
	}
	createdAt, updatedAt := normalizedTimes(user.UpdatedAt, user.UpdatedAt)
	if decision.Action == mapping.ActionCreate {
		// 保留旧库用户 ID：历史数据对外按 user id 关联（钱包、管理端习惯、口头引用），
		// 自动分配新 ID 会破坏这些延续性；显式插入后由调用方重置序列。
		err = tx.QueryRow(ctx, `INSERT INTO users (id,openid,nickname,avatar_url,real_name,phone_number,status,created_at,updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
			user.SourceID, strings.TrimSpace(user.OpenID), strings.TrimSpace(user.Nickname), nullableText(user.AvatarURL),
			nullableText(user.RealName), nullableText(user.PhoneNumber), mapUserStatus(user.Status), createdAt, updatedAt,
		).Scan(&current.ID)
	} else {
		current.ID, err = parsePositiveID(decision.TargetID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE users SET openid=$2,nickname=$3,avatar_url=$4,real_name=$5,phone_number=$6,status=$7,updated_at=$8 WHERE id=$1`,
				current.ID, strings.TrimSpace(user.OpenID), strings.TrimSpace(user.Nickname), nullableText(user.AvatarURL),
				nullableText(user.RealName), nullableText(user.PhoneNumber), mapUserStatus(user.Status), updatedAt)
		}
	}
	if err != nil {
		return reconcileResult[int64]{}, fmt.Errorf("write target user: %w", err)
	}
	current, _, err = loadTargetUserByID(ctx, tx, current.ID)
	if err != nil {
		return reconcileResult[int64]{}, err
	}
	targetFingerprint, err := targetUserFingerprint(current)
	if err != nil {
		return reconcileResult[int64]{}, err
	}
	if err := store.Upsert(ctx, newRecord(key, strconv.FormatInt(current.ID, 10), timePointer(user.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
		return reconcileResult[int64]{}, err
	}
	return reconcileResult[int64]{targetID: current.ID, action: decision.Action}, nil
}

func (i Importer) reconcileMatch(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, legacyMatch LegacyMatch, pendingTeamID int64) (reconcileResult[uuid.UUID], uuid.UUID, error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyPostgres, EntityType: mapping.EntityMatch, SourceID: strings.TrimSpace(legacyMatch.SourceID)}
	sourceFingerprint, err := sourceMatchFingerprint(legacyMatch)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, err
	}
	current, targetExists, explicit, explicitExists, candidates, err := i.resolveMatchTargets(ctx, tx, config, key, existing, found, legacyMatch)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, err
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetMatchFingerprint(current)
		if err != nil {
			return reconcileResult[uuid.UUID]{}, uuid.Nil, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{
		Existing: optionalRecord(existing, found), TargetExists: targetExists,
		ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists,
		DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint,
		CurrentTargetFingerprint: currentFingerprint,
	})
	if err != nil {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, fmt.Errorf("resolve legacy match %s: %w", legacyMatch.SourceID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, fmt.Errorf("legacy match %s source and target both changed", legacyMatch.SourceID)
	}
	if decision.Action != mapping.ActionSkip && decision.Action != mapping.ActionTargetModified {
		current.ID, err = i.writeTargetMatch(ctx, tx, decision, current.ID, legacyMatch, pendingTeamID)
		if err != nil {
			return reconcileResult[uuid.UUID]{}, uuid.Nil, err
		}
		current, _, err = loadTargetMatchByID(ctx, tx, current.ID)
		if err != nil {
			return reconcileResult[uuid.UUID]{}, uuid.Nil, err
		}
		targetFingerprint, err := targetMatchFingerprint(current)
		if err != nil {
			return reconcileResult[uuid.UUID]{}, uuid.Nil, err
		}
		if err := store.Upsert(ctx, newRecord(key, current.ID.String(), timePointer(legacyMatch.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
			return reconcileResult[uuid.UUID]{}, uuid.Nil, err
		}
	}
	groupID, err := ensureHostGroup(ctx, tx, current.ID, i.hostTeamID, normalizedTime(legacyMatch.CreatedAt))
	if err != nil {
		return reconcileResult[uuid.UUID]{}, uuid.Nil, err
	}
	return reconcileResult[uuid.UUID]{targetID: current.ID, action: decision.Action}, groupID, nil
}

func reconcileRegistration(ctx context.Context, tx pgx.Tx, store mapping.Store, config mapping.Config, sourceID string, groupID uuid.UUID, userID int64, registration LegacyRegistration) (reconcileResult[uuid.UUID], error) {
	key := mapping.EntityKey{SourceSystem: mapping.SourceLegacyPostgres, EntityType: mapping.EntityRegistration, SourceID: sourceID}
	sourceFingerprint, err := sourceRegistrationFingerprint(registration)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	existing, found, err := store.Find(ctx, key)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	current, targetExists, explicit, explicitExists, candidates, err := resolveRegistrationTargets(ctx, tx, config, key, existing, found, groupID, userID)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	currentFingerprint := ""
	if targetExists || explicitExists || len(candidates) == 1 {
		currentFingerprint, err = targetRegistrationFingerprint(current)
		if err != nil {
			return reconcileResult[uuid.UUID]{}, err
		}
	}
	decision, err := mapping.Resolve(mapping.ResolveInput{
		Existing: optionalRecord(existing, found), TargetExists: targetExists,
		ExplicitTargetID: explicit, ExplicitTargetExists: explicitExists,
		DeterministicTargetIDs: candidates, SourceFingerprint: sourceFingerprint,
		CurrentTargetFingerprint: currentFingerprint,
	})
	if err != nil {
		return reconcileResult[uuid.UUID]{}, fmt.Errorf("resolve legacy registration %s: %w", sourceID, err)
	}
	if decision.Action == mapping.ActionConflict {
		return reconcileResult[uuid.UUID]{}, fmt.Errorf("legacy registration %s source and target both changed", sourceID)
	}
	if decision.Action == mapping.ActionSkip || decision.Action == mapping.ActionTargetModified {
		return reconcileResult[uuid.UUID]{targetID: current.ID, action: decision.Action}, nil
	}
	count := normalizeRegistrationCount(registration.RegistrationCount)
	createdAt, updatedAt := normalizedTimes(registration.CreatedAt, registration.UpdatedAt)
	if decision.Action == mapping.ActionCreate {
		current.ID = uuid.New()
		_, err = tx.Exec(ctx, `INSERT INTO match_registrations (id,group_id,user_id,status,registration_count,created_at,updated_at,cancelled_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)`, current.ID, groupID, userID, mapStand(registration.Stand), count, createdAt, updatedAt)
	} else {
		current.ID, err = uuid.Parse(decision.TargetID)
		if err == nil {
			_, err = tx.Exec(ctx, `UPDATE match_registrations SET group_id=$2,user_id=$3,status=$4,registration_count=$5,updated_at=$6,cancelled_at=NULL WHERE id=$1`,
				current.ID, groupID, userID, mapStand(registration.Stand), count, updatedAt)
		}
	}
	if err != nil {
		return reconcileResult[uuid.UUID]{}, fmt.Errorf("write target registration: %w", err)
	}
	current, _, err = loadTargetRegistrationByID(ctx, tx, current.ID)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	targetFingerprint, err := targetRegistrationFingerprint(current)
	if err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	if err := store.Upsert(ctx, newRecord(key, current.ID.String(), timePointer(registration.UpdatedAt), sourceFingerprint, targetFingerprint)); err != nil {
		return reconcileResult[uuid.UUID]{}, err
	}
	return reconcileResult[uuid.UUID]{targetID: current.ID, action: decision.Action}, nil
}

func resolveUserTargets(ctx context.Context, tx pgx.Tx, config mapping.Config, key mapping.EntityKey, existing mapping.Record, found bool, openID string) (targetUser, bool, string, bool, []string, error) {
	var current targetUser
	targetExists := false
	if found {
		id, err := parsePositiveID(existing.TargetID)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, targetExists, err = loadTargetUserByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := parsePositiveID(explicit)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, explicitExists, err = loadTargetUserByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		candidate, exists, err := loadTargetUserByOpenID(ctx, tx, strings.TrimSpace(openID))
		if err != nil {
			return current, false, "", false, nil, err
		}
		if exists {
			current = candidate
			candidates = []string{strconv.FormatInt(candidate.ID, 10)}
		}
	}
	return current, targetExists, explicit, explicitExists, candidates, nil
}

func (i Importer) resolveMatchTargets(ctx context.Context, tx pgx.Tx, config mapping.Config, key mapping.EntityKey, existing mapping.Record, found bool, legacyMatch LegacyMatch) (targetMatch, bool, string, bool, []string, error) {
	var current targetMatch
	targetExists := false
	if found {
		id, err := uuid.Parse(existing.TargetID)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, targetExists, err = loadTargetMatchByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := uuid.Parse(explicit)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, explicitExists, err = loadTargetMatchByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		matches, err := loadTargetMatchesByNaturalKey(ctx, tx, i.hostTeamID, legacyMatch.StartTime, strings.TrimSpace(legacyMatch.Name))
		if err != nil {
			return current, false, "", false, nil, err
		}
		for _, candidate := range matches {
			current = candidate
			candidates = append(candidates, candidate.ID.String())
		}
	}
	return current, targetExists, explicit, explicitExists, candidates, nil
}

func resolveRegistrationTargets(ctx context.Context, tx pgx.Tx, config mapping.Config, key mapping.EntityKey, existing mapping.Record, found bool, groupID uuid.UUID, userID int64) (targetRegistration, bool, string, bool, []string, error) {
	var current targetRegistration
	targetExists := false
	if found {
		id, err := uuid.Parse(existing.TargetID)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, targetExists, err = loadTargetRegistrationByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	explicit, hasExplicit := config.Lookup(key.SourceSystem, key.EntityType, key.SourceID)
	explicitExists := false
	if !found && hasExplicit {
		id, err := uuid.Parse(explicit)
		if err != nil {
			return current, false, "", false, nil, err
		}
		current, explicitExists, err = loadTargetRegistrationByID(ctx, tx, id)
		if err != nil {
			return current, false, "", false, nil, err
		}
	}
	var candidates []string
	if !found && !hasExplicit {
		candidate, exists, err := loadTargetRegistrationByPair(ctx, tx, groupID, userID)
		if err != nil {
			return current, false, "", false, nil, err
		}
		if exists {
			current = candidate
			candidates = []string{candidate.ID.String()}
		}
	}
	return current, targetExists, explicit, explicitExists, candidates, nil
}

func (i Importer) writeTargetMatch(ctx context.Context, tx pgx.Tx, decision mapping.Decision, currentID uuid.UUID, legacyMatch LegacyMatch, pendingTeamID int64) (uuid.UUID, error) {
	opponentName, awayTeamID := resolveOpponent(legacyMatch.Opposing, pendingTeamID)
	createdAt, updatedAt := normalizedTimes(legacyMatch.CreatedAt, legacyMatch.UpdatedAt)
	startTime, endTime := normalizeMatchWindow(legacyMatch.StartTime, legacyMatch.EndTime)
	if decision.Action == mapping.ActionCreate {
		currentID = uuid.New()
		_, err := tx.Exec(ctx, `INSERT INTO matches (id,name,publication_mode,opponent_state,status,host_team_id,away_team_id,opponent_name,players_per_team,start_time,end_time,location,location_latitude,location_longitude,description,created_by_user_id,created_at,updated_at)
			VALUES ($1,$2,'offline_confirmed','no_recruitment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
			currentID, strings.TrimSpace(legacyMatch.Name), mapMatchStatus(legacyMatch.Status), i.hostTeamID, awayTeamID,
			opponentName, normalizePlayersPerTeam(legacyMatch.PlayersPerTeam), startTime, endTime,
			strings.TrimSpace(legacyMatch.Location), legacyMatch.Latitude, legacyMatch.Longitude, nullableTextPointer(legacyMatch.Description),
			i.createdByUser, createdAt, updatedAt)
		if err != nil {
			return uuid.Nil, fmt.Errorf("insert target match: %w", err)
		}
		return currentID, nil
	}
	parsed, err := uuid.Parse(decision.TargetID)
	if err != nil {
		return uuid.Nil, err
	}
	_, err = tx.Exec(ctx, `UPDATE matches SET name=$2,publication_mode='offline_confirmed',opponent_state='no_recruitment',status=$3,host_team_id=$4,away_team_id=$5,opponent_name=$6,players_per_team=$7,start_time=$8,end_time=$9,location=$10,location_latitude=$11,location_longitude=$12,description=$13,updated_at=$14,created_by_user_id=$15,created_by_admin_id=NULL WHERE id=$1`,
		parsed, strings.TrimSpace(legacyMatch.Name), mapMatchStatus(legacyMatch.Status), i.hostTeamID, awayTeamID,
		opponentName, normalizePlayersPerTeam(legacyMatch.PlayersPerTeam), startTime, endTime,
		strings.TrimSpace(legacyMatch.Location), legacyMatch.Latitude, legacyMatch.Longitude, nullableTextPointer(legacyMatch.Description), updatedAt, i.createdByUser)
	if err != nil {
		return uuid.Nil, fmt.Errorf("update target match: %w", err)
	}
	return parsed, nil
}

func cancelMissingRegistrations(ctx context.Context, tx pgx.Tx, store mapping.Store, presentMatches, presentRegistrations map[string]struct{}) (int, error) {
	owned, err := store.ListOwnedTargetIDs(ctx, mapping.SourceLegacyPostgres, mapping.EntityRegistration)
	if err != nil {
		return 0, err
	}
	total := 0
	for sourceID, targetID := range owned {
		if _, exists := presentRegistrations[sourceID]; exists {
			continue
		}
		activitySourceID, _, ok := strings.Cut(sourceID, ":")
		if !ok {
			return total, fmt.Errorf("invalid legacy registration source ID %q", sourceID)
		}
		if _, authoritative := presentMatches[activitySourceID]; !authoritative {
			continue
		}
		id, err := uuid.Parse(targetID)
		if err != nil {
			return total, err
		}
		result, err := tx.Exec(ctx, `UPDATE match_registrations SET status='cancelled',cancelled_at=COALESCE(cancelled_at,NOW()),updated_at=NOW() WHERE id=$1 AND status<>'cancelled'`, id)
		if err != nil {
			return total, fmt.Errorf("cancel missing legacy registration: %w", err)
		}
		if result.RowsAffected() == 0 {
			continue
		}
		record, found, err := store.Find(ctx, mapping.EntityKey{SourceSystem: mapping.SourceLegacyPostgres, EntityType: mapping.EntityRegistration, SourceID: sourceID})
		if err != nil || !found {
			return total, err
		}
		current, exists, err := loadTargetRegistrationByID(ctx, tx, id)
		if err != nil || !exists {
			return total, err
		}
		record.SourceFingerprint, err = mapping.Fingerprint(map[string]any{"deleted": true, "source_id": sourceID})
		if err != nil {
			return total, err
		}
		record.TargetFingerprint, err = targetRegistrationFingerprint(current)
		if err != nil {
			return total, err
		}
		record.MigratedAt = time.Now().UTC()
		if err := store.Upsert(ctx, record); err != nil {
			return total, err
		}
		total++
	}
	return total, nil
}

func sourceUserFingerprint(user LegacyUser) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"openid": strings.TrimSpace(user.OpenID), "nickname": strings.TrimSpace(user.Nickname),
		"avatar_url": nullableText(user.AvatarURL), "real_name": nullableText(user.RealName),
		"phone_number": nullableText(user.PhoneNumber), "status": mapUserStatus(user.Status),
	})
}

func targetUserFingerprint(user targetUser) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"openid": user.OpenID, "nickname": user.Nickname, "avatar_url": user.AvatarURL,
		"real_name": user.RealName, "phone_number": user.PhoneNumber, "status": user.Status,
	})
}

func sourceMatchFingerprint(match LegacyMatch) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"name": strings.TrimSpace(match.Name), "opposing": strings.TrimSpace(match.Opposing),
		"status": match.Status, "players_per_team": normalizePlayersPerTeam(match.PlayersPerTeam),
		"start_time": match.StartTime, "end_time": match.EndTime, "location": strings.TrimSpace(match.Location),
		"latitude": match.Latitude, "longitude": match.Longitude, "description": nullableTextPointer(match.Description),
		"home_team_source_id": match.HomeTeamSourceID,
	})
}

func targetMatchFingerprint(match targetMatch) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"name": match.Name, "publication_mode": match.PublicationMode, "opponent_state": match.OpponentState,
		"opponent_name": match.OpponentName, "status": match.Status,
		"players_per_team": match.PlayersPerTeam, "start_time": match.StartTime, "end_time": match.EndTime,
		"location": match.Location, "latitude": match.Latitude, "longitude": match.Longitude,
		"description": match.Description, "host_team_id": match.HostTeamID, "away_team_id": match.AwayTeamID,
		"created_by_user_id": match.CreatedByUserID,
	})
}

func sourceRegistrationFingerprint(registration LegacyRegistration) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"activity_source_id": strings.TrimSpace(registration.ActivitySourceID),
		"user_source_id":     registration.UserSourceID, "stand": registration.Stand,
		"registration_count": normalizeRegistrationCount(registration.RegistrationCount),
		"operation_time":     registration.OperationTime,
	})
}

func targetRegistrationFingerprint(registration targetRegistration) (string, error) {
	return mapping.Fingerprint(map[string]any{
		"group_id": registration.GroupID.String(), "user_id": registration.UserID,
		"status": registration.Status, "registration_count": registration.RegistrationCount,
		"cancelled_at": registration.CancelledAt,
	})
}

func loadTargetUserByID(ctx context.Context, tx pgx.Tx, id int64) (targetUser, bool, error) {
	var item targetUser
	err := tx.QueryRow(ctx, `SELECT id,openid,nickname,avatar_url,real_name,phone_number,status FROM users WHERE id=$1`, id).Scan(&item.ID, &item.OpenID, &item.Nickname, &item.AvatarURL, &item.RealName, &item.PhoneNumber, &item.Status)
	found, err := rowFound(err)
	return item, found, err
}

func loadTargetUserByOpenID(ctx context.Context, tx pgx.Tx, openID string) (targetUser, bool, error) {
	var item targetUser
	err := tx.QueryRow(ctx, `SELECT id,openid,nickname,avatar_url,real_name,phone_number,status FROM users WHERE openid=$1`, openID).Scan(&item.ID, &item.OpenID, &item.Nickname, &item.AvatarURL, &item.RealName, &item.PhoneNumber, &item.Status)
	found, err := rowFound(err)
	return item, found, err
}

func loadTargetMatchByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (targetMatch, bool, error) {
	var item targetMatch
	err := tx.QueryRow(ctx, `SELECT id,name,publication_mode,opponent_state,status,host_team_id,away_team_id,opponent_name,players_per_team,start_time,end_time,location,location_latitude,location_longitude,description,created_by_user_id FROM matches WHERE id=$1`, id).Scan(
		&item.ID, &item.Name, &item.PublicationMode, &item.OpponentState, &item.Status, &item.HostTeamID, &item.AwayTeamID, &item.OpponentName,
		&item.PlayersPerTeam, &item.StartTime, &item.EndTime, &item.Location, &item.Latitude, &item.Longitude, &item.Description, &item.CreatedByUserID)
	found, err := rowFound(err)
	return item, found, err
}

func loadTargetMatchesByNaturalKey(ctx context.Context, tx pgx.Tx, hostTeamID int64, startTime time.Time, name string) ([]targetMatch, error) {
	rows, err := tx.Query(ctx, `SELECT id,name,publication_mode,opponent_state,status,host_team_id,away_team_id,opponent_name,players_per_team,start_time,end_time,location,location_latitude,location_longitude,description,created_by_user_id FROM matches WHERE host_team_id=$1 AND start_time=$2 AND name=$3 ORDER BY id`, hostTeamID, startTime, name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []targetMatch
	for rows.Next() {
		var item targetMatch
		if err := rows.Scan(&item.ID, &item.Name, &item.PublicationMode, &item.OpponentState, &item.Status, &item.HostTeamID, &item.AwayTeamID, &item.OpponentName, &item.PlayersPerTeam, &item.StartTime, &item.EndTime, &item.Location, &item.Latitude, &item.Longitude, &item.Description, &item.CreatedByUserID); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func loadTargetRegistrationByID(ctx context.Context, tx pgx.Tx, id uuid.UUID) (targetRegistration, bool, error) {
	var item targetRegistration
	err := tx.QueryRow(ctx, `SELECT id,group_id,user_id,status,registration_count,cancelled_at FROM match_registrations WHERE id=$1`, id).Scan(&item.ID, &item.GroupID, &item.UserID, &item.Status, &item.RegistrationCount, &item.CancelledAt)
	found, err := rowFound(err)
	return item, found, err
}

func loadTargetRegistrationByPair(ctx context.Context, tx pgx.Tx, groupID uuid.UUID, userID int64) (targetRegistration, bool, error) {
	var item targetRegistration
	err := tx.QueryRow(ctx, `SELECT id,group_id,user_id,status,registration_count,cancelled_at FROM match_registrations WHERE group_id=$1 AND user_id=$2`, groupID, userID).Scan(&item.ID, &item.GroupID, &item.UserID, &item.Status, &item.RegistrationCount, &item.CancelledAt)
	found, err := rowFound(err)
	return item, found, err
}

func validateBootstrapTargets(ctx context.Context, tx pgx.Tx, hostTeamID, createdByUser int64) error {
	var valid bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM teams WHERE id=$1) AND EXISTS(SELECT 1 FROM users WHERE id=$2)`, hostTeamID, createdByUser).Scan(&valid); err != nil {
		return fmt.Errorf("validate match import targets: %w", err)
	}
	if !valid {
		return fmt.Errorf("host team or creator user does not exist")
	}
	return nil
}

func rowFound(err error) (bool, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func registrationSourceID(activitySourceID string, userSourceID int64) string {
	return strings.TrimSpace(activitySourceID) + ":" + strconv.FormatInt(userSourceID, 10)
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

func newRecord(key mapping.EntityKey, targetID string, sourceUpdatedAt *time.Time, sourceFingerprint, targetFingerprint string) mapping.Record {
	return mapping.Record{EntityKey: key, TargetID: targetID, SourceUpdatedAt: sourceUpdatedAt, SourceFingerprint: sourceFingerprint, TargetFingerprint: targetFingerprint, FingerprintVersion: mapping.FingerprintVersion, MigratedAt: time.Now().UTC()}
}

func timePointer(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	value = value.UTC()
	return &value
}

func normalizedTime(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value
}

// 旧库存在 end_time <= start_time 的脏数据（如起止时刻相同的队内赛），
// 新库约束 end_time > start_time；相等或倒置时按 2 小时标准时长修正。
func normalizeMatchWindow(start, end time.Time) (time.Time, time.Time) {
	if !end.After(start) {
		return start, start.Add(2 * time.Hour)
	}
	return start, end
}

func nullableText(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func nullableTextPointer(value *string) *string {
	if value == nil {
		return nil
	}
	return nullableText(*value)
}

func mapUserStatus(status int) string {
	if status == 1 {
		return "active"
	}
	return "frozen"
}

func normalizeRegistrationCount(count int) int {
	if count <= 0 {
		return 1
	}
	return count
}

func addUserAction(report *Report, action mapping.Action) {
	switch action {
	case mapping.ActionCreate:
		report.UsersInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		report.UsersUpdated++
	case mapping.ActionSkip:
		report.UsersSkipped++
	case mapping.ActionTargetModified:
		report.UsersTargetModified++
	}
}

func addMatchAction(report *Report, action mapping.Action) {
	switch action {
	case mapping.ActionCreate:
		report.MatchesInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		report.MatchesUpdated++
	case mapping.ActionSkip:
		report.MatchesSkipped++
	case mapping.ActionTargetModified:
		report.MatchesTargetModified++
	}
}

func addRegistrationAction(report *Report, action mapping.Action) {
	switch action {
	case mapping.ActionCreate:
		report.RegistrationsInserted++
	case mapping.ActionAttach, mapping.ActionUpdate:
		report.RegistrationsUpdated++
	case mapping.ActionSkip:
		report.RegistrationsSkipped++
	case mapping.ActionTargetModified:
		report.RegistrationsTargetModified++
	}
}
