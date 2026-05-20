# 小程序真实接口接入审计进度

## 日志

- 开始审计：扫描小程序功能是否接入后端真实接口。
- 完成第一轮小程序静态扫描：当时发现多数页面调用 `src/api`，但仍有“队长代报名接口待接入”和底部导航“待接入”提示。
- 完成后端 `/api/*` 路由扫描：当时小程序侧后端能力覆盖较多，但 `/api/system` 未挂载，管理专用活动代报名仍只在 `/api/admin/activities`。
- 完成页面功能对照：当时主页面数据基本接真实接口，但球队报名、签到 UI、球队创建/加入/成员管理、支付/会员充值、手机号等功能未完整接入。
- 补充扫描“待接入/mock/TODO”关键字：当时确认创建球队入口为占位 toast，比赛详情队长代报名为占位提示。
- 早期错误记录：曾在根目录执行 `git status` 失败并判断为非根仓库；当前工作区已是根目录统一管理的 monorepo Git 仓库，以根目录状态为准。
- 实现创建/加入球队页面，接入 `createTeam`、`searchTeams`、`joinTeam`、`getTeamPasswordInfo`。
- 实现队长代报名：小程序调用 `submitTeamRegistration`，后端新增 `/api/activity/:activity_id/team-registration`。
- 实现比赛签到入口：比赛详情页调用 `submitActivityCheckIn` 与当前位置 store。
- 实现会员续费入口：我的页调用 `createTeamMembershipOrder`、`requestWxPayment`、`syncPaymentOrderStatus`。
- 验证：
  - 小程序目标测试 15 passed。
  - 小程序 `bun run type-check` 通过。
  - 后端 `cargo check` 通过。
  - 后端 `cargo test --test activity_checkin_service_business_test` 5 passed。
  - 后端 `cargo test --test remaining_team_activity_routes_test` 4 passed。
- 追加剩余功能计划：手机号绑定、球队成员管理、赛后互评/队费复盘、签到配置修改、钱包订单、地图/系统配置。
- 新增剩余功能集成测试并确认 RED：5 个功能组测试失败，证明当前缺口可被测试捕获。
- 实现剩余功能：手机号绑定、队员管理、赛后互评、签到配置修改、钱包充值/订单、后端地图位置路由与小程序位置反查。
- 验证：小程序目标测试 30 passed；小程序 type-check 通过；后端 cargo check 通过；activity_checkin_service_business_test 5 passed；remaining_team_activity_routes_test 4 passed。
- 后续状态同步：小程序已接入 `/api/system/mini-app-runtime-config` 等系统配置能力；早期 `/api/system` 未挂载的发现已过时。
- 后续状态同步：`home`、`matches/detail`、`teams/manage`、`activities` 已完成一轮 SFC 拆分，新的结构规范见 `registration_system_mini/docs/mini-architecture.md`。
- 后续状态同步：当前小程序全量 `bun test` 为 109 pass / 0 fail，`bun run type-check` 与 `bun run build:mp-weixin` 通过。
- 2026-05-13：开始整理当前版本产品说明书、技术说明书、数据库关联关系文档。
- 2026-05-13：读取根目录与三个子项目的 `AGENTS.md`、`CLAUDE.md`，确认文档、架构和验证约束。
- 2026-05-13：盘点后端路由、迁移、domain/application/use case、前端 routes/pages/services/api。
- 2026-05-13：确认当前后端 `/api/admin/*` 和 `/api/*` 的模块挂载关系。
- 2026-05-13：确认后端支持 MinIO/S3 兼容上传配置，头像上传当前直接写入 MinIO。
- 2026-05-13：新增 `docs/product-spec-current.md`，按用户侧、管理端、后端能力梳理已完成/未完成/待产品讨论项。
- 2026-05-13：新增 `docs/technical-spec-current.md`，梳理 monorepo、技术栈、后端六边形架构、前端结构、接口前缀、存储、外部服务、权限和技术债。
- 2026-05-13：新增 `docs/database-relations-current.md`，按表族、外键关系、Mermaid ER 图和 schema 风险整理数据库关联。
- 2026-05-13：用户确认球队 ID 目标形态为数据库自增数字 ID。
- 2026-05-13：新增球队 ID 数字化迁移计划 `docs/superpowers/plans/2026-05-13-team-id-bigserial-migration.md`。
- 2026-05-13：已完成 `registration_system_rs/migrations/20260513000100_team_id_bigserial.sql`，将球队主键和全部球队引用列切到 `BIGINT`，并保留 `rs_teams.legacy_id`。
- 2026-05-13：已新增 `registration_system_rs/tests/team_id_numeric_schema_test.rs`，验证球队相关列为 `bigint`，并验证 `rs_user_billings.activity_id -> rs_activity(id)` 外键存在。
- 2026-05-13：已完成后端 `i64`、小程序 `number`、管理端 `number` 的球队 ID 类型同步。
- 2026-05-13：已重新更新产品说明书、技术说明书和数据库关联关系文档，去掉球队 ID “待实施”的过期描述。
- 2026-05-13：已完成 `registration_system_rs/migrations/20260513000200_rename_user_billings_game_id_to_activity_id.sql`，将 `rs_user_billings.game_id` 统一为 `activity_id` 并补齐外键。
- 2026-05-13：已完成 `registration_system_rs/migrations/20260513000300_unify_billing_activity_terms.sql`，统一 billing 领域命名到 activity，并清空开发库旧订单/账单/结算数据，重置账户汇总。
- 2026-05-13：已在根目录 `AGENTS.md` / `CLAUDE.md` 中写入复杂任务默认采用 `planning-with-files`，并持续维护 `task_plan.md`、`findings.md`、`progress.md` 的规则。
- 2026-05-13：已在 `registration_system_rs`、`registration_system_mini`、`registration_system_backend_fe` 的 `AGENTS.md` / `CLAUDE.md` 中同步写入同类约束。
- 2026-05-13：按用户要求，本轮未新增检查脚本，仅先落地规范层和流程层。
- 2026-05-13：执行后端全量验证，`cargo clippy --all-targets -- -D warnings` 初次失败，原因是若干 `.bind(&team_id)` 风格问题；已修复。
- 2026-05-13：执行后端全量 `cargo test` 时发现 `remaining_team_activity_routes_test` 使用了过期字符串 `team_id` 测试数据，已改为数字 `team_id`。
- 2026-05-13：修复后重新验证通过：`cargo clippy --all-targets -- -D warnings`、`cargo test`。
- 2026-05-13：开始收口 billing/order schema 与 payment 结算边界，先重新核对 `PaymentBillingPort`、`rs_recharge_records`、`rs_team_membership_orders` 和现有迁移。
- 2026-05-13：确认 `transaction_no` 同时用于支付回调和后台手工充值，不能直接改成支付订单外键；改为新增专用 `payment_order_no` 物理关联列。
- 2026-05-13：将 `PaymentBillingPort` 重命名为 `PaymentSettlementPort`，并把 `PostgresPaymentBillingAdapter` 重命名为 `PostgresPaymentSettlementAdapter`。
- 2026-05-13：调整 `HandlePaidOrderUseCase`，使已支付订单在再次同步/回调时仍可进入结算逻辑，由持久化层负责幂等拦截，避免“订单已 paid 但未完成入账”无法自愈。
- 2026-05-13：新增迁移 `registration_system_rs/migrations/20260513000400_payment_settlement_guards.sql`，为 `rs_recharge_records` 增加 `payment_order_no` 外键和唯一索引，并为 `rs_team_membership_orders.transaction_id` 增加唯一索引。
- 2026-05-13：新增测试 `payment_settlement_schema_test.rs`、`payment_settlement_adapter_postgres_test.rs`，验证 schema 收口和充值入账幂等性。
- 2026-05-13：首次真实数据库幂等测试失败，原因是对部分唯一索引使用了 `ON CONFLICT (payment_order_no)`；已改为普通唯一索引后通过。
- 2026-05-13：执行 `sqlx migrate run`，新迁移 `20260513000400_payment_settlement_guards` 已成功应用。
- 2026-05-13：验证通过：`cargo test --test payment_service_business_test --test payment_settlement_schema_test --test payment_settlement_adapter_postgres_test -- --nocapture`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。
- 2026-05-14：开始收口 `rs_activity_order` 命名，确认它是活动费用快照而非支付订单。
- 2026-05-14：新增并验证红测 `activity_fee_snapshot_schema_test`，要求 `rs_activity_fee_snapshots` 替代 `rs_activity_order` 并保留到 `rs_activity(id)` 的外键。
- 2026-05-14：新增迁移 `20260514000100_rename_activity_order_to_fee_snapshots.sql`，执行 `sqlx migrate run` 成功应用。
- 2026-05-14：后端 billing 领域、application、ports、Postgres repository、web DTO/OpenAPI 收口为 `ActivityFeeSnapshot` / `UpsertActivityFeeSnapshot`。
- 2026-05-14：管理端 dashboard/service 改为 `listActivityFeeSnapshots` 和 `费用快照` 指标。
- 2026-05-14：验证通过：`cargo fmt --check`、`cargo test --test activity_fee_snapshot_schema_test -- --nocapture`、`cargo check --tests`、`sqlx migrate run`、`cargo clippy --all-targets -- -D warnings`、`cargo test`、管理端 `bun run type-check`。
- 2026-05-14：开始实现队员会员标识。已确认该标识不同于球队会员/球队 VIP，需要挂载在 `rs_team_members` 和队员 DTO 上。
- 2026-05-14：已读取后端、管理端、小程序协作文档，并盘点 TeamMember domain、repository port、web DTO、handler、迁移表结构和两个前端队员管理入口。
- 2026-05-14：已完成后端 `is_member` 迁移、DTO、repository、use case、schema 测试；小程序和管理端已同步显示/编辑。
- 2026-05-14：验证通过：后端 `cargo fmt --check`、`cargo check --tests`、`cargo test --test team_member_is_member_schema_test -- --nocapture`、`cargo test team::application::service::tests -- --nocapture`、`cargo clippy --all-targets -- -D warnings`；小程序 `bun run type-check`；管理端 `bun run type-check`。
- 2026-05-15：按用户反馈，将小程序比赛报名详情三栏中的人员展示从胶囊卡片改为轻量叠放头像列表；当前用户头像以黑色描边和“我”标记突出；点击头像可在对应区域显示姓名和状态，选中头像有轻微放大和上浮动效；三栏头像已放大到 72rpx；验证通过：小程序 `bun run type-check`。
- 2026-05-15：散人约队详情已分流到比赛报名式个人报名视图，标题改为“散人报名”，报名/取消报名操作收敛到报名截止卡内部，按钮费用读取约队费用信息，地址可点击打开地图，移除黑色信息卡中间 `JOIN` 圆标，并补齐倒计时、比赛说明、底部 banner 与“回到大厅”按钮；球队约队详情保持原结构；验证通过：小程序 `bun run type-check`。
- 2026-05-15：约队大厅散人卡片已支持未报名显示报名、已报名显示取消报名；报名和取消报名均增加二次确认；验证通过：小程序 `bun run type-check`、`bun test src/utils/__tests__/viewModels.test.ts`。
- 2026-05-16：小程序“我的钱包”卡片移除二级页面说明内嵌卡片和“账单明细已移到二级页面”文案，保留余额与查看账单入口；验证通过：小程序 `bun run type-check`、`bun test src/pages/__tests__/userPageBackground.test.ts`。
- 2026-05-15：开始阅读“场馆角色与约队发布权限”需求；已读取根目录、小程序、后端、管理端 `AGENTS.md` / `CLAUDE.md`。
- 2026-05-15：已定位小程序发布入口：约队大厅 `canPublish` 依赖当前球队 `canManageTeam`，散人约队创建页也要求当前球队管理权限并传 `host_team_id`。
- 2026-05-15：已定位后端发布权限：`CreateChallengeRequest.host_team_id` 必填，`CreateChallengeUseCase` 校验 actor 必须是该球队队长或领队。
- 2026-05-15：已确认当前数据库约队表和 summary 查询都强依赖 `host_team_id -> rs_teams`；新增真正场馆主体会比单纯前端放权更大，需要先确认产品建模。
- 2026-05-15：按方案 B 落地用户级 `is_venue` 叠加身份；新增迁移 `20260515000100_user_venue_identity_and_challenge_host.sql`，允许场馆发布约队时 `host_team_id` 为空。
- 2026-05-15：后端已贯通 `User`/DTO/repository/admin player 创建更新，challenge 创建/取消/接约/列表/详情已支持场馆发布分支。
- 2026-05-15：小程序已同步 `BackendUser.is_venue`、`BackendChallenge.host_team_id?: number | null`，场馆可发布球队约队和散人约队；无当前球队时约队大厅仍加载公开列表。
- 2026-05-15：管理端球员列表、创建/编辑弹窗和 service 类型已支持 `is_venue`，展示“场馆”标识并提示仍可作为球员报名。
- 2026-05-15：验证通过：后端 `cargo test --test user_is_venue_schema_test --test challenge_service_business_test -- --nocapture`、`cargo clippy --all-targets -- -D warnings`；小程序 `bun run type-check`、目标 `bun test`；管理端 `bun run type-check`。
- 2026-05-15：根据用户澄清，修正场馆球队约队为两阶段撮合：第一支球队接约时生成“等待对手”的活动并进入最近比赛，第二支球队接约时更新同一活动为双方比赛；新增后端业务测试和小程序卡片文案测试。验证通过：`cargo test --test challenge_service_business_test -- --nocapture`、`cargo clippy --all-targets -- -D warnings`、小程序 `bun run type-check`、小程序目标 `bun test`、管理端 `bun run type-check`。
- 2026-05-15：小程序新增当前发布身份切换。`appSession` 现在派生并持久化可用发布身份，“我的”页头像卡支持在可管理球队身份和场馆身份之间切换；约队大厅发布权限读取 `currentIdentity`；球队约队和散人约队创建页统一按当前身份提交，球队身份传 `host_team_id`，场馆身份不传。
- 2026-05-15：已新增 `stores/currentIdentity.ts` 和对应单元测试，更新约队页面静态测试。验证通过：`bun test src/stores/__tests__/currentIdentity.test.ts src/pages/__tests__/activitiesPageSections.test.ts src/utils/__tests__/viewModels.test.ts src/utils/__tests__/profileCompletion.test.ts`；`bun run type-check`。
- 2026-05-15：排查 `/api/order/my-billing-flow` 慢接口。确认“我的”页原先首屏等待该接口；后端该接口会合并充值、活动扣费、月度罚款和余额校准并重放余额。已新增迁移 `20260515000200_billing_flow_recent_indexes.sql`，为最近流水查询补充复合索引，并已执行 `sqlx migrate run` 应用到当前数据库。
- 2026-05-15：小程序“我的”页钱包卡片已移除 `getMyBillingFlow()`，只调用 `/api/account/balance` 展示余额摘要，点击“查看账单/全部账单”进入二级账单页加载明细。验证通过：`cargo test --test billing_flow_indexes_schema_test -- --nocapture`、小程序目标 `bun test`、小程序 `bun run type-check`、`git diff --check`。`cargo fmt --check` 当前被既有 Rust 格式化差异阻塞，非本轮新增索引文件导致。
- 2026-05-15：修正首页“约队机会”排序与跳转。首页约队请求改为 `holding_date_desc`，并在运行配置过滤后按 `holding_date`、`start_time` 倒序排序再截取；`HomeOpportunityList` 卡片点击后跳转 `/pages/challenges/detail?id=...`。验证通过：`bun test src/pages/__tests__/homePageLoading.test.ts`、`bun run type-check`、`bun run build:mp-weixin`、`git diff --check`。
- 2026-05-15：按静态稿微调小程序首页配色，只改样式颜色值：背景、banner、比赛卡片、约队机会和球队数据卡统一到暖黑/草地绿/雾灰体系。验证通过：`bun run type-check`、`bun run build:mp-weixin`、`git diff --check`。
- 2026-05-15：按静态稿微调小程序首页字体排版，只改字号、字重、行高和中文负字距；banner/日期保留重点，卡片正文和标签降重。验证通过：`bun run type-check`、`bun run build:mp-weixin`、`git diff --check`。
- 2026-05-15：移除散人报名详情页 header 下方重复的“散人报名”胶囊，只保留页面 header 标题。验证通过：`bun test src/pages/__tests__/activitiesPageSections.test.ts`、`bun run type-check`、`bun run build:mp-weixin`、`git diff --check`。
- 2026-05-15：已提交并推送业务改动到 `main`，提交为 `2ab3877 支持场馆约队与首页体验优化`；部署脚本已使用本地 `registration_system_rs/.env` 中的 Harbor 密码启动部署。
- 2026-05-15：首次部署已完成后端镜像构建与 Harbor 推送，并在 out109 启动新容器；随后卡在 nginx 配置更新，错误为 `host: parameter not set`。
- 2026-05-15：定位为部署脚本 nginx 更新段的 heredoc 被本地双引号 SSH 命令包裹，导致 `$host` 等 nginx 变量被本地 `zsh set -u` 展开；已修改为 quoted heredoc + Python 读取环境变量，并通过 `zsh -n deploy_out109_registration_rs.sh`。
- 2026-05-16：修复 `/api/wx/getPhoneNumber` 获取手机号失败。根因是微信 `phone_info.phoneNumber` 为 camelCase，后端 DTO 只认 `phone_number`，导致正常微信响应解码失败；已为 `PhoneInfoResponse` 增加 camelCase 映射。
- 2026-05-16：手机号响应解析失败时现在会记录 status、content-type 和 body 摘要，避免线上只看到 `error decoding response body`。
- 2026-05-16：验证通过：`cargo test wx::adapters::api::real_wechat_api::tests -- --nocapture`、`cargo clippy --all-targets -- -D warnings`。`cargo fmt --check` 仍被既有 challenge 文件格式化差异阻塞，本轮未扩大格式化范围。
- 2026-05-16：修复微信成功响应 `errcode=0, errmsg=ok` 被误判为错误的问题；现在只有非 0 errcode 才按微信 API 错误处理。
- 2026-05-16：在 out109 增加飞书健康告警脚本 `/home/wangrui/projects/registration_system/ops/registration_health_monitor.sh`，cron 每分钟执行，连续失败 3 次才发送告警，恢复后发送恢复通知；飞书 webhook 存放在远端私有 env 文件中。
- 2026-05-16：小程序“我的”页头像昵称旁的徽标已修正为登录状态与球队状态分离：无用户才显示“未登录”，已登录但未加入球队显示“未加入球队”；已补充我的页静态回归约束。
- 2026-05-16：首页顶部球队卡片已改为必须存在 `currentTeam` 才展示；已登录但未加入球队时不再显示“我的球队”空壳卡片，并补充首页静态回归约束。
- 2026-05-16：首页“最近要处理的比赛”改为登录后的待办区：有球队时保留当前球队比赛并追加当前用户已报名的散人约队；登录无球队时只展示已报名散人约队，无相关报名则隐藏该区域；游客态仅提示登录后可查看；散人约队待办状态显示为“已报名”。
- 2026-05-16：首页“约队机会”列表已改为与待办比赛一致的比赛卡片样式，保留原点击进入约队详情逻辑；类型标签移到右上角并按散人/球队区分颜色。
- 2026-05-16：首页“约队机会”卡片底部按钮已复用约队大厅的报名/取消报名/接约操作逻辑，散人报名和取消报名均保留二次确认。
- 2026-05-16：首页“约队机会”报名/取消报名成功后，已改为基于同一份约队原始数据同步刷新机会列表和“最近要处理的比赛”待办；验证通过：小程序 `bun test src/pages/__tests__/homePageLoading.test.ts src/utils/__tests__/viewModels.test.ts`、`bun run type-check`。
- 2026-05-16：修正公开散人局在后端 `can_accept=false` 但状态为 open 时首页按钮仍显示“看详情”的问题；开放散人局现在显示“去报名”并进入确认报名流程；验证通过：小程序 `bun test src/utils/__tests__/viewModels.test.ts src/pages/__tests__/homePageLoading.test.ts`、`bun run type-check`。
- 2026-05-16：修正登录态无当前球队访问公开约队列表时未返回 `current_user_joined` 的问题；后端 `/api/challenges` 不带 `team_id` 但带用户登录态时会计算散人报名关系，首页已报名散人局可显示“取消报名”而不是再次“去报名”；验证通过：后端 `cargo test --test challenge_service_business_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`，小程序 `bun test src/utils/__tests__/viewModels.test.ts src/pages/__tests__/homePageLoading.test.ts`、`bun run type-check`。
- 2026-05-16：小程序比赛报名详情页和散人报名/约队详情页已支持微信分享与朋友圈分享，分享路径携带对应 `id`，标题优先使用已加载名称；验证通过：小程序 `bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts src/pages/__tests__/activitiesPageSections.test.ts`、`bun run type-check`。
- 2026-05-16：小程序首页和约队大厅也已支持微信分享与朋友圈分享；比赛报名详情、散人报名/约队详情、首页、约队大厅统一使用 `src/static/share/share-cover.png` 分享封面，封面路径集中在 `src/utils/share.ts`。
- 2026-05-16：小程序新增应用级不存在页面兜底：`App.vue` 注册 `onPageNotFound`，遇到不存在路径时统一 `reLaunch` 到首页 `/pages/home/index`。
- 2026-05-16：小程序冷启动改为游客优先：`App.vue` 只恢复本地已有 token，不再无 token 时自动微信登录；首页和约队大厅默认加载公开约队数据，报名/接约/发布等动作再触发登录。
- 2026-05-16：修复退出登录后强制刷新又恢复登录态的问题；退出动作统一清理 token、当前球队和当前身份，`restoreSessionFromStorage()` 会检查手动退出标记，旧登录请求返回时也会被会话版本检查拦截，避免退出后 token 被写回；验证通过：小程序 `bun test src/stores/__tests__/appSession.test.ts src/utils/__tests__/authStorage.test.ts`、`bun run type-check`、`git diff --check`。
- 2026-05-16：修复清缓存后停留在“我的”页刷新会自动登录的问题；个人中心无本地 token 时直接展示未登录态，不再无条件调用 `ensureSessionReady()`，未登录资料卡显示“去登录”并由用户主动触发登录；验证通过：小程序 `bun test src/pages/__tests__/userPageBackground.test.ts src/stores/__tests__/appSession.test.ts src/utils/__tests__/authStorage.test.ts`、`bun run type-check`、`git diff --check`。
- 2026-05-17：修复首页“最近要处理的比赛”进入详情再返回会刷新抖动的问题；待办卡片跳转详情成功后设置一次性跳过标记，返回首页时跳过当次 `onShow` 刷新，其他进入首页路径仍保留刷新；验证通过：小程序 `bun test src/pages/__tests__/homePageLoading.test.ts`、`bun run type-check`、`git diff --check`。
- 2026-05-17：在独立分支 `codex/tabbar-fab-menu` 上将小程序自定义 tabbar 中间创建按钮改为截图风格展开态：保留常驻 tabbar 原有颜色/底座/尺寸，只在点击后显示全屏暗色模糊遮罩、三个圆形快捷入口（创建比赛、创建散人约球、创建球队）和中心按钮 `+ / ×` 过渡动画；验证通过：小程序 `bun test src/components/__tests__/bottomTabBarAssets.test.ts`、`bun run type-check`、`bun run build:mp-weixin`、`git diff --check`。
- 2026-05-17：开始实现资料页手机号绑定运行配置。后端 `MiniAppRuntimeConfig` 新增 `profile.require_phone_binding`，默认 `false` 并兼容旧 JSON；小程序资料页改为读取运行配置后再决定是否显示/提交手机号绑定。
- 2026-05-17：验证通过：小程序 `bun test src/config/__tests__/runtimeConfig.test.ts src/pages/__tests__/miniRemainingFeaturesIntegration.test.ts`、`bun run type-check`、`bun run build:mp-weixin`；后端 `cargo test system::application::service::tests -- --nocapture`、`cargo check --tests`；touched system 文件 `rustfmt --edition 2024 --check`；根目录 `git diff --check`。全量 `cargo fmt --check` 仍被既有 challenge 文件格式差异阻塞，未扩大格式化范围。

## 2026-05-17 首页 onShow 策略改造（A 方案 + 下拉刷新）

- 移除上一轮的 `shouldSkipNextShowRefresh`；首页 `onShow` 改为三分支："首次加载 / 事件标志 reload / 遮蔽时长 < 2 分钟 skip"。
- 新增 `onHide`（记 `hiddenAt` + 清 `navigatingMatchId`）、`onPullDownRefresh`（await `loadPageData` + `stopPullDownRefresh`）。
- 新增事件 `home:data-may-changed`：首页 `onLoad/onUnload` 订阅解绑，详情页关键 mutation 后 emit。
- 详情页 emit 落点：`pages/matches/useMatchDetailPage.ts` 6 处（个人报名/取消、队员设报名/请假/未报名、球队报名/取消）；`pages/challenges/detail.vue` 3 处（接约、取消整条、取消散人个人接约）。
- `pages.json` 首页：`enablePullDownRefresh: true`、`backgroundColor: "#eef2e9"`、`backgroundTextStyle: "dark"`。
- `homePageLoading.test.ts`：替换钉死断言，新增 `pages.json` `enablePullDownRefresh` 断言。
- 验证通过：`bun run type-check`；`bun test src/pages/__tests__/homePageLoading.test.ts` 9 pass / 0 fail；`bun test` 134 pass / 1 fail，唯一失败为 pre-existing `pageBackButton.test.ts` 中 `challenges/detail.vue` 标题动态化遗留（已 stash 验证非本轮引入）。

## 2026-05-17 管理端活动报名与散人报名拆分

- 17:15 已确认散人报名真实链路：小程序发布散人约队走 challenge，报名写 `rs_challenge_individual_acceptances`，不是 `activity.match_kind=internal`。
- 17:15 已为后端活动列表补 `registration_scope` 参数，支持按球队派生活动过滤。
- 17:15 已为后端约队列表补 `kind` 参数，支持管理端按 `individual` 查询散人报名。
- 17:15 已在管理端新增 `/individual-registrations` 路由和侧边栏“散人报名”入口，并让活动报名页请求 `registration_scope=team`。

## 2026-05-17 管理端约队/散人报名编辑删除

- 18:20 已新增后端红测 `super_admin_can_cancel_open_challenge` 和 `super_admin_can_update_open_challenge_basic_fields`，初始失败为缺少 `UpdateChallengeCommand` 与 `ChallengeService::update_challenge`。
- 18:30 已新增 challenge 更新 use case、repository port、Postgres `UPDATE ... RETURNING`、web DTO、handler、route 和 OpenAPI 文档。
- 18:30 已将管理员取消接入既有取消用例；超管可取消全部 open 记录，普通管理员按已分配球队范围校验。
- 18:35 管理端约队列表和详情页已增加“编辑/删除”入口；删除调用取消接口，编辑调用 `PATCH /api/admin/challenges/:id`。
- 18:40 已抽离 `ChallengeEditDialog.vue` 与 `ChallengeCancelDialog.vue`，列表页降至 501 行，详情页 322 行。
- 18:45 验证通过：后端 `cargo test --test challenge_service_business_test super_admin_can_ -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`；管理端 `bun run type-check`、`bun run build`；根目录 `git diff --check`。
- 18:45 管理端 `bun run lint` 仍被既有非本轮文件阻塞：`ActivitySettlementPanel.vue`、`PlayerFilterBar.vue`、`PlayerFreezeDialog.vue`、`PlayerList.vue`。

## 2026-05-17 后台创建散人报名

- 18:45 已新增红测：超管可指定 `host_user_id` 创建 `kind=individual`，普通管理员不能创建，后台创建拒绝 `kind=team`。
- 18:50 已为 `CreateChallengeCommand` / `CreateChallengeRequest` 增加可选 `host_user_id`；用户端创建默认仍使用当前用户。
- 18:50 后端管理员创建分支要求超管、`kind=individual`、无 `host_team_id`，并校验指定发布用户存在且是场馆身份。
- 18:55 管理端散人报名页已新增“创建散人报名”按钮；创建弹窗复用 `ChallengeEditDialog`，额外要求发布用户 ID。
- 18:55 验证通过：`cargo test --test challenge_service_business_test -- --nocapture`、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`、管理端 `bun run type-check`、`bun run build`。
- 19:10 修复管理端散人报名/约队编辑弹窗样式错位：`ChallengeEditDialog` 的 modal 和 input/textarea 统一全宽，表单 grid 改为分离横纵间距；验证通过：管理端 `bun run type-check`、`bun run build`。

## 2026-05-17 散人报名详情展示报名人员

- 19:25 已确认后端详情 DTO 已有 `individual_participants`，管理端 service 类型缺失且详情页未渲染。
- 19:30 管理端 `ChallengeDetail.vue` 新增“报名人员”卡片，散人报名详情展示头像、名称、用户 ID 和已报名/容量统计；散人报名详情的面包屑和返回列表指向 `/individual-registrations`。
- 19:35 新增后端仓储测试 `detail_returns_all_individual_participants`，红灯证明原 SQL 只返回 12 人；已移除详情报名人员查询的 `LIMIT 12`。
- 19:40 验证通过：后端 `cargo test --test challenge_repository_postgres_test detail_returns_all_individual_participants -- --nocapture`；管理端 `bun run type-check`、`bun run build`。
- 19:50 已为散人报名列表补充报名人员预览：后端 summary 返回 `individual_participant_preview` 前 3 人，管理端卡片展示头像、昵称和“等 N 人”文案；验证通过：后端目标测试、`cargo check --tests`、`cargo clippy --all-targets -- -D warnings`、管理端 `bun run type-check`、`bun run build`。

## 2026-05-19 活动报名列表为空修复

- 已复现用户截图问题：管理端活动报名页传 `registration_scope=team`，但后端旧 SQL 只查 `source_activity_id IS NOT NULL`，导致东安洺悦联队这类直接球队活动被过滤。
- 当前数据库确认东安洺悦联队 `id=1`，报名中的 `周四友谊赛` 等活动 `home_team_id=1` 且 `source_activity_id=NULL`；按正确球队活动条件查询，报名中共有 4 条。
- 已新增后端仓储测试 `activity_repository_scope_test.rs`，红灯复现后改为 `team` scope 按 `home_team_id/away_team_id` 判断，测试已通过。
- 已同步后端 DTO 注释、管理端 service 注释和活动报名页说明文案。
- 验证通过：`cargo test --test activity_repository_scope_test -- --nocapture`、`cargo check --tests`、管理端 `bun run type-check`。

## 2026-05-19 活动详情编辑球服颜色

- 已在管理端活动详情编辑弹窗增加“主队球服”和“客队球服”色块选择，支持清空。
- 详情页打开编辑时会从活动详情回填 `color` / `opposing_color`，保存时通过 `updateActivity` 提交这两个字段。
- 活动列表新建/编辑和详情编辑已共用 `COMMON_JERSEY_COLORS` 与 `normalizeHexColor`。
- 验证通过：管理端 `bun run type-check`、根目录 `git diff --check`。
- Playwright 新会话访问详情页会被重定向到登录页，无法复用用户当前 Chrome 登录态做弹窗截图验证。

## 2026-05-19 活动报名列表信息补全

- 已在管理端活动报名列表卡片展示比赛时间、开始报名时间、结束报名时间、报名截止倒计时、主队球服颜色和客队球服颜色。
- 列表继续使用现有 `/api/admin/activities?registration_scope=team` 数据，不新增后端字段或接口。
- 倒计时基于 `end_time` 计算，每分钟自动刷新；报名截止后显示“已截止”。
- 验证通过：管理端 `bun run type-check`、根目录 `git diff --check`。
- 已本地登录管理端并查看 `/activities` 页面，卡片内新增信息展示正常；倒计时文案调整为“结束报名倒计时”。

## 2026-05-19 小程序球队活动报名取消人数上限

- 已确认球队活动报名详情前端存在 `players_per_team + 2` 容量上限，并会在达到上限后提示“本场已满员”。
- 已移除该容量上限和满员拦截；球队活动个人报名暂不限制最大报名人数。
- 报名截止卡右上角保留“已报 N / 最低成行人数”，这里的 `/8` 不再代表最大上限。
- 达到成行人数后的提示从“人数已齐”改为“已达成行人数”，避免误解为不能继续报名。
- 进度条保留最低成行人数分割线；超过成行人数后的红色段采用压缩宽度提示超额，不再表示最大容量比例。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts`、小程序 `bun run type-check`、根目录 `git diff --check`。

## 2026-05-20 后端球队活动报名取消人数上限

- 已确认小程序个人报名调用 `/activity/:activity_id/my-stand`，后端 `ManageRegistrationUseCase` 仍按 `players_per_team + 2` 做硬限制。
- 已新增回归测试 `update_my_stand_allows_signup_after_required_players_plus_two`，红灯复现后端返回“本场报名已满员”。
- 已移除后端个人报名容量校验；`players_per_team` 不再作为最大报名人数限制。
- 已删除不再使用的 `is_capacity_stand` helper，避免编译警告。
- 验证通过：`cargo test activity::application::service::tests::update_my_stand_ -- --nocapture`、`cargo check --tests`、根目录 `git diff --check`。

## 2026-05-20 小程序比赛报名底部状态按钮

- 已将 `TeamMemberRegistrationBoard` 内部三枚按钮移除，改为底部固定浮动横条按钮。
- 未报名或已请假状态下，点击按钮弹出“我要报名 / 我要请假”。
- 已报名状态下，点击按钮弹出“取消报名（请假）”，实际提交 `stand=2`。
- 底部按钮按状态切换颜色：未报名/已请假为黑色，已报名为荧光绿。
- 页面底部 padding 加大，避免固定按钮遮挡底部内容。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts`、小程序 `bun run type-check`、根目录 `git diff --check`。

## 2026-05-20 小程序球队报名 Wot UI v2 Dialog

- 12:19 已按官方文档执行 `npx skills add wot-ui/open-wot`，安装 `wot-ui-v2`、`migrate-v1-to-v2` 等 skills 到 `registration_system_mini/.agents/skills`。
- 已将小程序依赖从 `wot-design-uni@1.14.0` 迁移到 `@wot-ui/ui@2.0.8`，并将 easycom 规则改为 `@wot-ui/ui/components/wd-$1/wd-$1.vue`。
- 队员报名状态弹窗这块最终没有保留 Wot 函数式 Dialog，而是改为页面内自定义业务弹窗；Wot v2 迁移成果继续保留给 `wd-picker` 等组件使用。
- 未报名状态：确认按钮为“报名”并提交 `stand=1`，取消按钮为“请假”并提交 `stand=2`，右上角关闭不改变状态。
- 已报名状态：确认按钮为“取消报名”并提交 `stand=2`，取消或关闭不改变状态。
- 已请假状态：确认按钮为“报名”并提交 `stand=1`，取消或关闭不改变状态。
- v2 `wd-picker` 的 `v-model` 迁移为数组值：球队报名人制、队员角色编辑、队员角色新增已同步调整。
- 已为 `@wot-ui/ui` 增加本地类型声明映射，避免 `vue-tsc` 直接检查第三方包源码；运行时和微信小程序构建仍使用 npm 包。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts src/pages/__tests__/createMatchWotUi.test.ts`（23 pass）；`bun run type-check`；`bun run build:mp-weixin`；根目录 `git diff --check`。

## 2026-05-20 小程序球队报名 Dialog 视觉与锁滚动

- 已将队员报名弹窗调整为当前页面风格的自定义业务弹窗：浅暖底、24rpx 圆角、黑/荧光绿确认按钮、浅灰辅助按钮、加粗标题和更克制关闭按钮。
- 已改为页面级锁滚动：队员报名弹窗打开时通过 `pages/matches/detail.vue` 的 `page-meta` 对整页设置 `overflow: hidden`，不再使用透明 fixed 触摸拦截层。
- 已扩展本地 `@wot-ui/ui` 类型声明，支持 `cancelButtonProps.customClass` 和按钮自定义 class。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts`、`bun run type-check`、`bun run build:mp-weixin`、根目录 `git diff --check`。

## 2026-05-20 小程序报名头像展示收口

- 报名截止卡顶部头像预览已改为展示全部已报名队员头像，不再截断为前 5 个。
- 顶部头像尺寸已放大，并允许换行展示 10 人及以上的报名头像。
- 队员报名状态三栏头像已去掉黑白描边；当前用户和选中态都不再依赖边框，只保留“我”标记和选中放大效果。
- 三栏头像尺寸已放大，排列从重叠栈改为更清晰的间隔排列。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts`。

## 2026-05-20 比赛报名下半区职责重构

- 已将 `TeamMemberRegistrationBoard` 从“三块同时展开”的结构收口为“状态切换 + 单区展示”的操作面板。
- 标题已缩短为“队员状态”，右上角摘要已改为总人数 `N人`。
- 已新增 `selectedGroup` / `activeSection` 结构，默认按当前用户所在分组选中，只渲染当前分组头像列表。
- 头像点选后的昵称展示和底部浮动状态按钮仍保留，没有与新的切换结构冲突。
- 已补充目标静态测试，约束 `member-segment`、`activeSection` 和旧三栏结构不再回归。

## 2026-05-20 小程序微信 CI 本地上传工具

- 已在本机共享目录创建 `mini-program-ci-cli`，接入微信官方 `miniprogram-ci`，支持 `preview` 和 `upload`。
- 已为 `registration_system_mini` 和 `football_insight_mini` 增加 `bun run mp:preview`、`bun run mp:upload`。
- 已为两个项目补充 `.env.ci.local.example`、README 使用说明和脚本缺参提示。
- 已为 `registration_system_mini` 写入本地 `.env.ci.local`，并确认被 `.gitignore` 忽略。
- 已为 `football_insight_mini` 写入本地 `.env.ci.local`，并确认被 `.gitignore` 忽略。
- 已为共享 CLI 增加 `JSON5` 解析，兼容带注释的 `manifest.json`。
- 验证结果：
  - `registration_system_mini`: `bun run type-check` 通过；`bun run mp:preview` 已完成构建并打到微信 CI，但被微信后台返回 `invalid ip: 125.70.163.152`。
  - `football_insight_mini`: `bun run type-check` 通过；`bun run mp:preview` 成功，二维码已输出到 `dist/build/mp-weixin/preview-qrcode.jpg`。
