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

func TestManualRechargeAppendsBalanceAndRecordsTransaction(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)

	result, err := repository.ManualRecharge(context.Background(), teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2500, Note: "线下现金",
		OperatorUserID: seed.cold, IdempotencyKey: "recharge-key-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BalanceCents != 7500 || result.Duplicated {
		t.Fatalf("充值后余额应为 7500，得到 %+v", result)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 7500 {
		t.Fatalf("库内余额应为 7500，得到 %d", got)
	}
	var isPaidMember bool
	var lastRechargeAt time.Time
	if err := pool.QueryRow(context.Background(), `SELECT is_paid_member, last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer).Scan(&isPaidMember, &lastRechargeAt); err != nil {
		t.Fatal(err)
	}
	if !isPaidMember || lastRechargeAt.IsZero() {
		t.Fatalf("人工充值应自动标记付费会员并记录充值时间: paid=%v last=%v", isPaidMember, lastRechargeAt)
	}
	transactions, err := repository.ListTransactions(context.Background(), seed.payer, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(transactions) != 1 || transactions[0].AmountCents != 2500 ||
		transactions[0].BalanceAfterCents != 7500 || transactions[0].Source != "admin_credit" {
		t.Fatalf("应记一条 admin_credit 流水: %+v", transactions)
	}
	if transactions[0].Description != "人工充值：线下现金" || transactions[0].MatchID != nil {
		t.Fatalf("备注应进入流水描述且不关联比赛: %+v", transactions[0])
	}
	if transactions[0].CreatedByUserID == nil || *transactions[0].CreatedByUserID != seed.cold {
		t.Fatalf("流水应记录操作人: %+v", transactions[0])
	}
}

func TestManualRechargeRejectsNonMember(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)

	_, err := repository.ManualRecharge(context.Background(), teamfundports.ManualFundAction{
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

func TestManualActionsRejectNonActiveMember(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	for _, status := range []string{"inactive", "removed"} {
		if _, err := pool.Exec(context.Background(),
			`INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1, $2, 'member', $3)
			 ON CONFLICT (team_id, user_id) DO UPDATE SET status = $3`,
			seed.teamID, seed.cold, status,
		); err != nil {
			t.Fatal(err)
		}

		_, err := repository.ManualRecharge(context.Background(), teamfundports.ManualFundAction{
			TeamID: seed.teamID, UserID: seed.cold, AmountCents: 800,
		})
		if !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("%s 成员充值应返回校验错误，得到 %v", status, err)
		}
		_, err = repository.ManualConsume(context.Background(), teamfundports.ManualFundAction{
			TeamID: seed.teamID, UserID: seed.cold, AmountCents: 800, Note: "n",
		})
		if !errors.Is(err, sharederror.ErrValidation) {
			t.Fatalf("%s 成员消费应返回校验错误，得到 %v", status, err)
		}
		if got := memberBalance(t, pool, seed.teamID, seed.cold); got != 0 {
			t.Fatalf("%s 成员余额不应变动，得到 %d", status, got)
		}
	}
}

func TestManualFundRejectsNonPositiveAmount(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	_, err := repository.ManualRecharge(context.Background(), teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 0,
	})
	if !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("金额 0 应返回校验错误，得到 %v", err)
	}
}

// 消费扣费只动余额：允许扣成负数（欠款），不得触碰付费会员标记与最近充值时间。
func TestManualConsumeDebitsWithoutMembershipSideEffects(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 300)
	repository := NewRepository(pool)

	result, err := repository.ManualConsume(context.Background(), teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 800, Note: "购买队服",
		OperatorUserID: seed.cold, IdempotencyKey: "consume-key-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BalanceCents != -500 {
		t.Fatalf("余额应扣成 -500（欠款），得到 %d", result.BalanceCents)
	}
	var isPaidMember bool
	var lastRechargeAt *time.Time
	if err := pool.QueryRow(context.Background(),
		`SELECT is_paid_member, last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`,
		seed.teamID, seed.payer).Scan(&isPaidMember, &lastRechargeAt); err != nil {
		t.Fatal(err)
	}
	if isPaidMember || lastRechargeAt != nil {
		t.Fatalf("消费不得伪造会员身份或充值时间: paid=%v last=%v", isPaidMember, lastRechargeAt)
	}
	transactions, err := repository.ListTransactions(context.Background(), seed.payer, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(transactions) != 1 || transactions[0].AmountCents != -800 ||
		transactions[0].BalanceAfterCents != -500 || transactions[0].Source != "manual_consume" {
		t.Fatalf("应记一条负向 manual_consume 流水: %+v", transactions)
	}
	if transactions[0].Description != "消费扣费：购买队服" {
		t.Fatalf("流水描述应含消费原因: %+v", transactions[0])
	}
}

// 同一幂等键同参数重试只记一笔；同键不同金额不能静默成功。
func TestManualFundIdempotencyKeyDeduplicates(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 1000)
	repository := NewRepository(pool)
	ctx := context.Background()
	action := teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2500,
		OperatorUserID: seed.cold, IdempotencyKey: "idem-recharge-1",
	}

	first, err := repository.ManualRecharge(ctx, action)
	if err != nil {
		t.Fatal(err)
	}
	replay, err := repository.ManualRecharge(ctx, action)
	if err != nil {
		t.Fatal(err)
	}
	if !replay.Duplicated || replay.TransactionID != first.TransactionID {
		t.Fatalf("同键重试应幂等命中: first=%+v replay=%+v", first, replay)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 3500 {
		t.Fatalf("幂等重试后余额应只加一次，得到 %d", got)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM team_fund_transactions WHERE source='admin_credit' AND source_id='idem-recharge-1'`,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("同键应只有一条流水，得到 %d", count)
	}

	conflicting := action
	conflicting.AmountCents = 9999
	if _, err := repository.ManualRecharge(ctx, conflicting); !errors.Is(err, teamfundports.ErrIdempotencyConflict) {
		t.Fatalf("同键不同金额应显式冲突，得到 %v", err)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 3500 {
		t.Fatalf("冲突请求不应改动余额，得到 %d", got)
	}
}

// 冲正：反向回加原金额、关联原流水、防止重复冲正与非人工流水冲正。
func TestManualReverseReversesManualTransaction(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 1000)
	repository := NewRepository(pool)
	ctx := context.Background()

	recharge, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2000, Note: "误记 200",
		OperatorUserID: seed.cold, IdempotencyKey: "rev-recharge-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	consume, err := repository.ManualConsume(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 300, Note: "误扣 3 元",
		OperatorUserID: seed.cold, IdempotencyKey: "rev-consume-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 2700 {
		t.Fatalf("充值+消费后余额应为 2700，得到 %d", got)
	}

	// 冲正充值：余额回退 2000，不得清除付费会员标记（冲正是回加而非充值）。
	reversed, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: recharge.TransactionID,
		Note: "金额记错", OperatorUserID: seed.cold, IdempotencyKey: "rev-key-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if reversed.BalanceCents != 700 {
		t.Fatalf("冲正后余额应为 700，得到 %d", reversed.BalanceCents)
	}
	var isPaidMember bool
	if err := pool.QueryRow(ctx,
		`SELECT is_paid_member FROM team_members WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer,
	).Scan(&isPaidMember); err != nil {
		t.Fatal(err)
	}
	if !isPaidMember {
		t.Fatal("冲正回加不应清除付费会员标记（会员身份由人工/实际充值授予，冲正只回滚金额）")
	}

	// 原流水被标记冲正；重复冲正被拒绝。
	var reversedBy *int64
	if err := pool.QueryRow(ctx,
		`SELECT reversed_by_transaction_id FROM team_fund_transactions WHERE id=$1`, recharge.TransactionID,
	).Scan(&reversedBy); err != nil {
		t.Fatal(err)
	}
	if reversedBy == nil || *reversedBy != reversed.TransactionID {
		t.Fatalf("原流水应关联冲正流水: %+v", reversedBy)
	}
	if _, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: recharge.TransactionID,
		Note: "再次冲正", IdempotencyKey: "rev-key-2",
	}); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("重复冲正应返回冲突，得到 %v", err)
	}

	// 冲正消费：扣回多扣的钱（负向回加）。
	if _, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: consume.TransactionID,
		Note: "误扣", OperatorUserID: seed.cold, IdempotencyKey: "rev-key-3",
	}); err != nil {
		t.Fatal(err)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 1000 {
		t.Fatalf("全部冲正后余额应回到 1000，得到 %d", got)
	}

	// 微信支付到账流水不允许人工冲正。
	var payTxID int64
	if err := pool.QueryRow(ctx, `
		INSERT INTO team_fund_transactions (team_id, user_id, amount_cents, balance_after_cents, source, source_id)
		VALUES ($1, $2, 100, 1000, 'membership_payment', 'pay-rev-1') RETURNING id`, seed.teamID, seed.payer,
	).Scan(&payTxID); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: payTxID,
		Note: "x", IdempotencyKey: "rev-key-4",
	}); !errors.Is(err, sharederror.ErrValidation) {
		t.Fatalf("membership_payment 人工冲正应被拒绝，得到 %v", err)
	}
}

// 并发人工动作：行锁保证余额串行累计，最终余额等于各动作之和。
func TestManualActionsConcurrentConsistency(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 0)
	repository := NewRepository(pool)
	ctx := context.Background()

	const workers = 6
	done := make(chan error, workers)
	for index := 0; index < workers; index++ {
		go func(index int) {
			if index%2 == 0 {
				done <- func() error {
					_, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
						TeamID: seed.teamID, UserID: seed.payer, AmountCents: 100,
						IdempotencyKey: fmt.Sprintf("conc-recharge-%d", index),
					})
					return err
				}()
			} else {
				done <- func() error {
					_, err := repository.ManualConsume(ctx, teamfundports.ManualFundAction{
						TeamID: seed.teamID, UserID: seed.payer, AmountCents: 50, Note: "并发消费",
						IdempotencyKey: fmt.Sprintf("conc-consume-%d", index),
					})
					return err
				}()
			}
		}(index)
	}
	for index := 0; index < workers; index++ {
		if err := <-done; err != nil {
			t.Fatalf("并发动作失败: %v", err)
		}
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 3*100-3*50 {
		t.Fatalf("并发后余额应等于动作之和 150，得到 %d", got)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM team_fund_transactions WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != workers {
		t.Fatalf("应有 %d 条流水，得到 %d", workers, count)
	}
}

// 已结束比赛的历史结算与重算可以处理非 active（removed）账户，但不得把成员恢复为 active。
func TestSettlementProcessesRemovedMemberWithoutReactivating(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 0)
	ctx := context.Background()
	// 把付费成员置为 removed：结算仍要能扣款，但不能顺手恢复成员身份。
	if _, err := pool.Exec(ctx,
		`UPDATE team_members SET status='removed', balance_cents=10000 WHERE team_id=$1 AND user_id=$2`,
		seed.teamID, seed.payer); err != nil {
		t.Fatal(err)
	}
	repository := NewRepository(pool)

	if _, err := repository.SettleInTransaction(ctx, seed.match, 1, "历史结算", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 3000},
	}); err != nil {
		t.Fatalf("settle removed member: %v", err)
	}

	var status string
	var balance int64
	if err := pool.QueryRow(ctx,
		`SELECT status, balance_cents FROM team_members WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer,
	).Scan(&status, &balance); err != nil {
		t.Fatal(err)
	}
	if status != "removed" {
		t.Fatalf("结算不得把 removed 成员恢复为 active: status=%s", status)
	}
	if balance != 7000 {
		t.Fatalf("removed 账户应正常扣款: balance=%d", balance)
	}

	// 重算（冲正回加 + 重新扣款）同样不恢复身份。
	if _, err := repository.SettleInTransaction(ctx, seed.match, 1, "重算", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 1000},
	}); err != nil {
		t.Fatalf("re-settle removed member: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`SELECT status, balance_cents FROM team_members WHERE team_id=$1 AND user_id=$2`, seed.teamID, seed.payer,
	).Scan(&status, &balance); err != nil {
		t.Fatal(err)
	}
	if status != "removed" || balance != 9000 {
		t.Fatalf("重算后应保持 removed 且余额正确: status=%s balance=%d", status, balance)
	}
}

// 操作人追溯：管理员身份写 created_by_admin_id（admin_users），普通用户身份写
// created_by_user_id（users）；两张表可存在相同数字 ID，各记各的列不混淆；
// 历史 NULL 记录保持双 NULL；幂等重试沿用首次成功流水的操作人不覆盖。
func TestManualFundOperatorRecording(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 100)
	repository := NewRepository(pool)
	ctx := context.Background()

	// 构造与普通用户 seed.cold 同数字 ID 的管理员，证明身份不会因 ID 相同混淆。
	sameIDAdmin := seed.cold
	if _, err := pool.Exec(ctx, `
		INSERT INTO admin_users (id, username, password_hash) OVERRIDING SYSTEM VALUE
		VALUES ($1, 'op-admin-same-id', 'x')`, sameIDAdmin); err != nil {
		t.Fatal(err)
	}

	type operatorRow struct {
		byUser  *int64
		byAdmin *int64
	}
	operatorOf := func(transactionID int64) operatorRow {
		var row operatorRow
		if err := pool.QueryRow(ctx,
			`SELECT created_by_user_id, created_by_admin_id FROM team_fund_transactions WHERE id=$1`,
			transactionID).Scan(&row.byUser, &row.byAdmin); err != nil {
			t.Fatal(err)
		}
		return row
	}

	// 管理员充值：写管理员列，用户列为 NULL（即便存在同 ID 的用户）。
	adminRecharge, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 500,
		OperatorAdminID: sameIDAdmin, IdempotencyKey: "operator-admin-recharge",
	})
	if err != nil {
		t.Fatal(err)
	}
	if row := operatorOf(adminRecharge.TransactionID); row.byAdmin == nil || *row.byAdmin != sameIDAdmin || row.byUser != nil {
		t.Fatalf("admin recharge operator mismatch: %+v", row)
	}

	// 普通用户消费：写用户列，管理员列为 NULL（即便存在同 ID 的管理员）。
	userConsume, err := repository.ManualConsume(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 100, Note: "队服",
		OperatorUserID: seed.cold, IdempotencyKey: "operator-user-consume",
	})
	if err != nil {
		t.Fatal(err)
	}
	if row := operatorOf(userConsume.TransactionID); row.byUser == nil || *row.byUser != seed.cold || row.byAdmin != nil {
		t.Fatalf("user consume operator mismatch: %+v", row)
	}

	// 管理员冲正：冲正流水同样记录管理员操作人。
	adminReverse, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: adminRecharge.TransactionID,
		Note: "记错", OperatorAdminID: sameIDAdmin, IdempotencyKey: "operator-admin-reverse",
	})
	if err != nil {
		t.Fatal(err)
	}
	if row := operatorOf(adminReverse.TransactionID); row.byAdmin == nil || *row.byAdmin != sameIDAdmin || row.byUser != nil {
		t.Fatalf("admin reverse operator mismatch: %+v", row)
	}

	// 普通用户冲正用户流水：同样按用户列记录。
	userReverse, err := repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: userConsume.TransactionID,
		Note: "误扣", OperatorUserID: seed.cold, IdempotencyKey: "operator-user-reverse",
	})
	if err != nil {
		t.Fatal(err)
	}
	if row := operatorOf(userReverse.TransactionID); row.byUser == nil || *row.byUser != seed.cold || row.byAdmin != nil {
		t.Fatalf("user reverse operator mismatch: %+v", row)
	}

	// 幂等重试不覆盖原操作人：管理员首充后，携带普通用户身份的同键重试命中重放，
	// 流水操作人仍是最初的管理员。
	replay, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 500,
		OperatorUserID: seed.cold, IdempotencyKey: "operator-admin-recharge",
	})
	if err != nil || !replay.Duplicated {
		t.Fatalf("same-key retry should replay: result=%+v err=%v", replay, err)
	}
	if row := operatorOf(adminRecharge.TransactionID); row.byAdmin == nil || *row.byAdmin != sameIDAdmin || row.byUser != nil {
		t.Fatalf("replay must keep the original operator: %+v", row)
	}

	// 历史 NULL 记录：操作人双空的流水在查询结果中保持双空，不错误归属。
	if _, err := pool.Exec(ctx, `
		INSERT INTO team_fund_transactions (team_id, user_id, amount_cents, balance_after_cents, source, source_id)
		VALUES ($1, $2, 100, 100, 'membership_payment', 'operator-history-null')`, seed.teamID, seed.payer); err != nil {
		t.Fatal(err)
	}
	transactions, err := repository.ListMemberTransactions(ctx, seed.teamID, seed.payer, 0, 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, transaction := range transactions {
		if transaction.Source != "membership_payment" {
			continue
		}
		if transaction.CreatedByUserID != nil || transaction.CreatedByAdminID != nil {
			t.Fatalf("historical NULL operator must stay NULL: %+v", transaction)
		}
	}
}

// 同键冲正重试：金额由原流水推导（请求不携带金额），重放必须幂等成功而非误判冲突。
func TestManualReverseIdempotentRetry(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 1000)
	repository := NewRepository(pool)
	ctx := context.Background()

	recharge, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2000,
		OperatorUserID: seed.cold, IdempotencyKey: "retry-recharge-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	action := teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: recharge.TransactionID,
		Note: "记错金额", OperatorUserID: seed.cold, IdempotencyKey: "retry-reverse-1",
	}
	first, err := repository.ManualReverse(ctx, action)
	if err != nil {
		t.Fatal(err)
	}
	replay, err := repository.ManualReverse(ctx, action)
	if err != nil {
		t.Fatalf("same-key reversal retry must replay idempotently: %v", err)
	}
	if !replay.Duplicated || replay.TransactionID != first.TransactionID || replay.BalanceCents != first.BalanceCents {
		t.Fatalf("reversal retry should hit replay: first=%+v replay=%+v", first, replay)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM team_fund_transactions WHERE source='manual_reversal' AND source_id='retry-reverse-1'`,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("same-key reversal must record once, got %d", count)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 1000 {
		t.Fatalf("balance after reversal should be 1000, got %d", got)
	}
}

// 同一用户在两队使用相同键+金额：B 队不能拿到 A 队的“重复成功”，必须显式冲突且不入账。
func TestManualFundCrossTeamSameKeyConflicts(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 0)
	repository := NewRepository(pool)
	ctx := context.Background()

	var teamB int64
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('跨队幂等测试队 B') RETURNING id`).Scan(&teamB); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO team_members (team_id, user_id, role, status, balance_cents) VALUES ($1, $2, 'member', 'active', 0)`,
		teamB, seed.payer); err != nil {
		t.Fatal(err)
	}

	if _, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 1500,
		OperatorUserID: seed.cold, IdempotencyKey: "cross-team-key",
	}); err != nil {
		t.Fatal(err)
	}
	_, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: teamB, UserID: seed.payer, AmountCents: 1500,
		OperatorUserID: seed.cold, IdempotencyKey: "cross-team-key",
	})
	if !errors.Is(err, teamfundports.ErrIdempotencyConflict) {
		t.Fatalf("cross-team same key must conflict explicitly, got %v", err)
	}
	if got := memberBalance(t, pool, teamB, seed.payer); got != 0 {
		t.Fatalf("team B must not be credited, got %d", got)
	}
}

// 并发同键：一请求成功、另一请求按幂等重放成功（不在已中止事务里继续查询，避免 25P02）。
func TestManualFundConcurrentSameKeyReplays(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 0)
	repository := NewRepository(pool)
	ctx := context.Background()
	action := teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 800,
		OperatorUserID: seed.cold, IdempotencyKey: "concurrent-same-key",
	}

	results := make([]teamfundports.ManualFundResult, 2)
	errs := make([]error, 2)
	done := make(chan struct{})
	go func() {
		results[0], errs[0] = repository.ManualRecharge(ctx, action)
		done <- struct{}{}
	}()
	go func() {
		results[1], errs[1] = repository.ManualRecharge(ctx, action)
		done <- struct{}{}
	}()
	<-done
	<-done

	for index, err := range errs {
		if err != nil {
			t.Fatalf("concurrent request %d must not error: %v", index, err)
		}
	}
	duplicated := 0
	for _, result := range results {
		if result.Duplicated {
			duplicated++
		}
	}
	if duplicated != 1 {
		t.Fatalf("exactly one request should replay, got %d: %+v", duplicated, results)
	}
	if results[0].TransactionID != results[1].TransactionID {
		t.Fatalf("both requests should point at the same transaction: %+v", results)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 800 {
		t.Fatalf("concurrent same key must credit once, got %d", got)
	}
}

// 并发同键冲正：两个请求都通过预检后在原流水锁上竞争，先到者提交、后到者必须
// 按同键重放成功（而不是误报“该流水已冲正”冲突）；不同键的重复冲正仍被拒绝。
func TestManualReverseConcurrentSameKeyReplays(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 1000)
	repository := NewRepository(pool)
	ctx := context.Background()

	recharge, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2000,
		OperatorUserID: seed.cold, IdempotencyKey: "conc-rev-recharge-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	action := teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: recharge.TransactionID,
		Note: "记错", OperatorUserID: seed.cold, IdempotencyKey: "conc-rev-key",
	}

	results := make([]teamfundports.ManualFundResult, 2)
	errs := make([]error, 2)
	done := make(chan struct{})
	go func() {
		results[0], errs[0] = repository.ManualReverse(ctx, action)
		done <- struct{}{}
	}()
	go func() {
		results[1], errs[1] = repository.ManualReverse(ctx, action)
		done <- struct{}{}
	}()
	<-done
	<-done

	for index, err := range errs {
		if err != nil {
			t.Fatalf("concurrent same-key reversal %d must not error: %v", index, err)
		}
	}
	duplicated := 0
	for _, result := range results {
		if result.Duplicated {
			duplicated++
		}
	}
	if duplicated != 1 {
		t.Fatalf("exactly one reversal should replay, got %d: %+v", duplicated, results)
	}
	if results[0].TransactionID != results[1].TransactionID {
		t.Fatalf("both requests should point at the same reversal transaction: %+v", results)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 1000 {
		t.Fatalf("concurrent same-key reversal must apply once, balance got %d", got)
	}
	var count int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM team_fund_transactions WHERE source='manual_reversal' AND source_id='conc-rev-key'`,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("same-key reversal must record once, got %d", count)
	}

	// 不同键的重复冲正仍被显式拒绝。
	_, err = repository.ManualReverse(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, OriginalTransactionID: recharge.TransactionID,
		Note: "再次冲正", OperatorUserID: seed.cold, IdempotencyKey: "conc-rev-key-other",
	})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("different-key duplicate reversal must conflict, got %v", err)
	}
}

// 结算冲正回加不得伪造充值时间或自动升级会员（仅回滚金额）。
func TestSettlementReversalDoesNotFakeRecharge(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)
	ctx := context.Background()

	first, err := repository.SettleInTransaction(ctx, seed.match, 1, "首轮结算", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2000},
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.ReversedBatchNo != 0 {
		t.Fatalf("首轮结算不应有冲正: %+v", first)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 3000 {
		t.Fatalf("结算后余额应为 3000，得到 %d", got)
	}

	// 重算：先冲正回加 2000 再按新金额扣 500。
	second, err := repository.SettleInTransaction(ctx, seed.match, 1, "重算", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 500},
	})
	if err != nil {
		t.Fatal(err)
	}
	if second.ReversedBatchNo == 0 {
		t.Fatalf("重算应产生冲正批次: %+v", second)
	}
	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 4500 {
		t.Fatalf("重算后余额应为 4500，得到 %d", got)
	}

	var isPaidMember bool
	var lastRechargeAt *time.Time
	if err := pool.QueryRow(ctx,
		`SELECT is_paid_member, last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`,
		seed.teamID, seed.payer).Scan(&isPaidMember, &lastRechargeAt); err != nil {
		t.Fatal(err)
	}
	if isPaidMember || lastRechargeAt != nil {
		t.Fatalf("结算冲正回加不得标记付费会员或充值时间: paid=%v last=%v", isPaidMember, lastRechargeAt)
	}

	// 冲正 + 重新扣费后的流水完整：两条结算扣款、一条冲正回加，金额与余额快照正确。
	type ledgerRow struct {
		amount, balanceAfter int64
		source               string
	}
	rows, err := pool.Query(ctx,
		`SELECT amount_cents, balance_after_cents, source FROM team_fund_transactions
		 WHERE team_id=$1 AND user_id=$2 ORDER BY id`, seed.teamID, seed.payer)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	ledger := []ledgerRow{}
	for rows.Next() {
		var row ledgerRow
		if err := rows.Scan(&row.amount, &row.balanceAfter, &row.source); err != nil {
			t.Fatal(err)
		}
		ledger = append(ledger, row)
	}
	expected := []ledgerRow{
		{amount: -2000, balanceAfter: 3000, source: "match_settlement"},
		{amount: 2000, balanceAfter: 5000, source: "settlement_reversal"},
		{amount: -500, balanceAfter: 4500, source: "match_settlement"},
	}
	if len(ledger) != len(expected) {
		t.Fatalf("重算后应有 %d 条流水，得到 %d: %+v", len(expected), len(ledger), ledger)
	}
	for index, want := range expected {
		if ledger[index] != want {
			t.Fatalf("流水第 %d 条不符: want %+v got %+v", index, want, ledger[index])
		}
	}
}

// 已充值会员重算后：会员身份保持，真实充值时间原样保留（不被冲正回加刷新为 NOW）。
func TestSettlementRecalcKeepsRechargedMembershipIntact(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 0)
	repository := NewRepository(pool)
	ctx := context.Background()

	// 真实充值：入账并自动标记会员 + 记录充值时间。
	if _, err := repository.ManualRecharge(ctx, teamfundports.ManualFundAction{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 3000, Note: "线下现金",
		OperatorUserID: seed.cold, IdempotencyKey: "recalc-recharge-1",
	}); err != nil {
		t.Fatal(err)
	}
	var paidBefore bool
	var rechargeBefore *time.Time
	if err := pool.QueryRow(ctx,
		`SELECT is_paid_member, last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`,
		seed.teamID, seed.payer).Scan(&paidBefore, &rechargeBefore); err != nil {
		t.Fatal(err)
	}
	if !paidBefore || rechargeBefore == nil {
		t.Fatalf("充值后应为付费会员且有充值时间: paid=%v last=%v", paidBefore, rechargeBefore)
	}

	// 结算扣 1200，再重算改为扣 700。
	if _, err := repository.SettleInTransaction(ctx, seed.match, 1, "首轮", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 1200},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.SettleInTransaction(ctx, seed.match, 1, "重算", []teamfundports.SettlementCharge{
		{TeamID: seed.teamID, UserID: seed.payer, AmountCents: 700},
	}); err != nil {
		t.Fatal(err)
	}

	if got := memberBalance(t, pool, seed.teamID, seed.payer); got != 2300 {
		t.Fatalf("充值+重算后余额应为 2300，得到 %d", got)
	}
	var paidAfter bool
	var rechargeAfter *time.Time
	if err := pool.QueryRow(ctx,
		`SELECT is_paid_member, last_recharge_at FROM team_members WHERE team_id=$1 AND user_id=$2`,
		seed.teamID, seed.payer).Scan(&paidAfter, &rechargeAfter); err != nil {
		t.Fatal(err)
	}
	if !paidAfter {
		t.Fatal("重算不得清除付费会员身份")
	}
	if rechargeAfter == nil || !rechargeAfter.Equal(*rechargeBefore) {
		t.Fatalf("重算不得改写真实充值时间: before=%v after=%v", rechargeBefore, rechargeAfter)
	}

	// 流水顺序与金额：充值 +3000、结算 -1200、冲正 +1200、再结算 -700。
	var amounts []int64
	var sources []string
	rows, err := pool.Query(ctx,
		`SELECT amount_cents, source FROM team_fund_transactions WHERE team_id=$1 AND user_id=$2 ORDER BY id`,
		seed.teamID, seed.payer)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var amount int64
		var source string
		if err := rows.Scan(&amount, &source); err != nil {
			t.Fatal(err)
		}
		amounts = append(amounts, amount)
		sources = append(sources, source)
	}
	wantAmounts := []int64{3000, -1200, 1200, -700}
	wantSources := []string{"admin_credit", "match_settlement", "settlement_reversal", "match_settlement"}
	if len(amounts) != len(wantAmounts) {
		t.Fatalf("流水条数不符: want %+v got %+v", wantAmounts, amounts)
	}
	for index := range wantAmounts {
		if amounts[index] != wantAmounts[index] || sources[index] != wantSources[index] {
			t.Fatalf("流水第 %d 条不符: want (%d,%s) got (%d,%s)",
				index, wantAmounts[index], wantSources[index], amounts[index], sources[index])
		}
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
