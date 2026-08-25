# 管理员手动充值队费 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理员在管理端给队员的队费余额手动追加金额（纯记账，无支付），流水来源 `admin_credit`。

**Architecture:** Go teamfund 模块加 `AdminCredit` 用例（单事务：ensure 行→锁→加钱→记流水），挂到 `/api/admin/team-fund/credits`；team 模块 admin 成员列表 DTO 追加 `balance_cents`；管理端 TeamMemberManager 加余额列与充值弹窗；小程序加流水来源标签。

**Tech Stack:** Go + Gin + pgx + sqlc + goose；React + Ant Design（UmiJS max）；uni-app Vue3。

## Global Constraints

- 兼容性：只新增路由/枚举值/追加 DTO 字段，不删改既有内容。
- 金额一律整数分；`team_fund_transactions.amount_cents` 正=入账。
- Go module 前缀 `github.com/oryjk/registration_system/registration_system_go`（下文 `<go>`）。
- 提交前：`cd <go> && gofmt -w . && go vet ./... && go test -race ./... && go build -o /tmp/registration-system-go-api ./cmd/api`；管理端 `bun run type-check && bun run lint && bun run test`；小程序 `bun run type-check && bun test`。
- 工作区有用户未提交改动：**各任务不做 git commit**，除非用户明确要求。
- sqlc 生成：`cd <go> && make generate`。
- 集成测试需 `TEST_DATABASE_URL`；本机未配置时用例 SKIP，最终汇报需注明。

---

### Task 1: 迁移 + sqlc 查询（admin_credit）

**Files:**
- Create: `<go>/db/migrations/00022_team_fund_admin_credit.sql`
- Modify: `<go>/db/queries/teamfund.sql`（追加）

**Interfaces:**
- Produces: source 枚举含 `admin_credit`；新查询 `InsertAdminCreditFundTransaction`。

- [ ] **Step 1: 迁移**

```sql
-- +goose Up
-- 管理员手动充值队费：线下收款入账，无支付订单。
ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal', 'admin_credit')
    );

-- +goose Down
ALTER TABLE team_fund_transactions
    DROP CONSTRAINT team_fund_transactions_source_check,
    ADD CONSTRAINT team_fund_transactions_source_check CHECK (
        source IN ('membership_payment', 'match_settlement', 'settlement_reversal')
    );
```

- [ ] **Step 2: teamfund.sql 追加**

```sql
-- name: InsertAdminCreditFundTransaction :one
-- 管理员手动充值流水；source_id 为本次操作生成的 UUID 字符串。
INSERT INTO team_fund_transactions
    (team_id, user_id, amount_cents, balance_after_cents, source, source_id, match_id, description)
VALUES (sqlc.arg('team_id'), sqlc.arg('user_id'), sqlc.arg('amount_cents'),
        sqlc.arg('balance_after_cents'), 'admin_credit', sqlc.arg('source_id'), NULL, sqlc.arg('description'))
RETURNING id;
```

- [ ] **Step 3: `make generate`**，确认生成 `InsertAdminCreditFundTransaction`。

---

### Task 2: teamfund AdminCredit（仓储 + 应用 + admin 路由，TDD）

**Files:**
- Modify: `<go>/internal/teamfund/ports/repository.go`（接口 + 类型）
- Modify: `<go>/internal/teamfund/adapters/postgres/repository.go`
- Modify: `<go>/internal/teamfund/adapters/postgres/repository_test.go`
- Create: `<go>/internal/teamfund/application/admin_credit_service.go`
- Create: `<go>/internal/teamfund/application/admin_credit_service_test.go`
- Modify: `<go>/internal/teamfund/adapters/http/handler.go`（admin 路由）
- Modify: `<go>/internal/bootstrap/router.go`（admin 组注册）、`router_test.go`

**Interfaces:**
- Produces:
```go
// ports
type AdminCredit struct { TeamID, UserID, AmountCents int64; Note string }
type AdminCreditResult struct { BalanceCents int64; TransactionID int64 }
// Repository 接口追加
AdminCredit(ctx context.Context, credit AdminCredit) (AdminCreditResult, error)
// application
func NewAdminCreditService(repository teamfundports.Repository) *AdminCreditService
func (s *AdminCreditService) Credit(ctx context.Context, actor sharedauth.Actor, request AdminCreditRequest) (teamfundports.AdminCreditResult, error)
type AdminCreditRequest struct { TeamID, UserID, AmountCents int64; Note string }
// http：admin 路由 POST /team-fund/credits
```

- [ ] **Step 1: 仓储集成测试（先写）**

```go
func TestAdminCreditAppendsBalanceAndRecordsTransaction(t *testing.T) {
	pool := testsupport.OpenTestPostgres(t)
	seed := seedSettlement(t, pool, 5000)
	repository := NewRepository(pool)
	result, err := repository.AdminCredit(context.Background(), teamfundports.AdminCredit{
		TeamID: seed.teamID, UserID: seed.payer, AmountCents: 2500, Note: "线下现金",
	})
	// 断言：err==nil；余额 7500（5000+2500）；流水一条 amount=+2500、source=admin_credit、balance_after=7500、description="线下现金"
}
func TestAdminCreditCreatesRowForMissingMember(t *testing.T) {
	// 无成员记录的 user：充值后 team_members 出现该行且余额=充值额
}
func TestAdminCreditRejectsNonPositiveAmount(t *testing.T) {
	// AmountCents=0 → sharederror.ErrValidation
}
```

- [ ] **Step 2: 实现**

仓储（单事务，复用既有 Ensure/Lock/Credit 查询 + Task 1 插入）：
```go
func (r *Repository) AdminCredit(ctx context.Context, credit teamfundports.AdminCredit) (teamfundports.AdminCreditResult, error) {
	if credit.AmountCents <= 0 {
		return teamfundports.AdminCreditResult{}, sharederror.New(sharederror.KindValidation, "充值金额需要大于 0")
	}
	tx, err := r.database.Begin(ctx)
	if err != nil { return teamfundports.AdminCreditResult{}, err }
	defer func() { _ = tx.Rollback(ctx) }()
	queries := r.queries.WithTx(tx)
	if _, err := queries.EnsureTeamMemberFundRow(ctx, ...{credit.TeamID, credit.UserID}); err != nil { return ..., err }
	if _, err := queries.LockTeamMemberFund(ctx, ...); err != nil { return ..., err }
	balance, err := queries.CreditTeamMemberFund(ctx, ...{credit.AmountCents, credit.TeamID, credit.UserID})
	if err != nil { return ..., err }
	description := strings.TrimSpace(credit.Note)
	if description == "" { description = "后台充值" }
	transactionID, err := queries.InsertAdminCreditFundTransaction(ctx, ...{
		TeamID: credit.TeamID, UserID: credit.UserID, AmountCents: credit.AmountCents,
		BalanceAfterCents: balance, SourceID: uuid.NewString(), Description: description,
	})
	if err != nil { return ..., mapConstraintError(err) }
	if err := tx.Commit(ctx); err != nil { return ..., err }
	return teamfundports.AdminCreditResult{BalanceCents: balance, TransactionID: transactionID}, nil
}
```

应用层：`Credit` 校验 `actor.IsAdmin()`（否则 Forbidden）、复用仓储的金额校验。

- [ ] **Step 3: HTTP + 装配**：handler 加
```go
type adminCreditRequest struct {
	TeamID int64 `json:"team_id"`
	UserID int64 `json:"user_id"`
	AmountCents int64 `json:"amount_cents"`
	Note string `json:"note"`
}
func (h *Handler) RegisterAdminRoutes(group *gin.RouterGroup) {
	group.POST("/team-fund/credits", h.AdminCredit)
}
// 响应 {balance_cents, transaction_id}
```
router.go admin 组注册 `dependencies.TeamFunds.RegisterAdminRoutes(adminRoutes)`；构造注入 `NewAdminCreditService(teamFundRepository)`（Handler 增加第二个 service 字段或接口方法）。
router_test.go：admin token POST 200 / 无 token 401（fake 实现接口方法）。

- [ ] **Step 4: 验证** — `go test ./internal/teamfund/... ./internal/bootstrap/`

---

### Task 3: 成员列表返回余额（team 模块）

**Files:**
- Modify: `<go>/db/queries/team.sql:136`（ListTeamMembers 加 `tm.balance_cents`）
- Modify: `<go>/internal/team/adapters/postgres/`（映射，admin 成员行结构加 BalanceCents）
- Modify: 对应 admin DTO/handler（若成员行类型在 ports/application 定义则同步）

**Interfaces:**
- Produces: admin/app 成员详情数据结构含 `balance_cents` 字段（JSON `balance_cents`）。

- [ ] 实现 + 既有测试回归（`go test ./internal/team/...`）。注意该查询同时服务 app 端成员接口的话，JSON 追加字段同样纯增量。

---

### Task 4: 管理端页面（余额列 + 充值弹窗）

**Files:**
- Create: `registration_system_backend_fe_go/src/api/teamFund.ts`
- Modify: `src/types/team.ts`（TeamMember 加 `balance_cents: number`）
- Modify: `src/components/TeamMemberManager.tsx`

- [ ] api：
```ts
import { request } from "./client";
export interface AdminCreditTeamFundPayload { team_id: number; user_id: number; amount_cents: number; note?: string }
export function adminCreditTeamFund(payload: AdminCreditTeamFundPayload) {
  return request<{ balance_cents: number; transaction_id: number }>("/team-fund/credits", {
    method: "POST", body: JSON.stringify(payload),
  });
}
```
- [ ] TeamMemberManager：表格加「队费余额」列（`(balance_cents/100).toFixed(2)`，负数红色 Tag「欠款」）；操作加「充值」→ Modal（InputNumber 元、TextArea 备注）→ `adminCreditTeamFund({team_id, user_id, amount_cents: Math.round(yuan*100), note})` → 成功 `message.success("已充值，新余额 ¥xx.xx")` 并刷新成员列表。
- [ ] 验证：`bun run type-check && bun run lint && bun run test`。

---

### Task 5: 小程序流水标签

**Files:**
- Modify: `registration_system_mini/src/types/backend.ts`（source 联合类型加 `"admin_credit"`）
- Modify: `src/utils/viewModels/finance.ts`（`teamFundSourceLabel` 加 case → "后台充值"）

- [ ] 验证：`bun run type-check && bun test`。

---

### Task 6: 全量验证

- [ ] Go：`gofmt -w . && go vet ./... && go test -race ./... && go build -o /tmp/registration-system-go-api ./cmd/api`
- [ ] 管理端：`bun run type-check && bun run lint && bun run test`
- [ ] 小程序：`bun run type-check && bun test`
- [ ] 汇报（含集成测试 SKIP 说明）。

## Self-Review 记录

- 规格覆盖：§3.1 迁移→Task 1；§3.2 用例/路由→Task 2；§3.3 成员余额→Task 3；§4 管理端→Task 4；§5 小程序→Task 5；§7 测试分散在各任务+Task 6。✓
- 类型一致：AdminCredit/AdminCreditResult 在 Task 2 定义并被 HTTP/管理端（balance_cents）对齐；`balance_cents` 命名前后端一致。✓

## 增量说明（执行后补充）

- 经用户授权（「后面都按照你的推荐来，直到实现完成」），在 Task 2 完成后追加**充值到账通知**：
  `AdminCreditService.Credit` 成功后经 NotificationSink 发送 `teamfund_credited` 站内通知
  （内容含金额、当前余额、备注；best-effort），bootstrap 注入 notification 服务，
  小程序通知标签同步。设计与测试细节见设计文档「变更记录」。本节为事后补记，原任务结构未改动。
