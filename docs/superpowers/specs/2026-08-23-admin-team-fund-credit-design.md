# 管理员手动充值队费 设计文档

日期：2026-08-23
状态：已实现；含一处经用户授权的增量（见「变更记录」）

## 变更记录

- 2026-08-23：初版设计，通知「不发送」。
- 2026-08-23：评审反馈两处加固：①管理端 submitCredit 入口加同步防重入守卫（confirmLoading 渲染前的双击窗口会重入，产生重复充值流水）；②单笔充值上限 ¥10,000 前后端双重校验（防手滑多零，超上限请拆分多笔）。
- 2026-08-23：用户指示「后面都按照你的推荐来，直到实现完成」后，按推荐补做**充值到账通知**（`teamfund_credited`）：充值成功后向队员发站内通知，内容含充值金额、当前余额、备注（若有）；best-effort，发送失败仅记日志不影响充值。本文档 §2/§5/§7/§8 已同步更新。
- 2026-08-23：评审修复：`AdminCredit` 不再对非队员自动建行（幽灵成员），改为校验 `status='active'` 正式成员身份并 `FOR UPDATE` 锁定成员行；FK 23503 错误映射为校验错误兜底竞态。本文档 §3/§7 已同步更新。

## 1. 背景与目标

队费记账闭环（交队费 → 比赛扣款 → 余额不足通知）已上线，但入账只有微信支付队费一条路。
现实中存在线下收款（现金/转账）场景：管理员需要在后台给某队员的队费余额**手动追加**一个金额，
不涉及任何真实支付，只是一条充值类型的记账流水。

## 2. 已确认 / 默认的决策

| 决策点 | 结论 |
| --- | --- |
| 充值账户 | 队费余额 `team_members.balance_cents`（队员×球队维度），与结算扣款同账本 |
| 金额语义 | 只追加（0 < amount_cents ≤ 1,000,000，即单笔上限 ¥10,000，前后端双重校验），不支持设为负数；备注可选 |
| 支付 | 无。纯记账，不创建 payment_orders |
| 入口 | 管理端球队成员管理（TeamMemberManager）每行「充值」操作 |
| 幂等 | 不需要（每次提交都是一条新流水，管理员可信，金额错误可再充或走结算冲正） |
| 通知 | **发送**：充值成功后向队员发 `teamfund_credited` 站内通知（见变更记录） |

## 3. Go 后端

1. 迁移 `00022_team_fund_admin_credit.sql`：`team_fund_transactions.source` CHECK 增加 `'admin_credit'`。
2. `internal/teamfund`：
   - `ports.Repository` 新增 `AdminCredit(ctx, credit AdminCredit) (AdminCreditResult, error)`：
     单事务内 `GetActiveTeamMemberForCredit`（校验目标为 `status='active'` 的正式成员并 `FOR UPDATE`
     锁定该行；非正式成员返回校验错误，**不自动建行**）→ `CreditTeamMemberFund(+amount)` →
     插入流水（source=`admin_credit`，source_id=新生成 UUID 字符串，
     description=备注或「后台充值」）。返回新余额与流水 id。
     外键 23503（成员校验后 team/user 被并发删除的竞态）映射为校验错误兜底。
   - `application`：`Credit(ctx, actor, request)` 校验 `actor.IsAdmin()`、amount_cents > 0、
     team/user 必须存在（由 FK 兜底，仓储错误映射）；充值成功后经 NotificationSink 发送
     `teamfund_credited` 通知（best-effort，失败仅记日志）。
   - `adapters/http`：`RegisterAdminRoutes` 新增 `POST /team-fund/credits`，
     body `{team_id, user_id, amount_cents, note?}`，响应 `{balance_cents, transaction_id}`。
3. team 模块 `ListTeamMembers`（admin 用）查询与 DTO 追加 `balance_cents`（纯增量，旧客户端无感知）。

## 4. 管理端（registration_system_backend_fe_go）

- `src/api/teamFund.ts` 新建：`adminCreditTeamFund(payload)` 调上述接口。
- `src/types/team.ts` 的 `TeamMember` 增加 `balance_cents: number`。
- `TeamMemberManager` 组件：成员表格新增「队费余额」列（分转元，负数红色标「欠款」）；
  操作列新增「充值」，弹窗输入金额（元）与备注，成功后刷新成员列表并提示新余额。

## 5. 小程序（registration_system_mini）

- `types/backend.ts` 的 `BackendTeamFundTransaction.source` 联合类型加 `"admin_credit"`。
- `utils/viewModels/finance.ts` 的 `teamFundSourceLabel` 加 case：`admin_credit` → 「后台充值」。
  记账页流水自动展示。
- `utils/viewModels/notifications.ts` 的通知标签加 case：`teamfund_credited` → 「队费充值到账」，
  消息中心展示到账通知。

## 6. 兼容性

全部为新增路由、新增枚举值、DTO 追加字段；不删除不改名既有内容，已发布小程序与管理端不受影响。

## 7. 测试

- Go：teamfund 仓储集成测试（credit 追加余额、流水正确、非队员/已退出成员充值拒绝且不建行）；application 校验测试
  （非 admin 拒绝、金额 ≤0 拒绝、到账通知内容与失败忽略）；router 测试（新路由 admin 鉴权）。
- 管理端：`bun run type-check`、`bun run lint`、`bun run test`。
- 小程序：`bun run type-check` + `bun test`。

## 8. 明确不做（YAGNI）

真实支付；负数/扣减调整；非队员任意建账的搜索式充值入口；管理员查看队员流水列表（后续可加）。
