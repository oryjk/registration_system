# 后端六边形重构计划

## 目标

把 `team` 模块已经采用的形态推广到其他后端模块：应用层按高内聚 use case 拆分，读写职责尽量分离，`Service` 只作为兼容 facade，handler/API 行为保持稳定。

## 执行原则

- 每次只处理一个模块或一个明确切片。
- 不改接口字段、路由、错误语义，除非发现现有行为本身是 bug。
- 先拆应用层，再视需要拆 ports/persistence 读写接口。
- 每个阶段完成后运行至少 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、相关测试；关键阶段跑 `cargo test`。
- 不回退当前工作区已有的其他改动。

## 模块优先级

1. `challenge`：中等大小，和 `team` 读仓储已有交叉，适合作为 team 后的第一块。
2. `billing` / `payment`：支付和账单耦合，需要小步拆，优先保持业务稳定。
3. `user`：查询、管理、作用域逻辑可拆成 read/manage use case。
4. `system` / `auth` / `notification` / `wx`：体量较小，按 facade/use case 结构整理。
5. `activity`：最大模块，最后拆，先按创建、更新、报名、签到、查询等纵向切片推进。

## 当前阶段

- [x] `team`：读写仓储拆分、核心 use case、权限检查器、读侧 use case 完成。
- [x] `challenge`：拆分 commands/queries/use_cases，Service 变为 facade。
- [x] `challenge`：拆 `ChallengeQueryRepository` / `ChallengeCommandRepository`。
- [x] `billing`：拆分 commands/read_models/use_cases，Service 变为 facade。
- [x] `billing`：拆 `BillingQueryRepository` / `BillingCommandRepository`。
- [x] `payment`：拆分 commands/read_models/use_cases，Service 变为 facade。
- [x] `payment`：拆 `PaymentOrderQueryRepository` / `PaymentOrderCommandRepository`。
- [x] `user`：拆分 login/profile/query/manage player use case，Service 变为 facade。
- [x] `user`：拆 `UserQueryRepository` / `UserCommandRepository`，同步 payment openid resolver。
- [x] `system`：拆分 map settings / mini app runtime config use case，Service 变为 facade。
- [x] `system`：拆 `SystemSettingsQueryRepository` / `SystemSettingsCommandRepository`，同步 activity 地图网关只依赖读侧。
- [x] `wx`：拆分登录、access token、手机号 use case，Service 变为 facade。
- [x] `auth`：拆分登录、校验管理员、管理员管理 use case，Service 变为 facade。
- [x] `auth`：拆 `AdminUserQueryRepository` / `AdminUserCommandRepository`。
- [x] `notification`：拆分发送通知、查询/标记通知 use case，Service 变为 facade。
- [x] `notification`：拆 `NotificationQueryRepository` / `NotificationCommandRepository`。
- [ ] 后续：进入 `activity` 前先按切片制定拆分方案，避免全量重写。
- [x] 球队 ID 数字化迁移：`rs_teams.id` 与球队引用列已切换为 `BIGINT`，后端类型同步为 `i64`。

## 验收

- 后端完整测试通过。
- 新增 use case 文件职责清楚，handler 不直接依赖 persistence。
- `Service` 文件行数明显下降，业务分支迁移到具体 use case。

## 2026-05-13 后端协作文档规范同步

目标：让后端相关新对话在读取子项目文档时，也能看到“复杂任务默认维护工作文档”的要求。

阶段：
1. [completed] 更新 `registration_system_rs/AGENTS.md`
2. [completed] 更新 `registration_system_rs/CLAUDE.md`
3. [completed] 记录本次规则同步到 `findings.md` / `progress.md`

## 2026-05-13 后端全量验证

目标：在团队 ID 数字化和 billing/activity 命名统一后，执行完整后端质量门验证。

阶段：
1. [completed] 执行 `cargo clippy --all-targets -- -D warnings`
2. [completed] 修复持久化代码和测试中的机械性 `needless_borrows_for_generic_args`
3. [completed] 执行 `cargo test`
4. [completed] 修复 `remaining_team_activity_routes_test` 里的过期字符串 `team_id` 测试数据
5. [completed] 重新验证通过并同步文档

## 2026-05-13 payment 结算边界与 billing/order schema 收口

目标：不重写 billing 业务，只先把支付成功后的结算 port 命名、充值记录物理关联和重复回调幂等性补齐。

阶段：
1. [completed] 盘点 `PaymentBillingPort`、`rs_recharge_records`、`rs_team_membership_orders` 与现有订单表关系
2. [completed] 将 payment 成功后落账 port 收敛为 `PaymentSettlementPort`
3. [completed] 增加 `rs_recharge_records.payment_order_no` 并补齐外键与唯一索引
4. [completed] 为 `rs_team_membership_orders.transaction_id` 增加唯一索引
5. [completed] 调整 `HandlePaidOrderUseCase` 和 PostgreSQL settlement adapter，保证重复同步/回调可自愈且不重复入账
6. [completed] 执行迁移与后端验证，并同步文档

## 2026-05-14 activity fee snapshot 命名收口

目标：把 `rs_activity_order` / `ActivityOrder` 从“订单”语义中移出，明确为活动费用快照，避免和 payment 模块的支付订单混淆。

阶段：
1. [completed] 新增 schema 红测，约束 `rs_activity_fee_snapshots` 替代 `rs_activity_order`
2. [completed] 新增并执行迁移 `20260514000100_rename_activity_order_to_fee_snapshots.sql`
3. [completed] 后端 domain/application/ports/persistence/web 命名收口为 `ActivityFeeSnapshot`
4. [completed] 管理端费用快照统计同步
5. [completed] 执行后端和管理端验证并同步根目录文档
