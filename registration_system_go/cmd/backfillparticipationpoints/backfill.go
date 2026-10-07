package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/oryjk/registration_system/registration_system_go/internal/match/domain"
)

type candidate struct {
	ID                                          uuid.UUID
	TeamID, UserID                              int64
	OperationTime, Created, GroupCreated, Start time.Time
	RegistrationCreated                         time.Time
	ExistingResponse                            *time.Time
	ExistingBonus                               int32
	Opening, Deadline                           *time.Time
	LegacySource                                string
	Eligible                                    bool
	Year                                        int
}
type legacyResponse struct {
	OperationTime, Created, Start time.Time
	Opening, Deadline             *time.Time
	Stand                         int
}
type rewardUpdate struct {
	ID                                     uuid.UUID
	ResponseAt                             time.Time
	Bonus                                  int32
	Source                                 string
	PreviousResponse                       *time.Time
	PreviousBonus                          int32
	PreviousOperation, RegistrationCreated time.Time
}

// Native creation is the earliest retained registration time; later updates
// must not replace it. Legacy operation time remains the accepted approximation.
// Imported creation dates at/after kickoff are not publication times.
func calculate(c candidate, old *legacyResponse) (rewardUpdate, bool) {
	response, created, opening, deadline, start := c.RegistrationCreated, c.Created, c.Opening, c.Deadline, c.Start
	source := "go-created-at"
	if old != nil {
		created, opening, start = old.Created, old.Opening, old.Start
		if old.Deadline != nil {
			deadline = old.Deadline
		}
		if old.Stand >= 1 && old.Stand <= 3 {
			response, source = old.OperationTime, "legacy-operation-time"
		} else {
			// Imported stand=0 creation is a placeholder, not a user response.
			response, source = c.OperationTime, "go-operation-time"
			if !response.After(old.OperationTime) {
				return rewardUpdate{}, false
			}
		}
	}
	if response.IsZero() || response.Year() < 2010 {
		return rewardUpdate{}, false
	}
	var available time.Time
	if created.Before(start) {
		available = created
	}
	if old == nil && c.GroupCreated.Before(start) && c.GroupCreated.After(available) {
		available = c.GroupCreated
	}
	if opening != nil && opening.Before(start) && opening.After(available) {
		available = *opening
	}
	if available.IsZero() {
		return rewardUpdate{}, false
	}
	if old == nil && response.Before(available.Add(-5*time.Second)) {
		// A pre-opening record cannot establish a first eligible response.
		return rewardUpdate{}, false
	}
	bonus := int32(0)
	if response.Before(start) && (deadline == nil || response.Before(*deadline)) {
		scoringTime := response
		// Legacy creation/registration inserts can differ by a few milliseconds.
		if response.Before(available) && available.Sub(response) <= 5*time.Second {
			scoringTime = available
		}
		bonus = domain.ParticipationBonus(scoringTime, available)
	}
	return rewardUpdate{ID: c.ID, ResponseAt: response, Bonus: bonus, Source: source,
		PreviousResponse: c.ExistingResponse, PreviousBonus: c.ExistingBonus,
		PreviousOperation: c.OperationTime, RegistrationCreated: c.RegistrationCreated}, true
}

func loadCandidates(ctx context.Context, tx pgx.Tx, before time.Time, lock bool) ([]candidate, error) {
	return loadHistoricalCandidates(ctx, tx, before, lock, false)
}

func loadNativeRepairCandidates(ctx context.Context, tx pgx.Tx, before time.Time, lock bool) ([]candidate, error) {
	return loadHistoricalCandidates(ctx, tx, before, lock, true)
}

func loadHistoricalCandidates(ctx context.Context, tx pgx.Tx, before time.Time, lock, repair bool) ([]candidate, error) {
	query := `SELECT r.id,g.team_id,r.user_id,r.updated_at,r.created_at,m.created_at,g.created_at,m.start_time,
 m.registration_start_at,m.registration_end_at,COALESCE(lm.source_id,''),
 (m.status='ended' OR m.end_time <= (NOW() AT TIME ZONE 'UTC')) AND m.start_time < (((date_trunc('day',NOW() AT TIME ZONE 'Asia/Shanghai')+INTERVAL '1 day') AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC'),
 EXTRACT(YEAR FROM ((m.start_time AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai'))::integer,
 r.participation_confirmed_at,r.early_registration_bonus
 FROM match_registrations r JOIN match_registration_groups g ON g.id=r.group_id JOIN matches m ON m.id=g.match_id
 LEFT JOIN legacy_import_mappings lm ON lm.source_system='legacy_postgres' AND lm.entity_type='registration' AND lm.target_id=r.id::text

 WHERE r.created_at<$1 AND r.updated_at<$1
 AND r.status IN ('attending','leave','absent','cancelled') AND g.kind IN ('host_team','guest_team')
 AND g.status<>'cancelled' AND m.status<>'cancelled'`
	if repair {
		// v2 did not exist before the initial release cutoff. These facts were
		// written by the faulty native backfill, never by live first responses.
		query += ` AND lm.target_id IS NULL AND r.participation_rule_version=2
 AND r.participation_confirmed_at=r.updated_at AND r.created_at<r.updated_at`
	} else {
		query += ` AND r.participation_confirmed_at IS NULL`
	}
	query += " ORDER BY r.id"
	if lock {
		query += " FOR UPDATE OF r"
	}
	rows, err := tx.Query(ctx, query, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.ID, &c.TeamID, &c.UserID, &c.OperationTime, &c.RegistrationCreated, &c.Created, &c.GroupCreated, &c.Start, &c.Opening, &c.Deadline, &c.LegacySource, &c.Eligible, &c.Year, &c.ExistingResponse, &c.ExistingBonus); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func loadLegacy(ctx context.Context, tx pgx.Tx) (map[string]legacyResponse, error) {
	rows, err := tx.Query(ctx, `SELECT trim(ua.activity_id)||':'||ua.user_id::text,ua.operation_time,ua.stand,a.created_at,
 ((a.start_time AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC'),
 ((a.end_time AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC'),
 ((a.holding_date AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'UTC')
 FROM rs_user_activity ua JOIN rs_activity a ON a.id=ua.activity_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]legacyResponse{}
	for rows.Next() {
		var key string
		var old legacyResponse
		if err := rows.Scan(&key, &old.OperationTime, &old.Stand, &old.Created, &old.Opening, &old.Deadline, &old.Start); err != nil {
			return nil, err
		}
		if _, duplicate := result[key]; duplicate {
			return nil, fmt.Errorf("duplicate legacy registration mapping")
		}
		result[key] = old
	}
	return result, rows.Err()
}

// Touch only reward facts. Status, registration/payment and operation timestamps
// stay intact. Compare the original reward facts to prevent overwriting a live
// first response or applying the same repair twice.
func applyRewards(ctx context.Context, tx pgx.Tx, updates []rewardUpdate) (int64, error) {
	var count int64
	for _, u := range updates {
		result, err := tx.Exec(ctx, `UPDATE match_registrations SET participation_confirmed_at=$2,early_registration_bonus=$3,
 participation_rule_version=2 WHERE id=$1
 AND participation_confirmed_at IS NOT DISTINCT FROM $4::timestamp AND early_registration_bonus=$5
 AND ($4::timestamp IS NULL OR (participation_rule_version=2 AND updated_at=$6 AND created_at=$7))`,
			u.ID, u.ResponseAt, u.Bonus, u.PreviousResponse, u.PreviousBonus, u.PreviousOperation, u.RegistrationCreated)
		if err != nil {
			return 0, err
		}
		count += result.RowsAffected()
	}
	return count, nil
}
