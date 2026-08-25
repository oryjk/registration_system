# 队费记账（比赛算费扣款 + 站内通知）设计文档

日期：2026-08-23
状态：已实现；前后端闭环于 2026-08-25 验证通过（Go 集成测试 + race、小程序全量单测与 mp-weixin 构建），见提交 3d100a6 / 9135758

## 1. 背景与目标

Go 新后端目前只有「支付」（payment：充值/队费/报名费/打赏四种微信支付订单）没有「记账」：

- 队员交队费后，钱进入 `team_members.balance_cents`（队员×球队维度），只有进项、没有任何扣减路径。
- 比赛默认的 postpaid（赛后付）模式没有收款/记账流程。
- Go 后端没有通知模块，小程序通知页调用 `/notifications*` 全部 404。
- 小程序已有结算表单 UI（原调旧 Rust 后端 `/order/activities/:id/settlement`）和记账页（调 `/account/balance`、`/order/my-billing-flow`），接口均已失效。

本设计交付完整闭环：**队员交队费 → 参加比赛 → 赛后按名单算费扣款（记流水）→ 余额不足通知充值**。

## 2. 已确认的产品决策

| 决策点 | 结论 |
| --- | --- |
| 扣款账户 | 每人扣**自己所在球队**的队费余额（`team_members.balance_cents`）；散人（individual_opponent 组）不参与队费扣款 |
| 算费规则 | 默认按比赛 `fee_per_person_cents` × 出场名单预填，队长可微调每人金额（≥0，0 表示免付）；prepaid 已付报名费的出场者自动跳过 |
| 余额不足 | 允许扣成负数（欠款），下次交队费自动抵扣；扣款后余额 ≤0 的队员收站内通知 |
| 通知渠道 | 先做站内通知（新建 notification 模块，补齐小程序通知页接口）；微信订阅消息后续叠加 |
| 交付范围 | 前后端完整闭环：Go 后端 + 小程序（结算卡片、通知页、记账页） |
| 模块方案 | 新建 `internal/teamfund` 与 `internal/notification` 两个六边形模块，纯增量，不碰已上线支付核销路径 |

## 3. 架构

### 3.1 internal/teamfund（队费记账）

- `domain/`：结算领域规则——名单资格、金额校验、余额不足允许负数、批次与冲正语义。
- `application/`：
  - `SettleMatch`（提交结算；若已有生效批次则同事务冲正后重记）
  - `GetSettlement`（查询某场比赛结算摘要与历史）
  - `ListMyBalances`（我在各球队的队费余额）
  - `ListMyTransactions`（我的队费流水，分页）
- `ports/`：
  - `MatchRosterSource`：提供某场比赛的出场名单（user_id、所属球队、prepaid 已付标记）、比赛信息（状态、名称、人均费、主办队）——由 match 模块的 application 服务在 bootstrap 装配处实现。
  - `TeamAuthorizer`：校验操作者是主办队可管理比赛的人（复用 team 模块 `QueryService.EnsureManager`，即队长/领队；管理员放行）。
  - `NotificationSink`：发送站内通知，由 notification 模块实现。
  - `Repository`：结算批次、队费流水、`team_members` 余额扣减。
- `adapters/postgres`：sqlc 仓储实现。
- `adapters/http`：App 端路由。

跨模块依赖沿用 payment 模块既有模式（payment 的 ports 由 bootstrap 注入 team/match 服务），不产生模块间直接 import。

### 3.2 internal/notification（站内通知）

- `domain/`：Notification 聚合（ID、UserID、Kind、Title、Content、RelatedType/RelatedID、ReadAt、CreatedAt）。
- `application/`：`Create`、`List`（支持 unread_only、limit）、`UnreadCount`、`MarkAllRead`。
- `adapters/http`：三个接口路径与小程序 `src/api/notification.ts` 现有调用完全一致：
  - `GET /notifications`（query：`unread_only`、`limit`）
  - `GET /notifications/unread-count`
  - `POST /notifications/read-all`
- 对 teamfund 暴露 `NotificationSink` 端口实现。

## 4. 数据模型（新迁移，编号顺延 00020 起）

### 4.1 match_settlement_batches（比赛结算批次）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT PK | |
| match_id | UUID NOT NULL REFERENCES matches(id) | |
| batch_no | INT NOT NULL | 每场递增，UNIQUE(match_id, batch_no) |
| operation_type | VARCHAR(16) | `settle` / `reverse` |
| reversal_of_batch_id | BIGINT NULL REFERENCES 自身 | reverse 批指向被冲正的 settle 批 |
| reversed_by_batch_id | BIGINT NULL REFERENCES 自身 | settle 批被哪个 reverse 批冲正；NULL=生效中 |
| description | TEXT NOT NULL DEFAULT '' | |
| total_amount_cents | BIGINT NOT NULL | settle 批为正合计，reverse 批为对应负值 |
| user_count | INT NOT NULL | |
| created_by_user_id | BIGINT NOT NULL REFERENCES users(id) | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

约束：部分唯一索引 `UNIQUE(match_id) WHERE operation_type='settle' AND reversed_by_batch_id IS NULL`，保证每场至多一个生效批次，兜底并发。

### 4.2 team_fund_transactions（队费流水）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT PK | |
| team_id | BIGINT NOT NULL REFERENCES teams(id) | |
| user_id | BIGINT NOT NULL REFERENCES users(id) | |
| amount_cents | BIGINT NOT NULL | **带符号**：正=余额增加（队费充值、冲正回加），负=余额减少（比赛扣费） |
| balance_after_cents | BIGINT NOT NULL | 本笔落账后的余额 |
| source | VARCHAR(32) NOT NULL | `membership_payment` / `match_settlement` / `settlement_reversal` |
| source_id | VARCHAR(64) NOT NULL | membership: 支付订单号；settlement: 批次 id 字符串 |
| match_id | UUID NULL | 结算类流水关联比赛 |
| description | TEXT NOT NULL DEFAULT '' | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

约束：`UNIQUE(source, source_id, user_id)` 幂等；索引 `(user_id, created_at DESC)`、`(team_id, user_id, created_at DESC)`。

队费充值入账补流水：`ApplyMembershipPayment`（payment 模块仓储）在加 `team_members.balance_cents` 的同事务插入一条 `source=membership_payment` 流水。**历史已充值不回填流水**，从本功能上线起开始记录；余额本身仍是准确的。

### 4.3 notifications（站内通知）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT PK | |
| user_id | BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| kind | VARCHAR(64) NOT NULL | 首期：`teamfund_depleted`（余额不足/已欠款） |
| title | TEXT NOT NULL | |
| content | TEXT NOT NULL | |
| related_type | VARCHAR(32) NULL | 如 `match` |
| related_id | VARCHAR(64) NULL | 如比赛 UUID |
| read_at | TIMESTAMPTZ NULL | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

索引：`(user_id, created_at DESC)`、`(user_id) WHERE read_at IS NULL`。

## 5. 领域规则（结算流程）

1. **权限**：操作者须为主办队可管理比赛的成员（`EnsureManager`：队长/领队）或管理员。
2. **前置**：比赛状态为 `ended`；未结束/已取消不可结算。
3. **名单（可扣名单）**：`match_registrations` 中 `status='attending'` 的报名者，经其 `group_id` 关联：
   - `host_team` 组 → 扣主办队余额；`guest_team` 组 → 扣客队余额；
   - `individual_opponent` 组（散人）→ 排除，不参与队费扣款；
   - `paid=true`（prepaid 已付报名费）→ 排除，避免重复收费。
4. **金额**：请求须给出可扣名单全量 items（user_id → amount_cents）；每人默认预填 `fee_per_person_cents`，队长可改为 ≥0 的任意值（0=免付），至少一人 >0；items 的人员集合必须与可扣名单完全一致，不允许缺员或加人；总额 = Σ items，服务端校验。
5. **扣款**：逐人 `UPDATE team_members SET balance_cents = balance_cents - amount`；无成员记录的自动建行（余额 0 起扣，允许负数）；同事务写 `match_settlement_batches`（settle 批）+ 逐人 `team_fund_transactions`（负金额、记 balance_after）。
6. **余额不足**：不阻塞结算，扣成负数（欠款）；下次队费充值自然抵扣（余额直加）。**扣款后余额 ≤0 的队员**发站内通知：kind=`teamfund_depleted`，标题「队费余额不足」，内容含比赛名、本次扣款金额、当前余额（负数标注为欠款）。
7. **重复结算（重算）**：再次 POST 时若存在生效 settle 批：同事务内先插 reverse 批（逐人生成冲正流水全额回加余额、更新旧批 `reversed_by_batch_id`），再执行新 settle 批；批次历史全保留。冲正后重新结算导致余额仍 ≤0 的队员，再次发通知（同一场重复结算视为新事件）。
8. **并发**：结算事务内按 `(team_id, user_id)` 字典序 `FOR UPDATE` 锁相关 `team_members` 行；4.1 的部分唯一索引兜底同场并发提交（第二个事务提交时唯一冲突→报错重试由用户发起）。

## 6. API 设计（全部为新增路由，兼容性安全）

### App 端（/api/v1/app，需用户登录）

| 方法路径 | 说明 |
| --- | --- |
| `GET /matches/:match_id/settlement` | 结算摘要：当前生效批次（items 含 user_id、姓名、金额、扣后余额）+ 历史批次列表；需结算管理权限 |
| `POST /matches/:match_id/settlement` | body `{ items: [{user_id, amount_cents}], description? }`；执行结算（含冲正重算）；需结算管理权限 |
| `GET /team-fund/balances` | 我在各球队的余额：`[{team_id, team_name, balance_cents}]` |
| `GET /team-fund/transactions` | 我的队费流水（query：`limit`、`before_id` 游标分页）：`[{id, team_id, team_name, amount_cents, balance_after_cents, source, match_id, match_name?, description, created_at}]` |
| `GET /notifications`、`GET /notifications/unread-count`、`POST /notifications/read-all` | 通知模块；路径与小程序现有调用一致 |

响应统一 `ApiResponse<T>`；金额一律整数分（`*_cents`）。

### Admin 端

本次不新增管理端接口与页面（管理端查看结算另开任务）；保证不修改/破坏既有 admin 接口。

## 7. 小程序改造（registration_system_mini）

1. **`src/api/billing.ts` 重写**：删除死的 `/account/balance`、`/order/my-billing-flow`、`/order/activities/:id/settlement`；新增 `getTeamFundBalances`、`getTeamFundTransactions`。
2. **新增结算 API**（放 `src/api/match.ts` 或独立文件）：`getMatchSettlement`、`settleMatch`，对接第 6 节两个结算接口。
3. **`src/api/payment.ts` 路径修正（顺手修复）**：把仍指向旧 Rust 后端的单数路径改为 Go 实际路由——`/payment/recharge`→`/payments/recharge-orders`、`/payment/orders`→`/payments/orders`、`/payment/order/:orderNo`→`/payments/orders/:order_no`、`/payment/sync/:orderNo`→`/payments/orders/:order_no/sync`、`/payment/cancel`→`/payments/orders/:order_no/cancel`（按函数签名带 order_no）；`/payment/challenge-individual` 为无后端对应的死代码，一并清理其调用方。
4. **结算表单简化**：`TeamSettlementCard.vue`、`useMatchSettlement.ts`、`settlementState.ts` 从「总额 AA / 手动模式 + 自定义人员搜索」简化为「可扣名单固定 + 每人金额可编辑（默认人均费）」；保留批次历史展示；提交后刷新摘要。
5. **记账页 `pages/billing/index.vue` 改造**：顶部展示各球队队费余额，主体展示队费流水（充值/扣款/冲正），保留支付订单列表（路径修正后可用）。
6. **通知页**：后端补齐后即通；通知类型映射补充 `teamfund_depleted`。
7. **类型**：`src/types/backend.ts` 新增/调整对应 DTO 类型。

## 8. 兼容性说明

- 全部为新增路由、新增表、新增字段式变更；不删除/改名既有路由与字段，已发布小程序既有调用不受影响。
- `/notifications*`、队费流水等此前在小程序里一直 404 的调用将变为成功（允许的方向）。
- payment 模块 `ApplyMembershipPayment` 仅在原事务内**追加**一次流水插入，不改既有行为；异常路径行为不变。

## 9. 测试策略

- **Go（TDD）**：
  - teamfund domain 单测：名单资格（散人/已付排除）、金额校验（0 免付、至少一人>0、名单一致性）、负数余额、冲正语义。
  - postgres 仓储集成测试（testsupport 独立 schema）：扣款落账、balance_after 正确、充值补流水幂等（UNIQUE 冲突）、重复结算冲正+重记、并发唯一批次冲突。
  - router 测试：新路由鉴权（未登录/非管理成员/正常）、notification 三接口。
  - 提交前：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build ./cmd/api`。
- **小程序**：`bun run type-check`、`bun run build:mp-weixin`；结算相关既有测试更新（matchDetail 系）；不为本轮 UI 调整新增机械单测。

## 10. 明确不做（YAGNI）

- 微信订阅消息推送（后续叠加）。
- 管理端结算查看页面与接口。
- 个人钱包（wallet）的消费路径——队费与钱包是两套账户，本设计不动 wallet。
- 历史队费充值流水回填。
- 退款/提现；结算批次的人工冲正接口（重算式冲正已覆盖纠错场景）。
- 通知的逐条已读/删除（仅全量已读，与小程序现有 UI 一致）。
