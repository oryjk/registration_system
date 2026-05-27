# 小程序真实接口接入审计计划

## 2026-05-25 小程序首页首屏加载排查与优化

目标：排查首页在微信开发者工具中首屏展示慢的问题，定位首屏阻塞链路，并在不改变业务语义的前提下缩短骨架屏等待时间。

阶段：
1. [completed] 读取根目录与小程序协作文档、既有工作文档
2. [completed] 对照截图 Network 请求与首页/session 代码链路
3. [completed] 将首页非首屏关键请求移到后台补齐，保留关键待办数据首屏正确
4. [completed] 执行目标测试、类型检查并同步工作文档

当前判断：
- 首页首次登录态会先执行 session/team bootstrap，再等待首页 `Promise.all` 里的运行配置、活动、本人活动、全年出勤、约队、用户列表、未读通知，以及每个待办活动的报名用户请求。
- 截图里 `user/infos` 约 54KB、`user/attendance`、`notifications/unread-count`、重复 `my-teams`/`info` 等请求都发生在首屏窗口内；其中部分不是首屏结构所必需。
- 本轮优先小步优化小程序端首屏等待，不改后端接口。
- 验证通过：小程序 `bun test src/pages/__tests__/homePageLoading.test.ts`、`bun run type-check`、`bun run build:mp-weixin`、根目录 `git diff --check`。

## 2026-05-25 小程序登录 `/api/user/info` 500 排查

目标：修复小程序点击登录后 `/api/user/info` 返回 500，错误为数据库缺少 `rs_user_info.password_hash` 列。

阶段：
1. [completed] 对照截图错误、后端 `/api/user/info` 查询链路和迁移文件
2. [completed] 确认当前数据库迁移状态：`20260523000200`、`20260523000300` 均为 pending
3. [completed] 执行 `sqlx migrate run`，应用两个非破坏性 schema 迁移
4. [completed] 验证迁移状态、`password_hash` 列存在、小程序静态类型检查通过

结论：
- 本次登录错误不是前端问题；后端代码已经读取 `password_hash`，但当前数据库还没应用 `20260523000300_user_role_account_credentials.sql`。
- 已应用迁移：`20260523000200_challenge_signup_limits`、`20260523000300_user_role_account_credentials`。
- 以后前端改动默认只跑 `bun run type-check`；除非用户明确要求，不再为了节约时间执行 `build:mp-weixin`。

## 2026-05-23 散人约队最少/最多人数配置

目标：散人约队支持后台和小程序配置每场最少成行人数、最多报名人数；小程序放在默认收起的高级设置中，未配置时按 `最少 = 人制 * 2`、`最多 = 人制 * 2 + 4`。

阶段：
1. [completed] 盘点后端、小程序、管理端现有人数/容量计算链路
2. [completed] 后端新增字段、默认规则、报名上限校验和测试
3. [completed] 管理端创建/编辑/列表/详情接入最少/最多人数
4. [completed] 小程序创建高级设置和详情展示接入最少/最多人数
5. [completed] 执行验证并同步工作文档

约束：
- `players_per_team` 继续表示赛制，不再兼作散人报名容量。
- 已报名人数超过新上限时允许后台保存，但禁止后续新增报名。
- 旧数据或未传配置时按默认规则计算，不做破坏性迁移。

## 2026-05-23 散人约队支付方式与支付截止

目标：创建散人约队时标题不再有默认值，并支持赛前支付/赛后支付两种方式；赛前支付报名后生成支付倒计时，超时未支付自动取消报名；赛后支付无倒计时，比赛结束后未支付发送系统内通知。

阶段：
1. [completed] 盘点后端 challenge/payment/notification 与小程序创建/详情现状
2. [completed] 后端优先补红测，覆盖支付方式、支付截止、支付成功回写、超时取消与赛后通知
3. [completed] 实现后端迁移、领域模型、仓储、支付接口和后台处理任务
4. [completed] 小程序创建页取消标题默认值，增加支付方式开关
5. [completed] 小程序详情页展示支付按钮、支付倒计时和支付状态
6. [completed] 执行后端与小程序验证，并同步工作文档

约束：
- 通知模块已存在，优先复用系统内通知能力。
- 赛前支付截止时间为 `min(报名时间 + 20 分钟, 比赛开始时间)`。
- 赛后支付不限制支付时间，但比赛结束后仍未支付要通知用户。
- 后端业务规则按 TDD 推进，保持六边形边界。

## 2026-05-23 管理后台能力对齐小程序审计

目标：读取当前后台管理、小程序和后端代码，梳理后台管理还缺哪些核心运营能力，尤其是发布比赛、创建比赛、活动、约队等能力不能弱于小程序。

阶段：
1. [completed] 读取根目录和管理端协作文档
2. [completed] 盘点管理端路由、页面和 service 能力
3. [completed] 盘点小程序创建比赛、发布约队、球队管理相关入口
4. [completed] 对照后端 `/api/admin` 与 `/api` 路由，区分 UI 缺失和后端接口缺失
5. [completed] 输出缺失功能清单、优先级和下一步实现建议

当前结论：
- 管理端已有活动创建/编辑、活动详情、报名管理、结算、约队列表/详情、散人报名创建、球队/球员管理等基础能力。
- 管理端缺口主要集中在：球队约队创建入口、约队接约/撮合入口、比赛创建时的主客队选择和比赛类型、签到配置创建/编辑、球队 Logo 上传、活动创建与小程序 MatchPublishForm 的字段能力对齐。
- 后端已有不少接口能力，部分缺口是管理端 UI/service 未接入；也有少数需要新增更适合后台运营的后端接口或 DTO。

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

## 2026-05-14 队员会员标识

目标：为球队内队员增加独立的“是否会员”标识，并在小程序与管理端队员信息展示/编辑处区分会员与普通队员。

阶段：
1. [completed] 盘点后端 `rs_team_members`、TeamMember DTO、仓储和前端队员管理入口
2. [completed] 后端新增 `rs_team_members.is_member` 并贯通 add/update/list 接口
3. [completed] 小程序队员添加、编辑、列表展示同步 `is_member`
4. [completed] 管理端队员详情与设置弹窗同步 `is_member`
5. [completed] 执行后端、小程序、管理端最小充分验证

约束：

- `team.is_vip` / `team_membership` 仍表示球队会员/球队续费，不与队员会员混用。
- 新字段挂在 `rs_team_members`，命名为 `is_member`。
- 前端普通 UI 修改不按 TDD；后端字段和接口行为需要补充或运行相关验证。

## 2026-05-15 小程序报名详情三栏头像列表

目标：保留比赛报名详情页“报名 / 请假 / 未报名”三栏状态，同时把人员列表调整回已有报名详情的轻量头像栈样式。

阶段：
1. [completed] 对照现有报名详情头像栈视觉语言
2. [completed] 将三栏人员展示从胶囊卡片改为叠放头像
3. [completed] 当前用户用描边和“我”标记突出
4. [completed] 点击头像后在对应区域显示姓名和状态，再点同一头像收起
5. [completed] 选中头像增加轻微放大和上浮动效
6. [completed] 执行小程序 `bun run type-check`

## 2026-05-15 后端部署与脚本修复

目标：提交并推送本轮小程序/后端/管理端改动，部署 Rust 后端到 out109。

阶段：
1. [completed] 执行提交前验证并提交推送业务改动
2. [completed] 确认本地部署 `.env` 已补充 Harbor 密码且不进入 Git
3. [completed] 运行部署脚本，构建并推送后端镜像
4. [in_progress] 修复部署脚本 nginx heredoc 引用问题并重新部署

## 2026-05-15 小程序散人约队报名页对齐比赛报名

目标：散人约队详情中的报名页对齐比赛报名页风格和操作，只是不展示球队三栏状态卡。

阶段：
1. [completed] 散人约队单独分流，球队约队详情保持原结构
2. [completed] 新增比赛报名式散人个人报名视图
3. [completed] 报名/取消报名操作收敛到报名截止卡内部
4. [completed] 散人约队详情页标题改为“比赛报名”
5. [completed] 执行小程序 `bun run type-check`

## 2026-05-15 场馆角色与约队发布权限

目标：新增“场馆”发布主体/角色，使场馆也可以发布球队约队和散人约队，同时保留现有队长/领队发布权限。

阶段：
1. [completed] 阅读根目录、小程序、后端、管理端协作文档与现有工作文档
2. [completed] 盘点小程序约队大厅、发布入口、球队上下文与散人约队创建页
3. [completed] 盘点后端 challenge 创建 DTO、use case、repository 与数据库约束
4. [completed] 盘点用户/球员管理字段和管理端可编辑入口
5. [completed] 按方案 B 新增用户级 `is_venue` 叠加身份
6. [completed] 后端允许场馆用户在不绑定球队的情况下发布球队约队和散人约队
7. [completed] 小程序发布入口、创建页和约队详情同步场馆权限
8. [completed] 管理端球员列表/编辑弹窗支持查看和维护场馆身份
9. [completed] 执行后端、小程序、管理端最小充分验证

约束：

- `is_venue` 是用户的附加身份，不与球员/队员身份互斥；场馆用户仍可报名散人约队和参与现有球队/活动流程。
- `host_team_id = NULL` 只表示场馆发布；`host_team_id = Some(team_id)` 仍沿用队长/领队权限。
- 场馆发布的球队约队采用两阶段撮合：第一支球队报名后继续保持 `open`，写入 `host_team_id` 并生成“等待对手”的活动；第二支球队接约后更新同一活动为 `home_team_id vs away_team_id`。

## 2026-05-15 小程序当前发布身份切换

目标：在小程序“我的”页新增当前身份切换，让用户可在可管理球队身份和场馆身份之间切换；约队创建统一读取当前身份决定是否传 `host_team_id`。

阶段：
1. [completed] 盘点 `appSession`、当前球队切换、我的页头像卡和约队创建页
2. [completed] 新增当前身份 view model、派生规则和本地持久化
3. [completed] 在“我的”页 `MineHeroProfile` 增加当前身份切换 UI
4. [completed] 约队大厅发布权限改为读取 `currentIdentity`
5. [completed] 球队约队与散人约队创建页统一读取 `currentIdentity`，球队身份传 `host_team_id`，场馆身份不传
6. [completed] 更新小程序目标测试并执行类型检查

约束：

- 当前身份只表达“发布主体”，只包含可管理球队和场馆；普通队员参与报名仍走当前球队/当前用户，不需要切换成发布身份。
- 用户选择场馆身份后，切换当前球队不会自动覆盖场馆身份；用户选择球队身份后，切换到另一支可管理球队会跟随到该球队身份。

## 2026-05-15 我的页钱包接口性能拆分

目标：排查 `/api/order/my-billing-flow` 耗时原因，避免该重接口阻塞小程序“我的”页首屏和“我的钱包”卡片展示。

阶段：
1. [completed] 定位小程序“我的”页是否调用 `getMyBillingFlow`
2. [completed] 定位后端 `/api/order/my-billing-flow` handler/use case/repository
3. [completed] 检查当前数据库执行计划和账单相关索引
4. [completed] 新增最近流水查询复合索引迁移
5. [completed] “我的”页钱包卡片移除 `getMyBillingFlow`，只保留余额摘要和查看账单入口
6. [completed] 保留账单二级页继续加载明细流水
7. [completed] 执行后端 schema 测试、小程序目标测试、类型检查和迁移

约束：

- `/api/order/my-billing-flow` 仍用于账单明细页；本轮不改变接口返回结构，避免影响管理端或已有账单页面。
- “我的”页只调用轻量 `/api/account/balance` 展示余额和累计扣费，明细放到 `/pages/billing/index` 二级页。

## 2026-05-15 首页约队机会排序与详情跳转

目标：修正小程序首页“约队机会”列表顺序，并支持点击任意约队卡片进入约队详情。

阶段：
1. [completed] 定位首页约队机会数据来源与卡片组件
2. [completed] 将首页约队列表请求从信用分排序改为比赛时间倒序
3. [completed] 在前端过滤运行配置后再次按日期和开始时间倒序排序，再截取首页展示数量
4. [completed] 给首页约队卡片增加点击事件并跳转 `/pages/challenges/detail`
5. [completed] 更新小程序静态测试并执行目标测试、类型检查和小程序构建

约束：

- 本轮只改小程序首页展示和跳转，不改变约队大厅排序筛选和后端接口结构。
- 日期倒序按 `holding_date` 降序，同一天再按 `start_time` 降序。

## 2026-05-15 小程序首页配色微调

目标：在不改变页面结构、模板和业务逻辑的前提下，把首页从“纯黑 + 荧光绿”的高刺激配色调整为更耐看的暖黑/草地绿/雾灰体系。

阶段：
1. [completed] 先制作静态配色稿 `docs/home-color-preview.html`
2. [completed] 用户确认只改配色，不改代码结构
3. [completed] 调整首页背景、banner、比赛卡片、约队机会和球队数据卡配色
4. [completed] 执行小程序类型检查、构建和空白差异检查

约束：

- 只修改样式颜色相关值，不改模板结构、脚本逻辑、接口、排序、跳转或组件边界。

## 2026-05-15 小程序首页字体排版微调

目标：在已确认的首页配色基础上，优化字体层级，让页面从“全部极粗”变为标题、正文、标签和按钮各有不同权重。

阶段：
1. [completed] 复制配色稿并制作字体排版静态稿 `docs/home-typography-preview.html`
2. [completed] 用户确认字体排版方向
3. [completed] 调整首页标题、banner、比赛卡、约队卡和数据卡的字号、字重与行高
4. [completed] 执行小程序类型检查、构建和空白差异检查

约束：

- 不引入自定义字体；只使用系统字体并调整 `font-size`、`font-weight`、`line-height` 和 `letter-spacing`。
- 不改模板结构、脚本逻辑、接口、排序、跳转或组件边界。

## 2026-05-15 散人报名详情重复标签移除

目标：移除散人约队详情页 header 下方重复的“散人报名”胶囊，保留顶部 header 作为页面身份表达。

阶段：
1. [completed] 定位重复区域在 `ChallengeIndividualRegistration.vue`
2. [completed] 增加静态测试约束散人报名组件不再渲染重复 tabs
3. [completed] 删除重复 tabs 模板和对应样式
4. [completed] 执行目标测试、小程序类型检查、构建和空白差异检查

约束：

- 不改变散人报名卡片、报名/取消报名逻辑、接口和页面 header 标题。

## 2026-05-16 微信手机号响应解析修复

目标：修复小程序编辑资料时 `/api/wx/getPhoneNumber` 获取手机号失败的问题。

阶段：
1. [completed] 定位后端 wx 模块调用链
2. [completed] 用单元测试复现微信 `phone_info.phoneNumber` 响应无法解析
3. [completed] 修复微信手机号响应 DTO 的 camelCase 映射
4. [completed] 增强手机号响应解析失败日志，保留 status、content-type、body 摘要
5. [completed] 修复 `errcode=0, errmsg=ok` 成功响应误判
6. [completed] 配置 out109 飞书健康告警，连续失败 3 次才发送
7. [completed] 执行后端目标测试和 clippy

约束：

- 不改变小程序对本系统 API 的 `phone_number` 字段契约。
- 不改前端调用与用户资料保存逻辑。

## 2026-05-17 首页 onShow 策略改造（A 方案）

目标：上一轮"`shouldSkipNextShowRefresh` 单点跳过"补丁未能消除"进入比赛详情再返回首页"的抖动；本轮改造为事件驱动 + 遮蔽时长阈值（A 方案），并接入下拉刷新作为用户主动出口。

阶段：
1. [completed] 调研：首页数据来源、影响首页的详情页 mutation、事件总线现状、pages.json、被钉死的测试断言
2. [completed] 首页 `index.vue`：移除 `shouldSkipNextShowRefresh`；新增 `hiddenAt` / `pendingReloadFromEvent` / `HIDDEN_RELOAD_THRESHOLD_MS = 2 * 60 * 1000`；`onShow` 改为三分支策略；`onHide` 记 `hiddenAt` 并同步清 `navigatingMatchId`
3. [completed] 详情页 emit `home:data-may-changed`：比赛详情 6 处 + 约队详情 3 处
4. [completed] `pages.json` 首页接入下拉刷新；`onPullDownRefresh` await `loadPageData` 后 `stopPullDownRefresh`
5. [completed] 测试断言同步：替换 `shouldSkipNextShowRefresh` 钉死的两条断言，新增 `enablePullDownRefresh` 断言
6. [completed] 验证：`bun run type-check`、`bun test src/pages/__tests__/homePageLoading.test.ts`、`bun test`

约束：

- 不做局部 patch，事件不带 payload；统一靠 `onShow` reload 配合下拉刷新
- 未覆盖的低频 mutation 依赖时间窗口和下拉刷新兜底
- 不修改后端

## 2026-05-17 小程序资料页手机号绑定运行配置

目标：把资料页“需要绑定手机号”做成后端小程序运行配置，默认不展示手机号绑定区域，也不触发绑定提交。

阶段：
1. [completed] 后端 `mini_app` runtime config 新增 `profile.require_phone_binding`
2. [completed] 后端默认值为 `false`，并兼容旧 JSON 缺少 `profile` section 的存量配置
3. [completed] 小程序运行配置类型、默认值和 sanitize 同步 `profile.require_phone_binding`
4. [completed] 资料页按配置显示手机号输入/微信绑定按钮，并且只有配置开启时才提交手机号绑定
5. [completed] 执行前后端最小充分验证

约束：

- 复用已有 `/api/system/mini-app-runtime-config`，不新增接口。
- 只做用户侧显示/提交门控，不新增后台配置编辑 UI。

## 2026-05-17 管理端活动报名与散人报名拆分

目标：管理端“活动报名”只展示球队报名派生活动，新增“散人报名”入口展示散人约队报名进展，避免把 `activity.match_kind=internal` 误当成散人报名。

阶段：
1. [completed] 读取小程序散人约队发布和报名链路，确认散人报名走 `rs_challenges.kind = 'individual'` 与 `rs_challenge_individual_acceptances`
2. [completed] 后端活动列表新增 `registration_scope=team|direct` 过滤
3. [completed] 后端约队列表新增 `kind=team|individual` 过滤
4. [completed] 管理端新增“散人报名”菜单和路由，并复用约队列表按 `kind=individual` 查询
5. [completed] 执行后端与管理端验证

## 2026-05-17 管理端约队/散人报名编辑删除

目标：后台管理中为约队管理和散人报名提供编辑与删除能力；删除采用取消状态，不做物理删除。

阶段：
1. [completed] 后端补充管理员编辑和取消的业务测试
2. [completed] 后端新增 `PATCH /api/admin/challenges/:id`，并允许管理员取消 open 约队
3. [completed] 管理端列表页和详情页增加编辑/删除入口
4. [completed] 抽离 `ChallengeEditDialog` 与 `ChallengeCancelDialog`，避免列表/详情重复堆叠表单逻辑
5. [completed] 执行后端与管理端验证

约束：

- 仅允许编辑/取消 `open` 状态记录。
- 超管可处理全部 open 约队；普通管理员只处理自己被分配球队相关的 open 约队；无球队主体的记录仅超管可处理。
- 编辑字段限定为标题、时间、场地、坐标、人数、费用和备注，不改变类型、主客队、报名关系或关联活动。

## 2026-05-17 后台创建散人报名

目标：散人报名后台页面补齐创建入口，由超管指定发布用户后创建 `kind=individual` 的散人局。

阶段：
1. [completed] 后端新增超管代用户创建散人报名业务测试
2. [completed] 后端创建命令和 DTO 增加可选 `host_user_id`
3. [completed] 后端限制管理员创建仅支持 `individual`，且必须指定场馆发布用户
4. [completed] 管理端散人报名页新增“创建散人报名”按钮和表单
5. [completed] 执行后端、管理端验证
6. [completed] 修复管理端 `ChallengeEditDialog` 表单宽度和间距，避免编辑/创建弹窗控件收缩错位

约束：

- 管理员账号不直接写入 `rs_challenges.host_user_id`；后台创建必须指定小程序用户 ID。
- 普通管理员不能创建；超管可创建。
- 后台创建只支持散人报名，不复用为球队约队创建入口。

## 2026-05-17 散人报名详情展示报名人员

目标：管理端散人报名详情页展示已报名人员头像和名称，帮助运营直接核对报名名单。

阶段：
1. [completed] 核对后端详情接口，确认 `ChallengeDetailDto.individual_participants` 已存在
2. [completed] 管理端 challenge service 补充报名人员类型
3. [completed] 管理端详情页新增“报名人员”卡片，展示头像、名称和用户 ID
4. [completed] 后端仓储测试覆盖详情返回完整报名名单，并移除详情名单 12 人限制
5. [completed] 执行后端目标测试、编译检查和管理端验证
6. [completed] 散人报名列表卡片增加报名人员预览头像和昵称

## 2026-05-19 活动报名列表为空修复

目标：修复管理后台活动报名页传 `registration_scope=team` 后漏掉东安洺悦联队等直接球队活动的问题。

阶段：
1. [completed] 对照管理端请求参数、后端 SQL scope 条件和当前数据库活动数据
2. [completed] 新增后端仓储回归测试，复现 `home_team_id` 有值但 `source_activity_id` 为空时被过滤
3. [completed] 将 team scope 调整为有主队或客队的活动
4. [completed] 同步管理端/后端注释与页面描述
5. [completed] 执行后端目标测试、`cargo check --tests`、管理端 `bun run type-check`

## 2026-05-19 活动详情编辑球服颜色

目标：管理端活动详情编辑弹窗支持设置主队和客队球服颜色，对齐小程序发布表单体验。

阶段：
1. [completed] 确认后端和管理端已有 `color` / `opposing_color` 字段
2. [completed] 复用管理端已有颜色选择样式，在详情编辑弹窗增加主队/客队球服色块选择
3. [completed] 保存详情编辑时提交 `color` / `opposing_color`
4. [completed] 将活动列表和详情编辑共用颜色常量与颜色标准化 helper
5. [completed] 执行管理端类型检查和 diff 检查

## 2026-05-19 活动报名列表信息补全

目标：管理端活动报名列表卡片直接展示双方球队球服颜色、比赛时间、报名开始/结束时间和报名截止倒计时。

阶段：
1. [completed] 确认活动列表接口已返回 `color` / `opposing_color` / `holding_date` / `start_time` / `end_time`
2. [completed] 明确 `holding_date` 为比赛时间，`start_time` / `end_time` 为报名窗口
3. [completed] 在活动报名列表卡片补充比赛时间、报名时间、截止倒计时和主客队球服色块
4. [completed] 倒计时改为基于分钟 tick 自动刷新，过期显示“已截止”
5. [completed] 本地页面确认列表密度与文案，执行管理端 `bun run type-check` 和根目录 `git diff --check`

## 2026-05-19 小程序球队活动报名取消人数上限

目标：球队活动的个人报名不再按 `players_per_team + 2` 限制最大报名人数，详情页 `/人数` 仅表示最低成行人数。

阶段：
1. [completed] 定位比赛报名详情容量逻辑在 `pages/matches/useMatchDetailPage.ts`
2. [completed] 红测复现 `requiredPlayers + 2` 和 `/上限` 展示仍存在
3. [completed] 移除前端容量上限计算和“本场已满员”拦截
4. [completed] 报名截止卡保留 `已报 N / 最低成行人数`，文案改为“已达成行人数”
5. [completed] 执行小程序目标测试、类型检查和 diff 检查

## 2026-05-20 后端球队活动报名取消人数上限

目标：后端个人报名接口不再按 `players_per_team + 2` 拒绝球队活动报名，保持前后端规则一致。

阶段：
1. [completed] 定位小程序报名接口调用 `/activity/:id/my-stand`
2. [completed] 定位后端 `ManageRegistrationUseCase` 中的 `players_per_team + 2` 容量校验
3. [completed] 新增后端红测复现超过 `players_per_team + 2` 后仍应允许报名
4. [completed] 移除后端容量校验和无用 `is_capacity_stand` helper
5. [completed] 执行后端目标测试、编译检查和 diff 检查

## 2026-05-20 小程序比赛报名底部状态按钮

目标：将队员报名状态的三个按钮合并为底部固定横条按钮，点击后弹出报名/请假选项。

阶段：
1. [completed] 定位 `TeamMemberRegistrationBoard` 中的三按钮操作区
2. [completed] 根据当前用户状态计算底部按钮文案和颜色
3. [completed] 未报名/已请假时弹出“我要报名 / 我要请假”
4. [completed] 已报名时弹出“取消报名（请假）”，并提交请假状态
5. [completed] 执行小程序目标测试、类型检查和 diff 检查

## 2026-05-20 小程序球队报名 Wot UI v2 Dialog

目标：球队报名底部按钮改用 Wot UI v2 的 confirm Dialog，支持右上角关闭按钮，并按未报名、已报名、已请假三种状态展示对应操作。

阶段：
1. [completed] 安装 Wot UI 官方 skills 到小程序 `.agents/skills`
2. [completed] 将小程序 Wot 依赖从 `wot-design-uni@1.x` 升级为 `@wot-ui/ui@2.x`
3. [completed] 更新 `pages.json` easycom 到 `@wot-ui/ui`
4. [completed] 将队员报名弹窗改为 `<wd-dialog /> + useDialog().confirm()`
5. [completed] 按 v2 `wd-picker` 数组 model 调整已有 picker 绑定
6. [completed] 执行小程序目标测试、类型检查和微信小程序构建

补充：

- Wot UI v2 迁移保留。
- 队员报名状态弹窗这一处，最终已从 `wd-dialog + useDialog().confirm()` 收口为页面内自定义业务弹窗，以提高风格一致性和可控性。

## 2026-05-20 小程序球队报名 Dialog 视觉与锁滚动

目标：让队员报名弹窗风格贴合比赛报名页，并避免弹窗打开后背景继续滑动。

阶段：
1. [completed] 确认 Wot Dialog 底层 Popup 默认锁滚动在当前函数式调用里不够稳定
2. [completed] 给队员报名弹窗增加本页面专属圆角、底色、按钮和关闭按钮样式
3. [completed] 将弹窗可见状态上抛到详情页根节点，并用 `page-meta` 锁定整页滚动
4. [completed] 执行小程序目标测试、类型检查、微信小程序构建和 diff 检查

## 2026-05-20 报名头像展示收口

目标：让报名截止卡展示全部已报名队员头像，并让三栏状态区头像更大且无边框。

阶段：
1. [completed] 去掉报名截止卡头像预览的前 5 人截断
2. [completed] 放大报名截止卡头像并支持换行展示
3. [completed] 移除三栏状态头像的边框高亮，只保留选中放大
4. [completed] 执行目标静态测试

## 2026-05-20 比赛报名下半区职责重构

目标：把比赛报名详情页下半区从“三块同时展开”改成“切换式状态操作面板”，让上方负责全局概览，下方负责状态查看和操作。

阶段：
1. [completed] 将 `TeamMemberRegistrationBoard` 标题收口为“队员状态”，右上角摘要改为总人数
2. [completed] 用 `已报名 / 请假 / 未报名` 状态切换条替代三块同时展开区域
3. [completed] 默认按当前用户所在分组选中，并只展示当前选中分组头像
4. [completed] 保留头像放大与昵称显示，并与底部浮动操作按钮共存
5. [completed] 补充目标静态测试约束并执行小程序验证

## 2026-05-20 小程序微信 CI 本地上传工具

目标：为 `registration_system_mini` 和 `football_insight_mini` 接入一套共享的微信官方 `miniprogram-ci` 本地 CLI，并在各项目内提供最短命令。

阶段：
1. [completed] 设计共享 CLI + 项目内短命令封装方案
2. [completed] 在本机共享目录实现 `preview` / `upload` CLI
3. [completed] 为两个小程序项目接入 `mp:preview` / `mp:upload`
4. [completed] 补齐 README 和 `.env.ci.local.example`
5. [completed] 用真实私钥验证两项目 CI 链路并记录阻塞点

## 2026-05-20 小程序审核态创建球队与版本统一

目标：创建球队页支持按 mini_review 审核状态切换审核版表单，并确保线上查询版本与 mp:upload 写入 mini_review 的版本完全一致。

阶段：
1. [completed] 盘点现有版本来源、mini_review 查询接口和创建球队页面结构
2. [completed] 构建前用 `.env.ci.local` 版本覆盖 `manifest.json`
3. [completed] 小程序新增 mini_review 审核状态查询封装
4. [completed] 创建球队页接入审核态，审核态下名称改为预置下拉、隐藏球队介绍
5. [completed] 收口 `mp:upload` 版本闭环：实际上传版本、mini_review 记录版本、本地 manifest/generated version 成功后保持一致
6. [completed] 将 mini_review 提升为小程序启动基础状态，并在审核态下全局隐藏创建比赛/散人约球/创建球队/发布约队入口
7. [in_progress] 执行类型检查、必要构建和工作文档同步

## 2026-05-20 小程序审核态隐藏我的钱包

目标：审核状态下，“我的”页面不展示“我的钱包”业务入口。

阶段：
1. [completed] 定位“我的钱包”入口为 `pages/user/index.vue` 中的 `MineWalletSection`
2. [completed] 复用现有 `miniReview` 全局审核态开关隐藏钱包卡片
3. [completed] 补充目标静态回归测试
4. [completed] 执行目标测试和类型检查

## 2026-05-20 后端球员列表 bigint/text 500 修复

目标：修复管理后台球员列表接口因球队 ID 类型不匹配导致的 500。

阶段：
1. [completed] 定位错误 SQL 与球队 ID 数字化迁移遗留 cast
2. [completed] 修复球员列表 count/page/team summary 查询
3. [completed] 同步球员球队摘要 DTO 类型
4. [completed] 增加回归测试并完成后端验证

## 2026-05-20 小程序首页装修配置

目标：后台管理支持配置小程序首页“约球开踢”卡片的文字和图片；当配置多条时，小程序首页该位置支持轮播展示。

阶段：
1. [completed] 确认现有小程序运行配置、后台系统设置页面和首页 hero 卡片链路
2. [completed] 后端 `mini_app` 运行配置新增 `home.hero_banners` 并保持旧 JSON 兼容
3. [completed] 管理后台系统设置增加“小程序装修”配置区，可维护多条首页卡片
4. [completed] 小程序首页读取 `hero_banners`，单条展示、多条轮播，空配置保留默认卡片
5. [completed] 执行后端、管理端、小程序最小充分验证

约束：
- 按用户要求实现顺序为后端和管理后台优先，小程序最后接入。
- 复用已有 `/api/system/mini-app-runtime-config` 与 `/api/admin/system/mini-app-runtime-config`，不新增独立装修表。
- 当前工作区已有多处未提交改动，本轮只处理装修配置相关文件，不回滚之前改动。

## 2026-05-20 小程序首页装修图片上传

目标：后台管理系统支持上传首页装修图片，图片上传到 MinIO，上传成功后回填到装修卡片图片地址。

阶段：
1. [completed] 复用后端现有 MinIO 上传 helper，新增后台系统上传接口
2. [completed] 管理端 service 增加 multipart 上传封装
3. [completed] 小程序装修面板增加每条卡片的“上传图片”按钮，成功后回填 `image_url`
4. [completed] 执行后端和管理端验证

## 2026-05-20 管理端 UI 规范化首轮落地

目标：先不引入 shadcn，在现有 Tailwind + DaisyUI 体系上建立一组更克制的管理端 UI 基础类，并优先迁移系统设置页。

阶段：
1. [completed] 评估管理后台现有技术栈与系统设置页视觉问题
2. [completed] 在管理端全局 CSS 中新增 `admin-*` 基础样式类
3. [completed] 将 `SystemSettings.vue` 迁移为更紧凑的管理后台页面结构
4. [completed] 将 `MiniAppDecorationPanel.vue` 对齐新的 panel、field、label 规范
5. [completed] 通过浏览器检查修复保存条 sticky 错位和深色主题文字不可读问题
6. [completed] 执行管理端类型检查、目标单测、构建和 diff 检查

约束：
- 本轮不引入 shadcn/shadcn-vue。
- 管理端继续使用 DaisyUI + Tailwind，只先形成轻量规范类。
- 首轮只迁移系统设置页，避免一次性重做全部后台页面。

## 2026-05-23 管理端复用现有后端接口补齐

目标：只改管理后台前端，接入后端已经支持但管理端尚未暴露的可复用能力。

阶段：
1. [completed] 确认可复用接口边界，后台 admin 创建约队后端当前仅允许散人报名，球队约队创建不做假入口
2. [completed] 活动创建/编辑接入主队、客队、比赛类型字段
3. [completed] 活动创建接入球队签到初始配置，活动详情接入签到配置编辑
4. [completed] 球队详情编辑弹窗接入球队 Logo multipart 上传并回填 URL
5. [completed] 执行管理端 `bun run type-check` 和目标 `git diff --check`

约束：
- 本轮只修改 `registration_system_backend_fe` 前端文件，不改 Rust 后端和小程序。
- 当前工作区已有多处未提交改动，本轮不回滚无关改动。

## 2026-05-24 后端队长/场馆角色账号管理

目标：后端支持超级管理员创建队长、场馆两类小程序角色用户，设置账号密码，并能对这些角色用户冻结/解冻和修改密码。

阶段：
1. [completed] 梳理现有用户、管理员、队长和场馆模型
2. [completed] 新增用户账号密码字段、角色创建命令和账号密码登录能力
3. [completed] 场馆创建写入 `is_venue`，队长创建绑定球队 `captain_id` 与 `rs_team_members.role='captain'`
4. [completed] 新增超管创建角色用户、修改角色用户密码接口，并支持球员列表按 `role=venue|captain` 筛选
5. [completed] 补充角色用户业务测试并完成后端验证

约束：
- 队长身份仍沿用现有球队模型，不新增 `is_captain` 用户字段。
- 冻结/解冻复用既有球员冻结接口。
- 当前工作区已有多处未提交改动，本轮只处理后端角色账号相关文件，不回滚无关改动。

## 2026-05-25 小程序比赛报名页色彩层级优化

目标：小程序比赛报名页中，报名模式标题与底部报名按钮分离色彩职责，去掉标题外层灰色包裹。

阶段：
1. [completed] 定位小程序 `pages/matches/detail.vue` 报名模式栏样式
2. [completed] 报名模式栏改为透明外层、深色当前态
3. [completed] 保留底部报名/修改状态为荧光绿主按钮
4. [completed] 执行小程序 `bun run type-check`

约束：
- 本轮只改小程序视觉样式，不涉及后端接口、管理端或业务状态流。
- 当前工作区已有多处未提交改动，本轮不回滚无关改动。

## 2026-05-27 小程序首页请求收口

目标：首页只保留两类数据：当前球队接下来的活动，以及当前时间之后开始的约队比赛；球队数据移到统计页，首页不再展示。

阶段：
1. [completed] 后端活动列表增加 `team_id` 查询参数，并修正统计 count 的过滤优先级
2. [completed] 后端约队列表增加 `starts_after` 查询参数，支持过滤未来开始的约队
3. [completed] 小程序首页活动请求改为传 `teamId`，约队请求改为全量未来约队，不再传当前球队过滤
4. [completed] 移除首页球队资料卡与球队数据摘要展示，保留统计页承载球队数据
5. [completed] 会话初始化不再请求 `/api/teams/:id` 完整详情，球队管理页按需懒加载详情
6. [completed] 执行后端和小程序 focused 验证

约束：
- 当前工作区已有大量非本轮未提交改动，本轮只处理首页请求链路相关文件，不回滚无关改动。
- 首页约队机会按 `start_time > 当前时间` 查询，页面端仍保留运行配置可见性过滤作为兜底。
- `/api/teams/my-teams` 现在额外返回当前用户在球队内的角色、加入时间和成员数量，供首页/身份选择判断管理权限。

## 2026-05-27 `/api/activity/infos` 性能排查

目标：确认首页活动列表接口慢点是在本地 HTTP、应用层还是远端 PostgreSQL 链路，并在不改变接口语义的前提下做首轮低风险优化。

阶段：
1. [completed] 复测 `127.0.0.1:18080/api/activity/infos` 的端到端耗时，确认不是浏览器到本机的网络问题
2. [completed] 对后端 3 条 activity list SQL 做 `EXPLAIN ANALYZE`
3. [completed] 检查当前 `DATABASE_URL` 和 `jd/peiqian` 实际 5432 拓扑
4. [completed] 将串行 3 次数据库查询改为并发执行，减少远端数据库往返等待
5. [completed] 执行 `cargo check --tests` 与 `activity_repository_scope_test`
