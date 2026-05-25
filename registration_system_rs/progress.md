# 后端重构进度

## 2026-05-23 散人约队最少/最多人数配置

- 已读取后端协作文档和当前 challenge 领域/DTO/command。
- 已定位当前散人约队容量规则仍绑定到 `players_per_team * 2`。
- 已将本轮目标写入后端 task_plan/findings/progress。
- 下一步：新增后端测试，先约束默认 `max = players_per_team * 2 + 4` 和自定义上限拦截。

## 2026-05-23 散人约队支付方式与支付截止

- 已读取后端协作文档与当前 challenge/payment 关键链路。
- 已确认当前散人报名无支付状态字段，支付模块 Activity 类型尚未回写散人报名。
- 已将本轮目标写入后端 task_plan/findings/progress。
- 下一步：新增后端红测覆盖散人约队支付方式和支付处理。
- 已新增 `ChallengePaymentMode`、散人报名支付状态 read model，并补充赛前/赛后支付 deadline 业务测试。
- 错误记录：首次执行 `cargo test --test challenge_service_business_test prepaid... postpaid...` 失败，原因是 Cargo 只接受一个测试名过滤器；改为执行整个测试文件。
- 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`，22 个 challenge 业务测试全部通过。
- 已新增迁移 `20260523000100_challenge_individual_payment.sql`，为约队和散人报名增加支付方式/支付状态字段。
- 已新增 `challenge_individual_payment_schema_test.rs`，验证通过：`cargo test --test challenge_individual_payment_schema_test -- --nocapture`。
- 已扩展 `PaymentSettlementPort::settle_activity_payment`，支付成功时可回写 Activity 类型订单对应的散人报名。
- 已新增 `POST /api/payment/challenge-individual` 后端处理链路，创建 Activity 类型支付订单并关联散人报名记录。
- 验证通过：`cargo test --test payment_service_business_test -- --nocapture`，9 个 payment 业务测试全部通过。
- 已新增散人约队支付状态后台处理：赛前支付过期未付自动取消报名，赛后支付比赛结束后未付发送一次系统通知。
- 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`，24 个 challenge 业务测试全部通过。
- 已在 `build_app` 启动 60 秒间隔后台任务处理散人支付状态；验证通过：`cargo check --tests`。
- 已补充最终后端验证：`cargo test --test challenge_individual_payment_schema_test -- --nocapture` 2 个 schema 测试通过；`cargo test --test payment_service_business_test -- --nocapture` 9 个 payment 业务测试通过。
- 已执行最终静态验证：`cargo check --tests` 通过，`cargo clippy --all-targets -- -D warnings` 通过。
- 已用 `rustfmt --edition 2024` 格式化本轮散人支付相关 Rust 文件；未对系统装修等无关既有改动做扩大格式化。
- 全量 `cargo fmt --check` 仍失败于 `src/system/*`、`tests/challenge_repository_postgres_test.rs`、`tests/player_repository_sql_regression_test.rs` 等非本轮散人支付文件的既有格式差异。

## 2026-05-12

- 已完成 `team` 模块一轮重构并通过 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。
- 开始制定跨模块重构计划。
- 当前准备处理 `challenge` 模块，目标是先拆应用层 use case，保持 API 行为稳定。
- 已完成 `challenge` 应用层拆分，`cargo clippy --all-targets -- -D warnings`、`cargo test --test challenge_service_business_test`、`cargo test --test challenge_repository_postgres_test` 通过。
- 已完成 `challenge` repository 读写 trait 拆分，专项测试和完整 `cargo test` 通过。
- 已完成 `billing` 应用层拆分、Service facade 化、读写 port 拆分；`cargo clippy --all-targets -- -D warnings`、账单/支付相关专项测试和完整 `cargo test` 均通过。
- 已完成 `payment` 应用层拆分、Service facade 化、支付订单读写 port 拆分；支付专项测试和完整 `cargo test` 通过。
- 已完成 `user` 应用层拆分、Service facade 化；`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test --test user_player_scope_test`、`cargo test --test payment_service_business_test`、`cargo test` 均通过。
- 已完成 `user` repository 读写 port 拆分，并同步 `payment` openid resolver、bootstrap 和测试 fake；`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test --test user_player_scope_test`、`cargo test --test payment_service_business_test`、`cargo test` 均通过。
- 已完成 `system` 应用层拆分、Service facade 化、系统设置读写 port 拆分；`cargo fmt --check`、`cargo test system::application::service::tests`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 均通过。
- 已完成 `wx` 应用层拆分、Service facade 化；`cargo fmt --check`、`cargo test --test wx_payment_test`、`cargo clippy --all-targets -- -D warnings` 均通过。
- 已完成 `auth` 应用层拆分、Service facade 化、管理员仓储读写 port 拆分；`cargo fmt --check`、`cargo test --test openapi_api_test`、`cargo test --test health_api_test`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 均通过。
- 已完成 `notification` 应用层拆分、Service facade 化、通知仓储读写 port 拆分；`cargo fmt --check`、`cargo test --test notification_service_business_test`、`cargo test --test challenge_service_business_test`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 均通过。
- 已开始 `activity` 拆分。Task 1 已完成：抽出 `commands.rs`、`read_models.rs`、`validation.rs`，保持 `ActivityService` 行为不变；`cargo fmt --check`、`cargo test activity::application::service::tests` 通过。
- `activity` Task 2 已完成：抽出 `permission.rs` 和 `ActivityPermissionChecker`，先替换创建/更新比赛权限判断；`cargo fmt --check`、`team_manager_can_create_activity_with_initial_checkin_config`、`team_manager_can_update_own_future_activity`、`cargo test activity::application::service::tests` 通过。
- `activity` Task 3 已完成：抽出 `QueryActivityUseCase`，迁移活动列表/详情/进行中/报名列表查询；`cargo fmt --check`、`cargo test activity::application::service::tests`、`cargo test --test remaining_team_activity_routes_test` 通过。
- `activity` Task 4 已完成：抽出 `ActivityLocationUseCase`，迁移地点搜索和坐标反查；`cargo fmt --check`、地点相关 3 个专项测试通过。
- `activity` Task 5 已完成：抽出 `ManageRegistrationUseCase`，迁移个人/管理员/批量报名和删除报名逻辑；`cargo fmt --check`、报名相关 2 个专项测试、`cargo test --test batch_operations_business_test` 通过。
- `activity` Task 6 已完成：抽出 `ManageActivityUseCase`，迁移活动创建/更新/状态/删除/回填逻辑；`cargo fmt --check`、活动管理相关 5 个专项测试通过。
- `activity` Task 7 已完成：抽出 `TeamRegistrationUseCase`，迁移球队报名和取消球队报名逻辑；`cargo fmt --check`、取消球队报名专项测试、`cargo test --test challenge_service_business_test` 通过。
- `activity` Task 8 已完成：抽出 `ActivityCheckInUseCase`，迁移签到配置和签到提交逻辑；`cargo fmt --check`、`cargo test --test activity_checkin_service_business_test`、签到配置专项测试通过。
- `activity` Task 9 已完成：`ActivityService` 已收敛为 facade（构造 use case + public API 转发）；`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 通过。
- `activity` Task 10 已完成：新增 `ActivityQueryRepository` / `ActivityCommandRepository`，应用层 use case 改为按读写端口依赖，`ActivityService::new` 改为接收 query/command 两个端口；专项测试、`remaining_team_activity_routes_test`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 均通过。
- `activity` Task 11 已完成：拆分 `PostgresActivityRepository` 持久化适配器，抽出 `models.rs`、`query.rs`、`command.rs`，原入口文件缩小为仓储结构和 trait 委托；`cargo fmt --check`、`cargo test activity::adapters::persistence`、`cargo test --test activity_checkin_service_business_test`、`cargo clippy --all-targets -- -D warnings`、`cargo test` 均通过。
- `activity` 后续清理已完成：移除旧兼容 `ActivityRepository` 大 trait 和 blanket impl，`PostgresActivityRepository` 与测试 fake 均显式实现 `ActivityQueryRepository` / `ActivityCommandRepository`，`team` 信用用例改为只依赖 activity 读端口。
- 2026-05-13：完成 `migrations/20260513000100_team_id_bigserial.sql`，球队主键改为 `BIGINT`，保留 `legacy_id`，并同步全部球队外键列。
- 2026-05-13：新增 `tests/team_id_numeric_schema_test.rs`，验证球队相关列为 `bigint` 且 `rs_user_billings.activity_id` 外键存在。
- 2026-05-13：完成后端球队 ID 类型从 `String` 到 `i64` 的同步，`cargo check` 与 `cargo check --tests` 通过。
- 2026-05-13：完成 billing 领域命名统一：`GameExpense*` -> `ActivityExpense*`，`add_game_expenses` -> `add_activity_expenses`，`/game-expense` -> `/activity-expense`。
- 2026-05-13：完成 `migrations/20260513000300_unify_billing_activity_terms.sql` 并执行 `sqlx migrate run`，统一 `billing_type` 默认值为 `activity_fee`，重命名 `activity_fee_amount`，并清空开发库订单/账单/结算旧数据。
- 2026-05-13：验证通过：`cargo check`、`cargo check --tests`、`cargo test --test billing_repository_postgres_test`、`cargo test --test billing_service_business_test`、`cargo test --test team_id_numeric_schema_test`。
- 2026-05-13：已在 `registration_system_rs/AGENTS.md` 和 `registration_system_rs/CLAUDE.md` 中补充复杂任务默认维护 `task_plan.md`、`findings.md`、`progress.md` 的要求，并要求同步根目录三份文档。
- 2026-05-13：执行 `cargo clippy --all-targets -- -D warnings`，修复 `activity` / `challenge` / `payment` 持久化代码以及 `challenge_repository_postgres_test` 中的 `needless_borrows_for_generic_args`。
- 2026-05-13：执行全量 `cargo test` 时修复 `remaining_team_activity_routes_test` 的过期字符串 `team_id` 测试数据，恢复 `401` 鉴权语义验证。
- 2026-05-13：最终全量验证通过：`cargo clippy --all-targets -- -D warnings`、`cargo test`。
- 2026-05-13：开始处理 payment/billing/order 的第二步收口，重新审阅 `payment/ports/payment_billing_port.rs`、`postgres_payment_billing_adapter.rs`、`handle_paid_order.rs` 和相关迁移。
- 2026-05-13：确认 `transaction_no` 不能直接绑定支付订单，因此新增专用字段 `rs_recharge_records.payment_order_no` 作为系统内支付订单关联。
- 2026-05-13：新增 `payment_settlement_port.rs`，把 `PaymentBillingPort` / `TeamMembershipSettlement` 重构为 `PaymentSettlementPort`、`RechargePaymentSettlement`、`TeamMembershipPaymentSettlement`。
- 2026-05-13：新增 `postgres_payment_settlement_adapter.rs`，将充值入账改为“先插 `rs_recharge_records`，成功后再加余额”，通过唯一约束实现数据库级幂等。
- 2026-05-13：调整 `HandlePaidOrderUseCase`，已支付订单再次同步时会复用已有 `transaction_id` 再次进入 settlement port，以支持历史半完成状态自愈。
- 2026-05-13：新增迁移 `20260513000400_payment_settlement_guards.sql`，补充 `rs_recharge_records.payment_order_no -> rs_payment_orders(order_no)` 外键，以及 `payment_order_no` / `rs_team_membership_orders.transaction_id` 唯一索引。
- 2026-05-13：新增 `payment_settlement_schema_test.rs` 与 `payment_settlement_adapter_postgres_test.rs`，并更新 `payment_service_business_test.rs` 以覆盖已支付订单重复同步场景。
- 2026-05-13：首次幂等测试失败，原因是部分唯一索引无法作为 `ON CONFLICT (payment_order_no)` 的冲突目标；已改为普通唯一索引并重新通过。
- 2026-05-13：执行 `sqlx migrate run`，成功应用 `20260513000400_payment_settlement_guards`。
- 2026-05-13：验证通过：
  - `cargo test --test payment_service_business_test --test payment_settlement_schema_test --test payment_settlement_adapter_postgres_test -- --nocapture`
  - `cargo clippy --all-targets -- -D warnings`
  - `cargo test`
- 2026-05-14：新增 `tests/activity_fee_snapshot_schema_test.rs`，验证费用快照新表、旧表移除和 `activity_id` 外键。
- 2026-05-14：新增并执行 `migrations/20260514000100_rename_activity_order_to_fee_snapshots.sql`，将 `rs_activity_order` 重命名为 `rs_activity_fee_snapshots`。
- 2026-05-14：完成后端 `ActivityOrder` -> `ActivityFeeSnapshot`、`CreateActivityOrder` -> `UpsertActivityFeeSnapshot` 命名收口，费用快照 API 子路径改为 `/activity-fee-snapshots`。
- 2026-05-14：管理端 `listOrders` / `orderCount` 改为 `listActivityFeeSnapshots` / `feeSnapshotCount`，仪表盘显示“费用快照”。
- 2026-05-14：验证通过：
  - `cargo fmt --check`
  - `cargo test --test activity_fee_snapshot_schema_test -- --nocapture`
  - `cargo check --tests`
  - `sqlx migrate run`
  - `cargo clippy --all-targets -- -D warnings`
  - `cargo test`
  - 管理端 `bun run type-check`
- 2026-05-14：新增 `migrations/20260514000200_team_member_is_member.sql`，为 `rs_team_members` 增加 `is_member boolean not null default false`。
- 2026-05-14：后端已贯通 `TeamMember` / `TeamMemberWithInfo`、web DTO、commands、repository port、PostgreSQL 持久化和测试 fake。
- 2026-05-14：新增 `tests/team_member_is_member_schema_test.rs`。
- 2026-05-14：验证通过：`cargo fmt --check`、`cargo check --tests`、`cargo test --test team_member_is_member_schema_test -- --nocapture`、`cargo test team::application::service::tests -- --nocapture`、`cargo clippy --all-targets -- -D warnings`。
## 2026-05-15 场馆角色与约队发布权限

- 已读取后端协作文档。
- 已盘点 challenge 创建、列表、详情、持久化和 `rs_challenges` 初始迁移。
- 已确认当前实现把发布主体强绑定到球队，场馆能力需要先确认建模方案。
- 已新增迁移 `migrations/20260515000100_user_venue_identity_and_challenge_host.sql`，新增 `rs_user_info.is_venue` 并放开 `rs_challenges.host_team_id` 非空约束。
- 已贯通 `User`/`PlayerWithTeams`、更新命令、Web DTO、PostgreSQL user repository 和 admin player 创建/更新。
- 已将 challenge domain/command/DTO/repository 的 `host_team_id` 改为可空，并调整列表、详情和管理端 summary 查询。
- 已在 `CreateChallengeUseCase` 和 `CancelChallengeUseCase` 注入 `UserQueryRepository`，支持场馆无主队发布/取消；队长/领队分支保持不变。
- 已调整 `AcceptChallengeUseCase`，场馆发布球队约队被接约后生成活动时不创建虚拟主队。
- 已新增 `tests/user_is_venue_schema_test.rs` 并扩展 `tests/challenge_service_business_test.rs`。
- 验证通过：`cargo test --test user_is_venue_schema_test --test challenge_service_business_test -- --nocapture`；`cargo clippy --all-targets -- -D warnings`。
- 已按场馆撮合两支球队语义调整 `accept_as_host_team` 仓储命令：第一支球队接约时生成待对手活动，第二支球队接约时复用 `accept_with_activity` 更新同一活动。
- 已新增并通过业务测试 `venue_team_challenge_creates_pending_activity_then_second_team_confirms_opponent`。
- 追加验证通过：`cargo test --test challenge_service_business_test -- --nocapture`；`cargo clippy --all-targets -- -D warnings`。

## 2026-05-16 微信手机号响应解析修复

- 已排查生产日志中的 `/api/wx/getPhoneNumber` 500，定位到 `RealWechatApi::get_phone_number` 解码微信响应失败。
- 已新增 `real_wechat_api` 单元测试，复现微信官方 `phone_info.phoneNumber` payload 在旧 DTO 下无法解析的问题。
- 已为 `PhoneInfoResponse` 增加 camelCase 反序列化，后端继续向小程序返回 `phone_number`。
- 已将手机号接口响应解析改为读取原始 body 后解析；解析失败时错误信息包含 status、content-type 和 body 摘要，便于线上继续定位非 JSON/网关异常。
- 验证通过：`cargo test wx::adapters::api::real_wechat_api::tests -- --nocapture`、`cargo clippy --all-targets -- -D warnings`。
- `cargo fmt --check` 当前仍被既有 challenge 文件格式化差异阻塞；本轮仅使用 `rustfmt --edition 2024 src/wx/adapters/api/real_wechat_api.rs` 格式化了修改文件，未扩大无关 diff。
- 已修复微信成功响应 `errcode=0, errmsg=ok` 被误判为错误的问题；现在只有非 0 errcode 才按微信 API 错误处理，并新增单元测试。
- 已在 out109 增加服务器侧飞书健康告警，cron 每分钟执行，连续失败 3 次才发送告警，恢复后发送恢复通知。

## 2026-05-16 登录态公开约队列表报名状态

- 已确认首页无当前球队时会走公开约队列表；旧后端公开列表未计算 `current_user_joined`，导致已报名散人局在首页仍显示“去报名”，再次点击后报名接口返回 409。
- 已为公开约队列表增加可选 `viewer_user_id`，登录态用户访问 `/api/challenges` 且不带 `team_id` 时也会计算散人报名关系。
- 已更新 `ChallengeRepository` 查询端口、`ListChallengesUseCase`、`ChallengeService`、web handler 和 PostgreSQL 查询实现。
- 已新增业务测试 `logged_in_public_challenge_list_marks_joined_individual_challenges`。
- 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`。

## 2026-05-17 小程序手机号绑定运行配置

- 已在 `MiniAppRuntimeConfig` 增加 `profile.require_phone_binding`，默认 `false`。
- `profile` 字段已加 `serde(default)`，旧 `mini_app` JSON 缺少该 section 时仍可反序列化并 sanitize。
- `MiniAppRuntimeConfigDto` 已同步新增 profile DTO，并给 PATCH payload 的 profile 加默认值，兼容旧配置提交。
- 已新增测试 `mini_app_runtime_config_deserializes_old_json_without_profile_section`，并在默认配置测试中断言 `require_phone_binding=false`。
- 验证通过：`cargo test system::application::service::tests -- --nocapture`；`cargo check --tests`；`rustfmt --edition 2024 --check src/system/domain/mod.rs src/system/adapters/web/dto.rs src/system/application/service.rs`；根目录 `git diff --check`。全量 `cargo fmt --check` 仍被既有 challenge 文件格式差异阻塞，未扩大格式化范围。

## 2026-05-17 管理端报名列表过滤

- 已新增 activity list port/use case/handler/repository 的 `registration_scope` 参数。
- 已新增 challenge list DTO/use case/repository 的 `kind` 参数。
- 已更新 fake repositories 和新增 `admin_can_filter_individual_challenges` 测试。

- 17:25 验证通过：后端专项测试、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`；管理端 `bun run type-check`、`bun run build`。
- 17:25 `bun run lint` 未通过，失败点为既有 `ActivitySettlementPanel.vue` / `PlayerFilterBar.vue` / `PlayerFreezeDialog.vue` prop 直接变更和 `PlayerList.vue` 未使用导入，非本轮改动文件。

## 2026-05-17 管理端约队/散人报名编辑删除

- 已新增管理员取消和编辑业务测试，并确认红测先失败于缺少更新 command/service 方法。
- 已实现 `UpdateChallengeUseCase`、`UpdateChallengeFields`、Postgres 更新方法和 `PATCH /api/admin/challenges/:id`。
- 已扩展取消用例支持管理员取消 open 约队，普通管理员按已分配球队范围校验。
- 验证通过：`cargo test --test challenge_service_business_test super_admin_can_ -- --nocapture`。
- 验证通过：`cargo check --tests`。
- 验证通过：`cargo clippy --all-targets -- -D warnings`。

## 2026-05-17 后台创建散人报名

- 已新增并通过业务测试：`super_admin_can_create_individual_challenge_for_host_user`、`non_super_admin_cannot_create_individual_challenge_from_backend`、`super_admin_backend_create_rejects_team_challenge_kind`。
- 已为创建命令和 web DTO 增加 `host_user_id`，并保持用户端不传时使用当前用户。
- 已在创建 use case 中限制管理员创建为超管 + 散人报名 + 场馆发布用户。
- 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`。
- 验证通过：`cargo check --tests`。
- 验证通过：`cargo clippy --all-targets -- -D warnings`。

## 2026-05-17 散人报名详情完整名单

- 已新增仓储测试 `detail_returns_all_individual_participants`，插入 13 个散人报名者并断言详情返回 13 条名单；初始失败为实际只返回 12。
- 已移除 `PostgresChallengeRepository::get_detail` 中报名人员查询的 `LIMIT 12`。
- 验证通过：`cargo test --test challenge_repository_postgres_test detail_returns_all_individual_participants -- --nocapture`。
- 验证通过：`cargo check --tests`。
- 验证通过：`cargo clippy --all-targets -- -D warnings`。
- 已为 challenge summary 增加 `individual_participant_preview`，Postgres 列表查询后批量装配每条散人局前 3 个报名者头像/昵称。

## 2026-05-19 活动报名 team scope 修复

- 已确认 `/api/admin/activities?registration_scope=team` 旧 SQL 只查 `source_activity_id IS NOT NULL`，漏掉直接创建但归属球队的活动。
- 当前数据库里东安洺悦联队报名中的 `周四友谊赛` 等活动 `home_team_id=1` 且 `source_activity_id=NULL`，因此旧查询返回 0。
- 已新增 `tests/activity_repository_scope_test.rs`，红灯复现后将 team scope 改为 `home_team_id IS NOT NULL OR away_team_id IS NOT NULL`，direct scope 改为无主客队活动。
- 验证通过：`cargo test --test activity_repository_scope_test -- --nocapture`、`cargo check --tests`。

## 2026-05-20 球队活动报名取消人数上限

- 已确认后端个人报名 use case 仍按 `players_per_team + 2` 限制容量。
- 已新增 `update_my_stand_allows_signup_after_required_players_plus_two` 回归测试。
- 已移除 `ManageRegistrationUseCase` 中的容量校验，个人报名不再因人数超过 `players_per_team + 2` 被拒绝。
- 已删除不再使用的 `is_capacity_stand`。
- 验证通过：`cargo test activity::application::service::tests::update_my_stand_ -- --nocapture`、`cargo check --tests`、根目录 `git diff --check`。

## 2026-05-20 球员列表 bigint/text 500 修复

- 已修复 `PostgresUserRepository::do_list_players_admin` 中两处 `JOIN rs_teams t ON t.id = tm.team_id::text`，改为 `t.id = tm.team_id`。
- 已修复 `do_find_player_teams`，不再 `CAST(t.id AS TEXT)`，球队摘要 `team_id` 保持数字。
- 已将 `PlayerTeamSummary.team_id`、`PlayerTeamSummaryDto.team_id`、`PlayerTeamRow.team_id` 从 `String` 改为 `i64`。
- 已新增 `tests/player_repository_sql_regression_test.rs`，防止球员列表 SQL 再回退到 text cast。
- 验证通过：`cargo test --test player_repository_sql_regression_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`、根目录 `git diff --check`。

## 2026-05-20 小程序首页装修配置后端支持

- 已开始在 `system` 模块扩展 `MiniAppRuntimeConfig.home`，目标字段为首页 hero/banner 装修数组。
- 已确认本轮不新增迁移，仍使用 `rs_system_runtime_configs` 的 `mini_app` JSON 配置。
- 已新增 `MiniAppHomeHeroBanner`，默认“约球开踢”卡片，旧 JSON 缺少 `hero_banners` 时可反序列化并回退默认值。
- 已在 sanitize 中裁剪最多 10 条、按 `sort_order` 排序、丢弃空标题、空按钮文案回退“去看看”。
- 验证通过：`cargo test system::application::service::tests -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`。

## 2026-05-20 小程序装修图片 MinIO 上传接口

- 已新增 `upload_mini_app_decoration_image_handler`，要求 super admin，接收 multipart `file`。
- 已校验文件非空、大小不超过 5MB，格式仅支持 jpg/png/webp。
- 已通过 `save_minio_bytes` 上传到 MinIO，object key 位于 `mini-app/home-banners/`。
- 验证通过：`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`。

## 2026-05-23 散人约队最少/最多人数配置

- 已新增迁移 `20260523000200_challenge_signup_limits.sql`，给 `rs_challenges` 增加 nullable `min_players` / `max_players` 与正数/大小关系约束。
- 已在 `Challenge` 领域模型加入 `min_signup_players()` / `max_signup_players()`，并保留 `signup_capacity()` 表示最大报名人数。
- 已将 create/update command、web DTO、handler、repository port、Postgres row model、insert/update/select 全链路接入 `min_players` / `max_players`。
- 已让创建/更新散人约队校验人数规则；球队约队清空散人专用字段。
- 已把散人新增报名容量拦截改为 `max_signup_players()`，把报名后/取消后状态判断改为 `min_signup_players()`。
- 已调整业务语义：散人 `matched` 表示已达成行人数，不再表示不能继续报名；达到最多报名人数才拒绝新增报名。
- 已新增/更新 challenge 业务测试，覆盖默认最少/最多人数、自定义 `10/14`、达到默认最多人数后拒绝。
- 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`。

## 2026-05-24 队长/场馆角色账号管理

- 已新增迁移 `20260523000300_user_role_account_credentials.sql`，为 `rs_user_info` 增加 nullable `password_hash`，并给已设置密码的非空 `username` 建唯一索引。
- 已扩展 `User` 领域模型、`UserQueryRepository::find_by_username`、`UserCommandRepository::update_password_hash` 和 Postgres 实现。
- 已新增账号密码登录能力：`UserLoginUseCase::execute_with_password` 与 `POST /api/user/password-login`。
- 已新增角色账号创建能力：超管调用 `POST /api/admin/users/players/role-users`，场馆设置 `is_venue`，队长要求 `team_id` 并通过 `TeamCommandRepository::set_captain_member` 同步球队队长和成员角色。
- 已新增角色账号改密码能力：`PATCH /api/admin/users/players/:user_id/password`，并限制目标必须是场馆或 active captain。
- 已扩展 `PlayerAdminListQuery.role` 和管理后台球员列表 SQL，支持 `role=venue|captain` 筛选。
- 验证通过：`cargo test --test user_player_scope_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`。
