# 后端六边形重构计划

## 2026-05-23 散人约队最少/最多人数配置

目标：后端为散人约队支持 `min_players` / `max_players`，默认 `players_per_team * 2` / `players_per_team * 2 + 4`，报名只按 `max_players` 拦截，成行状态按 `min_players`。

阶段：
1. [in_progress] 定位 challenge 领域、DTO、仓储和测试中的容量计算
2. [pending] 新增默认规则与报名校验测试
3. [pending] 新增迁移和领域/DTO/command/port 字段
4. [pending] 更新 Postgres 查询、创建、编辑和散人报名状态逻辑
5. [pending] 执行后端验证

约束：
- 保持六边形边界，handler 只负责 DTO 转换。
- 旧数据字段可为空，读取时按默认规则兜底。
- 后台编辑允许 `max_players` 小于当前已报名人数，不踢人，只影响新增报名。

## 2026-05-23 散人约队支付方式与支付截止

目标：为散人约队增加支付方式、报名支付状态、支付截止处理、Activity 支付订单回写和赛后未支付通知。

阶段：
1. [completed] 盘点 challenge/payment/notification 当前链路
2. [completed] 新增后端业务/仓储红测
3. [completed] 新增数据库迁移和领域模型字段
4. [completed] 调整散人报名写入支付状态与截止时间
5. [completed] 新增散人约队支付下单接口，并接入支付成功回写
6. [completed] 新增超时取消与赛后通知处理逻辑
7. [completed] 执行后端验证

约束：
- 业务规则放在 application/domain，handler 只做协议适配。
- 支付成功回写必须幂等。
- 自动取消和赛后通知不能依赖前端触发。

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

## 2026-05-17 小程序资料页手机号绑定运行配置

目标：复用现有系统运行配置接口，为小程序资料页提供“是否需要手机号绑定”的后端配置，默认关闭。

阶段：
1. [completed] `system/domain` 的 `MiniAppRuntimeConfig` 增加 `profile.require_phone_binding`
2. [completed] 新增 profile 默认值 `false`，并通过 serde default 兼容旧 `mini_app` JSON
3. [completed] `system/adapters/web/dto` 同步 profile DTO，PATCH 旧 payload 缺少 profile 时默认 false
4. [completed] 增加旧 JSON 反序列化兼容测试和默认值断言
5. [completed] 执行后端 system 专项测试和编译验证

## 2026-05-17 管理端报名列表过滤

目标：为管理端拆分“活动报名”和“散人报名”提供后端过滤能力。

阶段：
1. [completed] 活动列表接口新增 `registration_scope=team|direct`
2. [completed] 约队列表接口新增 `kind=team|individual`
3. [completed] 更新 repository port/use case/web handler 传参
4. [in_progress] 补充/更新后端业务测试并运行验证

验证更新：
- [completed] 后端 `cargo test --test challenge_service_business_test admin_can_filter_individual_challenges -- --nocapture`
- [completed] 后端 `cargo check --tests`
- [completed] 后端 `cargo clippy --all-targets -- -D warnings`
- [completed] 管理端 `bun run type-check`
- [completed] 管理端 `bun run build`
- [blocked] 管理端 `bun run lint` 被既有非本轮问题阻塞

## 2026-05-17 管理端约队/散人报名编辑删除后端接口

目标：为管理端提供约队/散人报名编辑和删除能力，删除按取消状态处理。

阶段：
1. [completed] 新增管理员取消 open 约队业务测试
2. [completed] 新增管理员更新 open 约队基础字段业务测试
3. [completed] 新增 `UpdateChallengeCommand`、`UpdateChallengeUseCase` 和 repository 更新端口
4. [completed] PostgreSQL repository 支持更新标题、时间、场地、坐标、人数、费用和备注
5. [completed] Web 层新增 `PATCH /:id`，并更新 OpenAPI
6. [completed] 取消用例允许管理员按权限取消 open 约队
7. [completed] 执行目标测试、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`

约束：

- 不新增物理删除接口。
- 不允许编辑已约成或已取消记录。
- 不在 handler 或 repository 中承载业务权限；权限在 application use case 内完成。

## 2026-05-17 后台创建散人报名接口

目标：允许超管通过后台创建散人报名，发布主体仍落到小程序用户。

阶段：
1. [completed] 新增超管代用户创建散人报名测试
2. [completed] 新增普通管理员禁止创建测试
3. [completed] 新增后台创建拒绝球队约队测试
4. [completed] `CreateChallengeCommand` / `CreateChallengeRequest` 增加 `host_user_id`
5. [completed] `CreateChallengeUseCase` 区分用户端创建和管理员后台创建
6. [completed] 执行 challenge 业务测试、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`

约束：

- 用户端创建不能代其他用户发布。
- 管理端创建只支持超管创建散人报名。
- 管理端创建必须指定存在且具备场馆身份的小程序用户。

## 2026-05-17 散人报名详情完整报名名单

目标：后端详情接口为管理端返回完整散人报名人员列表，避免运营详情页漏人。

阶段：
1. [completed] 确认 `ChallengeDetail` / DTO 已有 `individual_participants`
2. [completed] 新增 Postgres 仓储测试覆盖 13 个报名者完整返回
3. [completed] 移除详情报名人员查询的 `LIMIT 12`
4. [completed] 列表 summary 增加 `individual_participant_preview` 前 3 人预览
5. [completed] 执行目标测试、`cargo check --tests`、`cargo clippy`

## 2026-05-19 活动报名 team scope 修复

目标：修复 `/api/admin/activities?registration_scope=team` 漏掉直接球队活动的问题。

阶段：
1. [completed] 用数据库确认东安洺悦联队报名中活动 `home_team_id` 有值但 `source_activity_id` 为空
2. [completed] 新增 Postgres 仓储回归测试覆盖该场景
3. [completed] 调整 activity list SQL 的 team/direct scope 判断
4. [completed] 执行目标测试和 `cargo check --tests`

## 2026-05-20 球队活动报名取消人数上限

目标：后端不再限制球队活动个人报名最大人数，`players_per_team` 只作为最低成行人数。

阶段：
1. [completed] 定位 `/activity/:id/my-stand` 后端 use case
2. [completed] 新增回归测试覆盖超过 `players_per_team + 2` 后仍可报名
3. [completed] 移除容量校验和无用 helper
4. [completed] 执行后端目标测试、`cargo check --tests` 和 diff 检查

## 2026-05-20 球员列表 bigint/text 500 修复

目标：修复管理后台球员列表查询中 `bigint = text` 的 SQL 类型错误。

阶段：
1. [completed] 根据线上日志定位到 `user` 模块球员列表查询链路
2. [completed] 确认 `PostgresUserRepository` 中残留 `tm.team_id::text` 和 `CAST(t.id AS TEXT)`
3. [completed] 将球员列表 count/page/team summary 查询全部改为 bigint 直连
4. [completed] 将 `PlayerTeamSummary.team_id`、web DTO 和 row struct 统一为 `i64`
5. [completed] 增加 SQL 回归测试并执行后端验证

## 2026-05-20 小程序首页装修配置后端支持

目标：扩展 `mini_app` 运行配置，支持首页 hero/banner 装修配置数组，供管理后台保存和小程序读取。

阶段：
1. [completed] 补充旧 JSON 兼容和 banner sanitize 的后端测试
2. [completed] 在 domain/DTO 中新增 `MiniAppHomeHeroBanner`
3. [completed] 确保读取、更新、Postgres JSONB 保存均走 sanitize 后结构
4. [completed] 执行 `system` 相关测试、`cargo check --tests` 和必要 clippy

约束：
- 不新增表，继续复用 `rs_system_runtime_configs.config_key = mini_app`。
- 旧配置缺少 `hero_banners` 时必须能反序列化并回退默认卡片。

## 2026-05-20 小程序装修图片 MinIO 上传接口

目标：为管理后台提供小程序装修图片上传能力，图片统一上传到 MinIO 并返回公开 URL。

阶段：
1. [completed] 在 system web 层新增 multipart 上传 handler
2. [completed] 复用 `detect_image_extension` 和 `save_minio_bytes`
3. [completed] 新增 `/api/admin/system/mini-app-decoration/images` 路由
4. [completed] 更新 OpenAPI 文档
5. [completed] 执行 `cargo check --tests` 和 clippy

## 2026-05-23 散人约队最少/最多人数配置

目标：散人约队支持每场配置最少成行人数和最多报名人数，未配置时按 `players_per_team * 2` / `players_per_team * 2 + 4` 计算。

阶段：
1. [completed] 领域模型新增 `min_players` / `max_players` 和默认 helper
2. [completed] 创建/更新命令、DTO、仓储 port 和 Postgres 持久化接入字段
3. [completed] 报名拦截改用最多报名人数，成行状态改用最少成行人数
4. [completed] 保持散人 `matched` 后未满员仍可继续报名
5. [completed] 补充并通过 challenge 业务测试、`cargo check --tests`、clippy

## 2026-05-24 队长/场馆角色账号管理

目标：后端支持超级管理员创建队长、场馆两类小程序角色用户，设置账号密码，并能对这些角色用户冻结/解冻和修改密码。

阶段：
1. [completed] 梳理现有 `rs_user_info`、`rs_teams.captain_id`、`rs_team_members.role` 和管理员权限模型
2. [completed] 新增 `password_hash` 持久化与账号密码登录 use case
3. [completed] 新增超管创建队长/场馆账号 use case，队长创建时绑定具体球队
4. [completed] 新增修改角色用户密码接口，冻结/解冻复用现有球员接口
5. [completed] 补充业务测试并完成 `cargo check --tests`、clippy
