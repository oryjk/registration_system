# 小程序真实接口接入审计计划

## 目标

检查 `registration_system_mini` 当前所有主要功能是否已经接入 `registration_system_rs` 的真实 `/api/*` 接口，识别仍使用 mock、静态数据、硬编码或未调用后端的位置。

## 阶段

1. [completed] 扫描小程序页面、store、api、mock 使用点
2. [completed] 扫描后端小程序侧 `/api/*` 路由能力
3. [completed] 对照页面功能与后端接口，归类已接入/部分接入/未接入
4. [completed] 汇总结论与后续改造建议

## 约束

- 只读审计，不修改业务代码。
- 不臆造接口，以小程序代码、后端 route/handler/DTO 为准。
- 与用户沟通使用简体中文。

## 后续实现状态

- [completed] 创建/加入球队：新增小程序页面与真实 `/api/teams` 接口调用。
- [completed] 队长代报名：新增小程序 `/api/activity/:id/team-registration` 调用与后端用户侧路由。
- [completed] 签到入口：比赛详情页接入 `/api/activity/:id/check-in`。
- [completed] 支付/会员续费：我的页接入球队会员下单、微信支付、订单同步流程。

## 剩余功能实现计划

目标：补齐小程序端仍未产品化但后端已有或可小步补齐的真实接口能力。

1. [completed] 手机号绑定
   - 小程序新增 `/api/wx/getPhoneNumber` 调用。
   - 后端新增用户侧手机号绑定接口，解密后写入当前用户资料。
   - 资料页提供微信手机号授权按钮，保存后刷新会话。
2. [completed] 球队成员管理
   - 复用 `/api/teams/:id/members`、`/:id/members/:user_id`、`/:id/members/batch`。
   - 在球队管理页为队长/领队提供新增、修改角色/球衣号、移除、冻结/恢复入口。
3. [completed] 赛后球队互评 / 队费复盘
   - 复用 `/api/teams/:id/credit/reviews` 与信用流水。
   - 比赛详情在球队模式提供赛后互评入口，个人中心展示队费/信用复盘入口。
4. [completed] 签到配置后续修改
   - 复用 `/api/activity/:activity_id/check-in-config`。
   - 比赛详情为队长/领队提供签到启用、半径、时间窗修改入口。
5. [completed] 钱包充值 / 订单管理
   - 复用 `/api/payment/recharge`、`/payment/orders`、`/payment/order/:order_no`、`/payment/cancel`、`/payment/sync/:order_no`。
   - 账单页增加充值、订单列表、同步与取消未支付订单。
6. [completed] 地图与系统配置
   - 小程序位置反查优先走后端 `/api/activity/location-resolve`。
   - 后端将活动位置搜索/解析移动到 app 共享路由。
   - 小程序系统 API 接入 `/api/system/map-preview-settings`，不直接依赖本地地图 key。

## 验证计划

- 小程序：新增/更新页面静态测试与工具单元测试，执行目标 `bun test`。
- 小程序：执行 `bun run type-check`。
- 后端：执行 `cargo check`，并补跑相关路由/业务测试。

## 当前新增任务：小程序运行配置

目标：新增数据库 JSON 运行配置，让小程序首页和部分比赛行为从后端配置读取，先不实现后台编辑页面。

计划文档：

- `docs/superpowers/plans/2026-05-11-mini-app-runtime-config.md`

当前状态：

1. [completed] 后端系统配置 domain/service/repository 扩展
   - 已新增红测，验证默认 mini app 配置、super admin 更新、非 super admin 拒绝更新。
   - 已新增 `MiniAppRuntimeConfig` domain 类型、repository trait 方法、in-memory 实现和 PostgreSQL 实现。
2. [completed] 后端 JSONB 迁移与 HTTP 接口
   - 目标表：`rs_system_runtime_configs`。
   - 目标 key：`mini_app`。
   - 已实现接口：`GET /api/system/mini-app-runtime-config`、`GET/PATCH /api/admin/system/mini-app-runtime-config`。
3. [completed] 小程序配置 API 与默认值
   - 新增小程序 `getMiniAppRuntimeConfig`。
   - 新增本地默认配置和 sanitize/fallback helper。
4. [completed] 首页接入配置
   - 首页比赛数量、约队数量、活动拉取 page size 改为配置驱动。
   - 默认过滤 `holding_date <= now` 的过期比赛，避免过期比赛继续出现在“最近要处理的比赛”。
5. [completed] 验证
   - 后端：`cargo test system::application::service::tests`、`cargo test`、`cargo clippy`。
   - 小程序：`bun test`、`bun run type-check`。

文档一致性说明：

- 旧计划 `docs/superpowers/plans/2026-05-10-mini-real-api-completion.md` 已更新为当前实现状态，不再作为待执行任务清单。
- 根目录已改为统一 monorepo Git 仓库，主分支 `main`，远端 `git@github.com:oryjk/registration_system.git`。
- 三个子项目不再保留各自 `.git` 元数据；历史 Git 目录已备份到根目录外。

## 当前新增任务：monorepo 改造

目标：将工作区从三个独立子仓库改造成根目录统一管理的 monorepo。

当前状态：

1. [completed] 根目录初始化 Git 仓库，分支为 `main`。
2. [completed] 根目录远端设置为 `git@github.com:oryjk/registration_system.git`。
3. [completed] 子项目 `.git` 元数据已移出工作树并备份到根目录外。
4. [completed] 新增根 `.gitignore`，覆盖 `.env`、依赖目录、构建产物、Rust `target/`、日志、Playwright 产物、临时截图和系统文件。
5. [completed] 文档更新：根 README、小程序 README、后端 README 和当前任务计划已同步 monorepo 状态。

## 2026-05-13 产品与技术文档整理

目标：基于当前代码生成当前版本产品说明书、技术说明书、数据库关联关系文档。

阶段：
1. [completed] 盘点后端路由、数据库迁移、前端页面和服务封装
2. [completed] 归纳已完成/未完成/待产品讨论功能
3. [completed] 编写 docs/product-spec-current.md
4. [completed] 编写 docs/technical-spec-current.md
5. [completed] 编写 docs/database-relations-current.md
6. [completed] 验证文档引用的代码事实

当前输出：

- `docs/product-spec-current.md`
- `docs/technical-spec-current.md`
- `docs/database-relations-current.md`

关键结论：

- 小程序主功能基本已接真实接口，比赛、约队、球队管理、统计、账单、通知、资料等都有当前版本能力。
- 管理端已覆盖核心运营页面，但 ActivityList/TeamDetail 拆分和部分新增字段同步仍未完全完成。
- 后端大部分模块已进入六边形/use case 拆分形态。
- 球队 ID 数字化迁移已完成：数据库为 `BIGINT`，后端为 `i64`，前端为 `number`。
- billing 可用但财务模型仍需产品化讨论，不宜视为最终账务模型。

后续已新增计划：

- [completed] 按 `docs/superpowers/plans/2026-05-13-team-id-bigserial-migration.md` 完成球队 ID 数字化迁移。

## 2026-05-13 协作文档规范固化

目标：把“复杂任务默认维护 `task_plan.md` / `findings.md` / `progress.md`”固化到仓库协作文档中，减少对单次会话记忆的依赖。

阶段：
1. [completed] 盘点根目录和三个子项目的 `AGENTS.md` / `CLAUDE.md`
2. [completed] 在根目录写入文档维护规范和 `planning-with-files` 默认流程
3. [completed] 在 `registration_system_rs`、`registration_system_mini`、`registration_system_backend_fe` 写入同类约束
4. [completed] 同步更新工作文档，记录本次规则固化结果

约束：

- 本轮先做规范层和流程层，不新增检查脚本。
- 保持规则简洁明确，避免和现有项目约定冲突。

## 2026-05-13 后端全量验证

目标：在 `game_id -> activity_id` 和 billing 命名统一后，执行一次后端完整静态检查与全量测试，确认没有跨模块回归。

阶段：
1. [completed] 执行 `cargo clippy --all-targets -- -D warnings`
2. [completed] 修复 clippy 暴露的机械性借用问题
3. [completed] 执行 `cargo test`
4. [completed] 修复过期字符串 `team_id` 测试数据并重新验证
5. [completed] 同步工作文档记录验证结果

## 2026-05-13 billing/order schema 与支付结算边界收口

目标：在不重写 billing 产品逻辑的前提下，先把 payment 成功后的结算边界、充值记录物理关联和重复回调幂等性补齐。

阶段：
1. [completed] 盘点 `payment` / `billing` / `order` 当前 schema 与 port 边界
2. [completed] 将 `PaymentBillingPort` 收敛为 `PaymentSettlementPort`
3. [completed] 新增 `rs_recharge_records.payment_order_no` 并补齐到 `rs_payment_orders(order_no)` 的物理关联
4. [completed] 为充值记录和球队会员订单补充唯一约束，支撑支付回调幂等
5. [completed] 调整支付成功处理逻辑，使已支付订单可重复触发结算但不重复入账
6. [completed] 执行迁移、专项测试、`cargo clippy` 与全量 `cargo test`

当前输出：

- `registration_system_rs/migrations/20260513000400_payment_settlement_guards.sql`
- `registration_system_rs/src/payment/ports/payment_settlement_port.rs`
- `registration_system_rs/src/payment/adapters/persistence/postgres_payment_settlement_adapter.rs`
- `registration_system_rs/tests/payment_settlement_schema_test.rs`
- `registration_system_rs/tests/payment_settlement_adapter_postgres_test.rs`

## 2026-05-14 activity fee snapshot 命名收口

目标：把误导性的 `rs_activity_order` / `ActivityOrder` 收口为活动费用快照语义，避免与支付订单、会员订单混淆。

阶段：
1. [completed] 新增红测 `activity_fee_snapshot_schema_test`，约束新表存在、旧表不存在、`activity_id` 外键保留
2. [completed] 新增 migration `20260514000100_rename_activity_order_to_fee_snapshots.sql`，直接重命名旧表和约束
3. [completed] 后端 billing 领域、use case、repository、DTO 和 OpenAPI 改为 `ActivityFeeSnapshot`
4. [completed] 管理端 dashboard/service 改为费用快照统计，不再显示“订单数量”
5. [completed] 执行迁移、后端完整验证、管理端 type-check，并同步当前文档

当前输出：

- `registration_system_rs/migrations/20260514000100_rename_activity_order_to_fee_snapshots.sql`
- `registration_system_rs/tests/activity_fee_snapshot_schema_test.rs`
- `registration_system_rs/src/billing/application/use_cases/activity_fee_snapshots.rs`
