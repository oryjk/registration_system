package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	sharederror "github.com/oryjk/registration_system/registration_system_go/internal/shared/domain"
	teamfundports "github.com/oryjk/registration_system/registration_system_go/internal/teamfund/ports"
	"github.com/oryjk/registration_system/registration_system_go/internal/testsupport"
)

type settlementSeed struct {
	pool   *pgxpool.Pool
	teamID int64
	payer  int64 // 有余额的成员
	cold   int64 // 无成员记录的出场者
	match  uuid.UUID
}

func seedSettlement(t *testing.T, pool *pgxpool.Pool, payerBalance int64) settlementSeed {
	t.Helper()
	ctx := context.Background()
	seed := settlementSeed{pool: pool, match: uuid.New()}
	suffix := time.Now().UnixNano()

	mustSeedUser := func(label string) int64 {
		var userID int64
		if err := pool.QueryRow(ctx,
			`INSERT INTO users (openid) VALUES ($1) RETURNING id`, fmt.Sprintf("fund-%s-%d", label, suffix),
		).Scan(&userID); err != nil {
			t.Fatal(err)
		}
		return userID
	}
	seed.payer = mustSeedUser("payer")
	seed.cold = mustSeedUser("cold")
	captain := mustSeedUser("captain")

	if err := pool.QueryRow(ctx,
		`INSERT INTO teams (name, captain_id) VALUES ($1, $2) RETURNING id`,
		fmt.Sprintf("队-%d", suffix), captain,
	).Scan(&seed.teamID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO team_members (team_id, user_id, role, balance_cents) VALUES ($1, $2, 'member', $3)`,
		seed.teamID, seed.payer, payerBalance,
	); err != nil {
		t.Fatal(err)
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO matches (id, name, publication_mode, opponent_state, status, host_team_id,
		                     players_per_team, start_time, "end_time", location, created_by_user_id)
		VALUES ($1, $2, 'online_team', 'confirmed', 'ended', $3, 5, NOW() - INTERVAL '3 hours',
		        NOW() - INTERVAL '1 hours', '球场', $4)`,
		seed.match, fmt.Sprintf("球局-%d", suffix), seed.teamID, captain,
	); err != nil {
		t.Fatal(err)
	}
	return seed
}

func chargesFor(seed settlementSeed, payerCents, coldCents int64) []teamfundports.SettlementCharge {
	return []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: payerCents},
		{TeamID: seed.teamID, UserID: seed.cold, AmountCents: coldCents},
	}
}

func memberBalance(t *testing.T, pool *pgxpool.Pool, teamID, userID int64) int64 {
	t.Helper()
	// 无成员行视为余额 0（免付/未扣款者不会被建行）。
	var balance int64
	if err := pool.QueryRow(context.Background(),
		`SELECT COALESCE((SELECT balance_cents FROM team_members WHERE team_id = $1 AND user_id = $2), 0)`, teamID, userID,
	).Scan(&balance); err != nil {
		t.Fatal(err)
	}
	return balance
}

func TestSettleDebitsAndRecordsTransactions(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	outcome, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "赛后扣费", chargesFor(seed, 3000, 1000))
	if err != nil {
		t.Fatal(err)
	}
	if outcome.BatchNo != 1 || outcome.TotalAmountCents != 4000 || len(outcome.Items) != 2 {
		t.Fatalf("outcome=%+v", outcome)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 2000 {
		t.Fatalf("扣款后余额应为 2000，得到 %d", got)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.cold); got != -1000 {
		t.Fatalf("无记录成员应从 0 扣成 -1000，得到 %d", got)
	}

	transactions, err := repository.ListTransactions(context.Background(), seed.payer, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(transactions) != 1 || transactions[0].AmountCents != -3000 || transactions[0].BalanceAfterCents != 2000 {
		t.Fatalf("扣费流水应带符号且记余额快照: %+v", transactions)
	}
	if transactions[0].Source != "match_settlement" || transactions[0].TeamName == "" {
		t.Fatalf("流水应含来源与球队名: %+v", transactions[0])
	}
}

func TestSettleAllowsZeroAmountAndRecordsBalanceOnly(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	outcome, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "门将免付", chargesFor(seed, 3000, 0))
	if err != nil {
		t.Fatal(err)
	}
	if outcome.TotalAmountCents != 3000 {
		t.Fatalf("免付者不计入总额: %+v", outcome)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.cold); got != 0 {
		t.Fatalf("免付者不应被建行扣款，得到 %d", got)
	}
	transactions, err := repository.ListTransactions(context.Background(), seed.cold, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(transactions) != 0 {
		t.Fatalf("免付者不应有流水: %+v", transactions)
	}
}

func TestReSettleReversesOldBatch(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	if _, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "第一次", chargesFor(seed, 3000, 1000)); err != nil {
		t.Fatal(err)
	}
	outcome, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "重算", chargesFor(seed, 2000, 500))
	if err != nil {
		t.Fatal(err)
	}
	if outcome.ReversedBatchNo != 2 || outcome.BatchNo != 3 {
		t.Fatalf("重算应冲正旧批（批 2）再记新批（批 3）: %+v", outcome)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 3000 {
		t.Fatalf("冲正后重扣应得 5000-2000=3000，得到 %d", got)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.cold); got != -500 {
		t.Fatalf("无记录成员应为 -500，得到 %d", got)
	}

	summary, err := repository.GetSummary(context.Background(), seed.match)
	if err != nil {
		t.Fatal(err)
	}
	if !summary.Settled || summary.BatchNo != 3 || summary.TotalAmountCents != 2500 {
		t.Fatalf("摘要应指向生效批次: %+v", summary)
	}
	if len(summary.History) != 3 || summary.History[0].OperationType != "settle" || summary.History[1].OperationType != "reverse" {
		t.Fatalf("历史应含 settle/reverse/settle 倒序: %+v", summary.History)
	}

	payerTransactions, err := repository.ListTransactions(context.Background(), seed.payer, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(payerTransactions) != 3 {
		t.Fatalf("应含 扣费+冲正+扣费 三条流水: %+v", payerTransactions)
	}
}

func TestGetSummaryEmptyWhenNeverSettled(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	summary, err := NewRepository(pool).GetSummary(context.Background(), seed.match)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Settled || len(summary.Items) != 0 || len(summary.History) != 0 {
		t.Fatalf("从未结算应为空摘要: %+v", summary)
	}
}

func TestListBalancesOnlyActiveMembership(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	balances, err := repository.ListBalances(context.Background(), seed.payer)
	if err != nil {
		t.Fatal(err)
	}
	if len(balances) != 1 || balances[0].TeamID != seed.teamID || balances[0].BalanceCents != 5000 {
		t.Fatalf("应返回活跃成员的余额: %+v", balances)
	}
}

func TestListTransactionsCursorPagination(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	if _, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "扣费", chargesFor(seed, 10, 0)); err != nil {
		t.Fatal(err)
	}

	first, err := repository.ListTransactions(context.Background(), seed.payer, 0, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 1 {
		t.Fatalf("limit 应生效: %+v", first)
	}
	second, err := repository.ListTransactions(context.Background(), seed.payer, first[0].ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("游标之后应无更多流水: %+v", second)
	}
}

func TestConcurrentSettleYieldsConflictForLoser(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 10000)
	repository := NewRepository(pool)

	results := make(chan error, 2)
	var start sync.WaitGroup
	start.Add(1)
	for index := 0; index < 2; index++ {
		go func() {
			start.Wait()
			_, err := repository.SettleInTransaction(context.Background(), seed.match, 1, "并发", chargesFor(seed, 100, 0))
			results <- err
		}()
	}
	start.Done()
	firstErr, secondErr := <-results, <-results
	successes, conflicts := 0, 0
	for _, err := range []error{firstErr, secondErr} {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, sharederror.ErrConflict):
			conflicts++
		default:
			t.Fatalf("并发结算不应产生其他错误: %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("应一胜一败（成功 %d，冲突 %d）", successes, conflicts)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 9900 {
		t.Fatalf("并发后余额应只被扣一次，得到 %d", got)
	}
}

func TestAdminCreditAppendsBalanceAndRecordsTransaction(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	result, err := repository.AdminCredit(context.Background(), teamfundports.AdminCredit{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2500, Note: "线下现金",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BalanceCents != 7500 {
		t.Fatalf("充值后余额应为 7500，得到 %d", result.BalanceCents)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 7500 {
		t.Fatalf("库内余额应为 7500，得到 %d", got)
	}
	transactions, err := repository.ListTransactions(context.Background(), seed.payer, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(transactions) != 1 || transactions[0].AmountCents != 2500 ||
		transactions[0].BalanceAfterCents != 7500 || transactions[0].Source != "admin_credit" {
		t.Fatalf("应记一条 admin_credit 流水: %+v", transactions)
	}
	if transactions[0].Description != "线下现金" || transactions[0].MatchID != nil {
		t.Fatalf("备注应透传且不关联比赛: %+v", transactions[0])
	}
}

func TestAdminCreditRejectsNonMember(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)

	_, err := repository.AdminCredit(context.Background(), teamfundports.AdminCredit{
		TeamID: seed.teamID, UserID: seed.cold, AmountCents: 800,
	})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("非队员充值应返回校验错误，得到 %v", err)
	}
	var count int
	if err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND user_id = $2`, seed.teamID, seed.cold,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("非队员充值不应创建 team_members 幽灵成员行")
	}
}

func TestAdminCreditRejectsInactiveMember(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', 'inactive')`,
		seed.teamID, seed.cold,
	); err != nil {
		t.Fatal(err)
	}

	_, err := repository.AdminCredit(context.Background(), teamfundports.AdminCredit{
		TeamID: seed.teamID, UserID: seed.cold, AmountCents: 800,
	})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("已退出成员充值应返回校验错误，得到 %v", err)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.cold); got != 0 {
		t.Fatalf("已退出成员余额不应变动，得到 %d", got)
	}
}

func TestAdminCreditRejectsNonPositiveAmount(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	_, err := repository.AdminCredit(context.Background(), teamfundports.AdminCredit{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 0,
	})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("金额 0 应返回校验错误，得到 %v", err)
	}
}

func TestMapConstraintErrorMapsForeignKeyViolation(t *testing.T) {
	err := mapConstraintError(&pgconn.PgError{Code: "23503", Message: "insert or update violates foreign key"})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("23503 外键错误应映射为校验错误，得到 %v", err)
	}
	if err := mapConstraintError(&pgconn.PgError{Code: "23505"}); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("23505 仍应映射为冲突，得到 %v", err)
	}
}
