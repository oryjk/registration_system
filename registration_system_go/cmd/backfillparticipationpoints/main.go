// backfillparticipationpoints defaults to a read-only preview. Credentials are
// supplied via DATABASE_URL and LEGACY_PG_URL, never command-line arguments.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type projectedScore struct {
	Before float64 `json:"before"`
	After  float64 `json:"after"`
}

type report struct {
	UserScores       map[int64]projectedScore `json:"user_scores,omitempty"`
	Apply            bool                     `json:"apply"`
	Before           time.Time                `json:"before"`
	Candidates       int                      `json:"candidates"`
	Prepared         int                      `json:"prepared"`
	Skipped          int                      `json:"skipped"`
	Legacy           int                      `json:"legacy_operation_time"`
	Native           int                      `json:"go_operation_time"`
	NativeCreated    int                      `json:"go_registration_created_at"`
	RepairGoHistory  bool                     `json:"repair_go_history"`
	ScoreChanges     int                      `json:"score_changes"`
	Rewarded         int                      `json:"positive_bonus_records"`
	AddedCurrentYear float64                  `json:"added_current_year_points"`
	Written          int64                    `json:"written"`
}

func run(ctx context.Context, apply bool, before time.Time, reportUser int64, repairGoHistory bool) (report, error) {
	r := report{Apply: apply, Before: before, RepairGoHistory: repairGoHistory}
	if repairGoHistory && before.After(time.Date(2026, 10, 7, 0, 52, 35, 0, time.UTC)) {
		return r, fmt.Errorf("Go history repair cutoff must not exceed the initial points release: 2026-10-07T00:52:35Z")
	}
	targetURL, sourceURL := os.Getenv("DATABASE_URL"), os.Getenv("LEGACY_PG_URL")
	if targetURL == "" || sourceURL == "" {
		return r, fmt.Errorf("DATABASE_URL and LEGACY_PG_URL are required")
	}
	target, err := pgxpool.New(ctx, targetURL)
	if err != nil {
		return r, fmt.Errorf("cannot configure target database")
	}
	defer target.Close()
	source, err := pgxpool.New(ctx, sourceURL)
	if err != nil {
		return r, fmt.Errorf("cannot configure source database")
	}
	defer source.Close()
	sourceTx, err := source.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return r, fmt.Errorf("cannot read legacy database")
	}
	defer sourceTx.Rollback(ctx)
	oldRows, err := loadLegacy(ctx, sourceTx)
	if err != nil {
		return r, fmt.Errorf("cannot load legacy response times")
	}
	mode := pgx.ReadOnly
	if apply {
		mode = pgx.ReadWrite
	}
	tx, err := target.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: mode})
	if err != nil {
		return r, fmt.Errorf("cannot open target transaction")
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'`); err != nil {
		return r, err
	}
	loader := loadCandidates
	if repairGoHistory {
		loader = loadNativeRepairCandidates
	}
	candidates, err := loader(ctx, tx, before, apply)
	if err != nil {
		return r, fmt.Errorf("cannot load historical candidates")
	}
	r.Candidates = len(candidates)
	location, _ := time.LoadLocation("Asia/Shanghai")
	year := time.Now().In(location).Year()
	updates := make([]rewardUpdate, 0, len(candidates))
	var addedTenths int64
	userAdded := map[int64]int64{}
	for _, c := range candidates {
		var old *legacyResponse
		if c.LegacySource != "" {
			value, found := oldRows[c.LegacySource]
			if !found {
				r.Skipped++
				continue
			}
			old = &value
		}
		update, ok := calculate(c, old)
		if !ok {
			r.Skipped++
			continue
		}
		updates = append(updates, update)
		if update.Source == "legacy-operation-time" {
			r.Legacy++
		} else if update.Source == "go-created-at" {
			r.NativeCreated++
		} else {
			r.Native++
		}
		if update.Bonus > 0 {
			r.Rewarded++
		}
		delta := int64(update.Bonus) - int64(update.PreviousBonus)
		if delta != 0 {
			r.ScoreChanges++
		}
		if c.Eligible && c.Year == year {
			addedTenths += delta
			if c.UserID == reportUser {
				userAdded[c.TeamID] += delta
			}
		}
	}
	r.Prepared = len(updates)
	r.AddedCurrentYear = float64(addedTenths) / 10
	if reportUser > 0 {
		beforeScores := map[int64]int64{}
		rows, err := tx.Query(ctx, `SELECT team_id,participation_points FROM team_participation_totals WHERE user_id=$1 AND score_year=$2`, reportUser, year)
		if err != nil {
			return r, fmt.Errorf("cannot preview requested user's annual scores")
		}
		for rows.Next() {
			var team, points int64
			if err := rows.Scan(&team, &points); err != nil {
				rows.Close()
				return r, err
			}
			beforeScores[team] = points
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return r, err
		}
		rows.Close()
		r.UserScores = map[int64]projectedScore{}
		for team := range userAdded {
			if _, ok := beforeScores[team]; !ok {
				beforeScores[team] = 0
			}
		}
		for team, points := range beforeScores {
			r.UserScores[team] = projectedScore{Before: float64(points) / 10, After: float64(points+userAdded[team]) / 10}
		}
	}
	if apply {
		r.Written, err = applyRewards(ctx, tx, updates)
		if err != nil {
			return r, fmt.Errorf("backfill failed; transaction rolled back")
		}
		if r.Written != int64(len(updates)) {
			return r, fmt.Errorf("historical data changed; transaction rolled back")
		}
		if err = tx.Commit(ctx); err != nil {
			return r, fmt.Errorf("cannot commit backfill; inspect database")
		}
	}
	return r, nil
}

func main() {
	apply := flag.Bool("apply", false, "Apply rewards; default previews without writes")
	beforeFlag := flag.String("before", "", "Required exclusive UTC cutoff, RFC3339; excludes recent operations")
	reportUser := flag.Int64("report-user", 0, "Optionally preview this user's current annual scores")
	repairGoHistory := flag.Bool("repair-go-history", false, "Repair native records from the original faulty backfill; cutoff cannot exceed initial release")
	flag.Parse()
	before, err := time.Parse(time.RFC3339, *beforeFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, "--before must be an explicit RFC3339 cutoff")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	result, err := run(ctx, *apply, before, *reportUser, *repairGoHistory)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err = json.NewEncoder(os.Stdout).Encode(result); err != nil {
		os.Exit(1)
	}
}
