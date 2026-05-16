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

## 2026-05-14 队员会员标识

目标：为 `rs_team_members` 增加独立的队员会员标识，并通过成员增改查接口返回和保存。

阶段：
1. [completed] 新增迁移 `20260514000200_team_member_is_member.sql`
2. [completed] 贯通 `TeamMember` / `TeamMemberWithInfo`、DTO、commands、repository port
3. [completed] 贯通 PostgreSQL add/reactivate/update/list 查询
4. [completed] 更新测试 fake 和 schema 测试
5. [completed] 执行 `cargo fmt --check`、`cargo check --tests`、专项测试、`cargo clippy --all-targets -- -D warnings`
## 2026-05-15 场馆角色与约队发布权限

目标：评估并实现“场馆”也可发布球队约队和散人约队的后端权限模型。

阶段：
1. [completed] 盘点 challenge 创建 DTO、use case、权限校验、repository 查询
2. [completed] 盘点 `rs_challenges` 当前 schema 对 `host_team_id` 的硬依赖
3. [completed] 盘点 user domain/DTO 中现有身份字段
4. [completed] 按方案 B 新增用户级 `is_venue` 附加身份
5. [completed] 迁移 `rs_user_info.is_venue`，并允许 `rs_challenges.host_team_id` 为空
6. [completed] 创建/取消/接约 use case 支持场馆发布分支
7. [completed] summary 查询从主队内连接改为可空主队，场馆发布展示用户名兜底
8. [completed] 补充 schema 和 challenge business 测试
9. [completed] 执行后端专项测试与 clippy

约束：

- 当前后端禁止非用户 actor 发布约队。
- `is_venue` 不是互斥角色，不能阻止用户继续参与报名或保留球队成员身份。
- `host_team_id = None` 只允许 `is_venue = true` 的用户发布；`host_team_id = Some` 继续走队长/领队校验。
- 场馆发布的球队约队两阶段撮合：第一支球队占位后仍为 `open`，但会生成“等待对手”的活动；第二支不同球队接约后才 `matched` 并更新同一活动。

## 2026-05-16 微信手机号响应解析修复

目标：修复 `/api/wx/getPhoneNumber` 在线上解析微信手机号响应失败的问题，并让未来上游异常响应可从日志中直接定位。

阶段：
1. [completed] 定位 `/api/wx/getPhoneNumber` 调用链和 `RealWechatApi::get_phone_number`
2. [completed] 新增单元测试复现微信官方 `phone_info.phoneNumber` 响应无法解析的问题
3. [completed] 将 `PhoneInfoResponse` 改为 camelCase 反序列化，兼容微信官方字段
4. [completed] 手机号响应改为先读取原始 body，再在解析失败时附带 status、content-type 和 body 摘要
5. [completed] 修复 `errcode=0, errmsg=ok` 成功响应误判
6. [completed] 配置 out109 飞书健康告警，连续失败 3 次才发送
7. [completed] 执行目标测试与 `cargo clippy --all-targets -- -D warnings`

约束：

- 不改变小程序接口返回结构，后端仍返回 `phone_number`。
- 本轮只修改微信外部网关 adapter，不调整 handler、use case、前端调用。
