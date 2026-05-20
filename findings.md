# 小程序真实接口接入审计发现

本文件记录审计过程中的关键发现。

## 小程序侧初步扫描

- `src/api/` 已封装 activity、billing、challenge、notification、payment、system、team、user、wx 等真实请求，均走统一请求层或上传接口。
- 页面层大多通过 `src/api` 调接口：约队大厅、约队详情、首页、比赛创建、比赛详情、通知、资料完善、统计、我的、账单、球队管理、我的比赛等。
- 早期发现的“队长代报名接口待接入”和底部导航“待接入”提示已处理；当前测试也约束这些占位文案不应回归。
- `src/mock/appData.ts` 仍存在，但当前页面未直接 `@/mock` 引用。
- `src/pages/user/index.vue` 中 `getTeamCreditTransactions` 在无 activeTeamId 时使用 `Promise.resolve([])`，这是兜底不是 mock。

## 后端小程序侧路由能力

- `/api/user`：登录、校验、当前用户资料、更新资料、头像上传、活动记录、出勤记录、出勤排行、用户列表等。
- `/api/teams`：球队创建、列表、搜索、加入、我的球队、详情、密码信息、成员管理、队费/信用流水、活动复盘、会员充值、处罚等。
- `/api/activity`：活动列表/详情/创建/更新、本人报名状态、报名用户、球队报名、签到配置、签到、位置搜索/解析、进行中检查等。
- `/api/challenges`：约队发布、列表、详情、接约、取消。
- `/api/notifications`：通知列表、未读数、全部标记已读。
- `/api/account` 与 `/api/order`：余额、交易、订单、本人账单流水等。
- `/api/payment`：充值下单、球队会员下单、订单状态、同步、列表、取消、微信回调。
- `/api/wx`：微信登录、access token、手机号。
- `/api/system` 已提供小程序可读能力，例如地图预览配置和 mini app 运行配置；管理端更新接口仍在 `/api/admin/system`。

## 页面/功能接入归类

### 已接真实接口的页面主流程

- 会话启动：`uni.login` -> `/api/wx/login` -> `/api/user/login`，已有 token 后走 `/api/user/info`，再拉 `/api/teams/my-teams` 与 `/api/teams/:id`。
- 首页：活动列表、本人活动记录、出勤记录、约队推荐、用户列表、活动报名用户、未读通知数均来自真实接口。
- 约队大厅：约队列表、发布约队、接约来自 `/api/challenges` 真实接口。
- 约队详情：详情、接约、取消来自 `/api/challenges` 真实接口。
- 比赛创建：调用 `/api/activity` 创建活动，包含经纬度和签到配置参数。
- 比赛详情：活动详情、报名用户、球队详情、用户列表、相关活动、本人报名状态更新、球队报名、签到、签到配置更新和赛后互评来自真实接口。
- 账单页：余额和本人账单流水来自 `/api/account/balance`、`/api/order/my-billing-flow`。
- 通知页：通知列表、标记已读、未读数来自 `/api/notifications`。
- 统计页：当前球队出勤汇总和排行来自球队出勤统计接口。
- 我的页：活动、本人活动记录、余额、账单、队费流水、通知红点、会员续费支付来自真实接口。
- 完善资料：头像上传、资料更新、微信手机号绑定来自真实接口。
- 球队管理：创建、搜索、加入、资料编辑、成员搜索/添加/编辑/冻结/移除来自真实接口。
- 我的比赛：活动列表和本人活动记录来自真实接口。
- 系统运行配置：首页运行参数通过 `/api/system/mini-app-runtime-config` 下发并在前端兜底。

### 仍需关注

- `src/api/system.ts` 的 `getSystemHealth()` 仍是通用健康检查封装，当前页面未使用；这不属于业务 mock。
- `src/mock/appData.ts` 是历史原型数据，当前页面未直接引用；新增功能不要继续依赖。
- 支付工具保留 mock 支付参数识别逻辑，用于本地支付测试；真实页面会在非 mock 参数时调用微信支付。
- 部分页面仍偏大，后续应按 `registration_system_mini/docs/mini-architecture.md` 继续拆分。

### Mock/静态数据情况

- `src/mock/appData.ts` 仍存在，但未发现页面直接引用。
- 页面有少量静态文案/默认表单值/空状态，不等同于业务数据 mock。
- `src/utils/payment.ts` 保留 mock 支付参数识别逻辑，主要用于本地支付测试；账单和会员续费页面已接入真实支付订单流程。

## 2026-05-13 产品与技术文档整理发现

### 文档产物

- 已新增当前版本产品说明书：`docs/product-spec-current.md`。
- 已新增当前版本技术说明书：`docs/technical-spec-current.md`。
- 已新增当前版本数据库关联关系文档：`docs/database-relations-current.md`。

### 产品功能事实

- 小程序端已经覆盖：首页、约队大厅、统计、球队管理、我的、我的比赛、全部比赛、比赛详情、创建比赛、约队详情、创建散人约队、通知、账单、完善资料。
- 小程序端主流程基本接真实后端 API：`activity`、`team`、`challenge`、`billing`、`payment`、`notification`、`system`、`user`、`wx`。
- 管理后台已经覆盖：仪表盘、球队、球队详情、活动、活动详情、约队、约队详情、账单、球员、管理员、系统设置。
- 比赛功能已支持内战/对外标识、球服颜色、位置坐标、球队报名、个人报名、签到配置、签到、互评、结算入口。
- 约队功能已支持 `team` 和 `individual` 两种类型；散人约队容量按 `players_per_team * 2`，球队约队容量按对方一侧人数。
- 结算当前支持 `aa` / `manual` 两种模式，以及 `registered_attendees` / `custom_users` 两种参与范围。

### 技术事实

- 后端路由统一由 `registration_system_rs/src/bootstrap/modules/router.rs` 挂载：管理端 `/api/admin/*`，小程序端 `/api/*`。
- 后端模块按 `domain/application/ports/adapters` 分层；`activity`、`team`、`billing`、`challenge`、`payment`、`system`、`auth`、`user`、`notification`、`wx` 都已出现 use case 拆分形态。
- 小程序页面已按局部组件、`*State.ts`、`*Actions.ts` 模式拆分，规范文档在 `registration_system_mini/docs/mini-architecture.md`。
- 管理后台已完成 `ActivityDetail`、`PlayerList` 和部分 `TeamDetail` 拆分；`ActivityList` 拆分只完成 toolbar/status summary/model 的一部分。
- 后端已支持 MinIO/S3 兼容上传配置。用户头像上传当前直接走 MinIO；球队 Logo 上传仍按 `UPLOAD_STORAGE_BACKEND` 在 local/minio 间切换。

### 数据库事实

- `rs_teams.id` 已迁移为 `BIGINT`，并保留 `legacy_id VARCHAR(64)`。
- `rs_activity.id`、`rs_challenges.id` 仍是 `CHAR(36)`。
- 用户和管理员 ID 是 `BIGSERIAL`。
- `rs_user_info.avatar_url` 已通过迁移改为 `TEXT`。
- `rs_admin_team_assignment.team_id` 已改为 `BIGINT`，并补齐到 `rs_teams(id)` 的外键。
- `rs_user_billings.activity_id` 已补齐到 `rs_activity(id)` 的外键。
- billing 领域命名已统一到 activity：`game_id -> activity_id`，`game_fee -> activity_fee`，`game_fee_amount -> activity_fee_amount`。

### 待产品讨论主题

- 约队满员后是否自动生成比赛，以及散人约队分队规则。
- billing 是否重写成完整财务模型，包括冲正、撤销、退款、余额不足和审计。
- 统计口径是否支持自定义周期，冻结队员是否参与未报名统计。
- 所有图片资源是否统一强制进入 MinIO/CDN。
- 权限是否从当前角色判断演进为更完整 RBAC。

### 已确认决策

- 球队 ID 已切换为数据库自增数字 ID。
- 活动 ID 和约队 ID 继续保持字符串主键。
- 已保留迁移实施计划：`docs/superpowers/plans/2026-05-13-team-id-bigserial-migration.md`。

## 2026-05-13 协作文档规范固化发现

- 仅依赖 `planning-with-files` skill 不足以保证所有新对话都持续维护工作文档，因为 skill 是否触发仍取决于当轮判断。
- 更稳的方案是把规则写入根目录和子项目级 `AGENTS.md` / `CLAUDE.md`，让新对话在读取仓库文档时就能看到这条要求。
- 当前阶段先固化两层约束：
  - 规范层：在协作文档中明确要求复杂任务默认维护 `task_plan.md`、`findings.md`、`progress.md`
  - 流程层：在协作文档中明确复杂任务默认采用 `planning-with-files`
- 检查脚本先不加，后续观察仅靠文档约束是否足够稳定。

## 2026-05-13 后端全量验证发现

- `cargo clippy --all-targets -- -D warnings` 暴露出一批 team ID 数字化后的机械性 `needless_borrows_for_generic_args`，主要是 `.bind(&team_id)` 这类多余借用，已清理。
- `cargo test` 暴露了一个过期测试数据：`remaining_team_activity_routes_test` 中 `check-in-config` 请求体仍使用字符串 `team_id`，在团队 ID 改成数字后会先触发 `422`；已改为数字 `team_id`，恢复原本的 `401` 语义验证。

## 2026-05-13 billing/order 收口发现

- `rs_recharge_records.transaction_no` 不能直接升级成支付订单外键，因为后台手工充值接口同样允许写入该字段，它兼容的是“外部流水/凭证”语义，不只属于微信支付单号。
- 更合理的做法是新增专用字段 `rs_recharge_records.payment_order_no` 来承载系统内支付订单关联，而保留 `transaction_no` 继续兼容手工充值场景。
- `PaymentBillingPort` 名字已经过窄且带偏：payment 模块实际做的是“支付成功后的结算落账”，而不是直接依赖 billing 模块本身，因此这层更适合命名为 `PaymentSettlementPort`。
- 仅在 use case 层判断“订单已支付就返回”不够稳。如果历史上存在“订单已标记 paid，但后置入账没完成”的中间态，再次同步/回调时应允许补做结算，因此幂等性要落在持久化层而不是只落在流程分支里。
- `rs_recharge_records.payment_order_no` 的唯一约束需要使用普通唯一索引，不能使用部分唯一索引再配合 `ON CONFLICT (payment_order_no)`；否则 Postgres 不会把它识别成可命中的冲突目标。
- 本轮最终采用的幂等策略：
  - 充值入账：`rs_recharge_records.payment_order_no` 唯一，先插充值记录，冲突则直接视为已结算。
  - 球队会员续费：继续以 `rs_team_membership_orders.applied_at` 作为已应用判断，并新增 `transaction_id` 唯一索引，约束一笔微信交易只能应用一次。

## 2026-05-14 activity fee snapshot 命名收口发现

- `rs_activity_order` 的真实语义不是支付订单，而是活动费用配置/结算快照：字段只有 `activity_id`、费用描述、单人费用、人数和活动时间快照，并且结算流程会按 `activity_id` upsert。
- 用户已确认除报名、活动、用户外其他数据不需要兼容，因此这轮直接把旧表重命名为 `rs_activity_fee_snapshots`，不保留旧表或兼容视图。
- 结算接口仍挂在既有 `/api/order` 和 `/api/admin/orders` 路由组下，避免影响小程序比赛结算；仅费用快照子路径改为 `/activity-fee-snapshots`，并把自动费用计算子路径改为 `/fee/auto-calculate`。
- 管理端 dashboard 原先用“活动订单数”做 `订单数量`，现在改成 `费用快照`，避免和 `payment` 模块的真实支付订单混淆。

## 2026-05-14 队员会员标识发现

- 用户确认“球队的队员是否会员”是队员属性，不是现有球队 VIP、球队会员续费或 `team_membership` 支付体系。
- 后端 `rs_team_members` 当前只有 `role`、`jersey_number`、`joined_at`、`status` 等字段，没有队员会员字段。
- 后端小程序侧队员详情使用 `TeamMemberDto`；管理端详情使用 `TeamMemberWithInfoDto`，两者都需要返回 `is_member`。
- 后端成员写入路径集中在 `TeamCommandRepository.add_member`、`reactivate_member`、`update_member`，应用层命令是 `AddTeamMemberCommand` 和 `UpdateTeamMemberCommand`。
- 小程序成员管理入口位于 `registration_system_mini/src/pages/teams/manage/*`，类型入口是 `src/types/backend.ts` 与 `src/api/team.ts`。
- 管理端成员管理入口位于 `registration_system_backend_fe/src/services/team.ts`、`src/views/teams/TeamMemberPanel.vue`、`src/views/teams/TeamSetRoleDialog.vue`。

## 2026-05-15 小程序报名详情三栏头像列表发现

- 用户希望三栏中的头像列表回到此前报名详情里的轻量头像列表样式，而不是大卡片或胶囊人员列表。
- 小程序已有模式在 `IndividualCountdownCard` 和约队个人进度卡中：头像叠放、白色描边、旁边用文案/区域标题说明人数。
- 三栏状态本身已经提供“报名 / 请假 / 未报名”和人数，因此列表内部不再需要重复显示姓名与球衣号。
- 点击头像查看姓名采用区域内姓名条，而不是全局 toast 或 popup，原因是反馈位置更稳定，也不会和小程序页面滚动/弹层裁剪互相影响。

## 2026-05-15 小程序散人约队报名页发现

- 散人约队已有个人报名与取消报名接口能力，问题主要在 UI 仍使用约队详情样式，与比赛报名页的操作不一致。
- 散人约队没有球队三栏状态区域，因此应对齐比赛报名页中的个人报名 tab、黑色信息卡和报名截止卡，而不是复用球队队员状态卡。
- 球队约队详情包含队长接约/取消约队流程，不应被散人报名页视觉改造影响。

## 2026-05-15 场馆角色与发布权限发现

- 小程序约队大厅 `registration_system_mini/src/pages/activities/index.vue` 的 `canPublish` 当前等于 `!!currentTeam.value?.canManageTeam`；发布类型弹层打开前只依赖当前球队管理权限。
- 小程序散人约队创建页 `registration_system_mini/src/pages/challenges/create-individual/index.vue` 当前要求 `currentTeam.value?.canManageTeam`，并调用 `createChallenge` 传入 `host_team_id: currentTeam.value.id`。
- 小程序 `createChallenge` API 类型要求 `host_team_id: number`；`BackendChallenge.host_team_id` 也是必填 number。
- 小程序会话 `BackendUser` 只有 `is_manager`，`TeamProfileViewModel` 只有球队内 `myRole/canManageTeam`；没有当前用户是否为场馆的稳定字段。
- 后端 `CreateChallengeRequest` 要求 `host_team_id: i64`；`CreateChallengeUseCase` 会先查询该球队，再校验 actor 是该球队队长或领队。
- 数据库 `rs_challenges.host_team_id` 当前为非空，并且外键到 `rs_teams(id)`；summary 查询大量 `INNER JOIN rs_teams host ON host.id = c.host_team_id`，因此新增真正场馆发布主体会影响 DTO、查询、列表、详情和前端展示。
- 用户 domain 目前有 `is_manager`，但语义更像旧的管理标识，不足以表达“场馆经营者/发布方”；管理后台球员 service 当前也没有场馆角色字段。
- 如果把场馆临时建模成特殊球队，改动最小，但会污染球队语义；如果新增 `venue` 实体或 `user_role = venue`，需要同步权限、展示名和 challenge 发布者模型。
- 用户确认采用方案 B：在用户上新增 `is_venue` 布尔身份，作为附加身份而不是互斥角色。
- `is_venue` 不影响球员身份；场馆用户仍可以作为普通用户报名散人约队，也可以保留球队成员/队长/领队关系。
- 场馆发布约队不创建虚拟球队，而是允许 `rs_challenges.host_team_id` 为空；后端通过 `host_user_id` 记录场馆发布者。
- 小程序无当前球队时仍应能加载约队大厅；有球队时继续携带 `teamId` 获得当前球队关系和接约权限。
- 场馆发布的球队约队第一支球队报名时就应生成“等待对手”的活动，方便第一支球队队员提前报名/请假；第二支球队应战后更新该活动的对手并约成。

## 2026-05-15 小程序当前发布身份切换发现

- 当前“当前球队”仍服务首页、统计、报名、队费等上下文，不适合直接等同于“当前发布主体”。
- 发布身份应是会话级派生状态：可管理球队产生球队身份，`BackendUser.is_venue` 产生场馆身份；普通队员身份不进入发布身份列表。
- `registration_system_mini/src/pages/challenges/create-individual/index.vue` 是球队约队和散人约队都能复用的发布页；使用当前身份后，队长/领队身份和场馆身份可以走同一套 `createChallenge`。
- `host_team_id` 的语义变得清晰：当前身份是球队时传当前身份的 `teamId`；当前身份是场馆时不传，由后端按场馆发布处理。
- 用户同时是场馆和队长时，切换当前球队不能强制把场馆身份冲掉；只有当前发布身份本来就是球队身份时，切换到另一支可管理球队才跟随更新。

## 2026-05-15 `/api/order/my-billing-flow` 性能发现

- 小程序“我的”页 `loadPageData()` 原先把 `getMyBillingFlow()` 放在首屏 `Promise.all` 中，因此该接口慢会直接拖慢“我的”页整体加载，也会拖慢“我的钱包”卡片展示。
- 后端 `get_user_billing_flow` 不是简单分页查询：它会查询账户、充值记录、活动扣费、月度罚款、余额校准，再在 Rust 中按时间排序并重放余额，生成每条流水后的余额。
- 当前远程数据库账单相关表暂无记录，单条 SQL 执行计划很快；但从代码结构看，真实数据量增长时该接口仍属于重接口，不适合放在“我的”页首屏。
- 原有索引只有单列 `user_id` 或日期索引，最近流水查询使用 `WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`，更适合补 `(user_id, created_at DESC)` 复合索引。
- 处理策略：我的页只用 `/api/account/balance` 展示余额摘要和查看入口；完整流水继续在账单明细二级页加载。

## 2026-05-15 首页约队机会排序与详情跳转发现

- 首页“约队机会”数据来自 `pages/home/index.vue` 中的 `listChallenges`，此前游客态和登录态都使用 `sort: "credit_desc"`，导致高信用但时间更早的约队可能排在更靠前位置。
- 首页会先按运行配置过滤可见约队，再 `slice` 截取展示数量；因此仅依赖后端排序不够稳，过滤后仍需要在前端按 `holding_date` 和 `start_time` 倒序排序后再截断。
- `HomeOpportunityList` 原先只展示卡片，没有 emit 点击事件；详情页路由已存在于 `pages.json`，路径为 `/pages/challenges/detail?id=...`。

## 2026-05-16 小程序退出登录后刷新状态发现

- `clearSession()` 必须清理 token、当前球队、当前身份并写入 `registration_system_mini_manual_logout` 手动退出标记；退出后本地不应继续存在 token。
- 冷启动入口 `App.vue` 调用 `restoreSessionFromStorage()`；此前该恢复逻辑只根据本地 token 决定是否恢复登录态，未检查手动退出标记。
- 因此用户手动退出后，如果本地仍残留 token，强制刷新可能重新按 token 恢复登录态；合理策略是退出动作直接删除 token，手动退出标记优先于 token 恢复，并在冷启动时清理残留登录缓存。
- 异步登录流程也需要防止退出后旧请求回写 token；会话版本变化后，旧请求即使返回也应被拦截并再次清理本地会话。
- 清缓存后自动登录的直接来源不是 token 残留，而是手动退出标记也被清掉后，个人中心页面层无条件调用 `ensureSessionReady()`；个人中心应在无 token 时停留游客态，用户点击“去登录”才触发微信登录。
- 首页待办详情返回抖动来自 `onShow()` 刷新：待办卡片进入详情后回退也会触发 `loadPageData({ preserveContent: true })`，导致刷新遮罩和卡片重算；应在待办详情跳转成功后跳过下一次首页 `onShow` 刷新。
- 小程序 tabbar 是页面内自定义 `BottomTabBar.vue`，不是微信 `custom-tab-bar` 目录；中间创建按钮适合直接在该组件里实现 FAB 展开菜单和动画，但常驻 tabbar 的颜色、底座和尺寸应继续沿用项目原有样式。

## 2026-05-15 小程序首页配色微调发现

- 当前首页视觉不舒服的主因是纯黑与荧光绿对比过硬，浅灰背景与白卡层次偏弱。
- 用户明确要求先画静态页面确认，再只改配色；真实代码改动应限定在样式颜色值，避免动结构和业务逻辑。
- 最终配色方向采用暖黑/墨绿黑 `#172018`、草地绿 `#9be22b` / `#b9f24b`、暖白 `#fffdf8`、雾灰绿背景和柔和珊瑚红状态色。

## 2026-05-15 小程序首页字体排版微调发现

- 首页原本多个层级同时使用 `font-weight: 900`，导致标题、卡片正文、标签和按钮视觉重量接近，页面显得吵。
- 不需要引入自定义字体；小程序端沿用系统中文字体更稳，主要调整字号、字重、行高和中文负字距。
- 最终策略：banner 和日期重点信息保留较强字重；卡片标题降到 800 左右；正文信息降到 520/650；标签和按钮保留 750/800，形成更清楚的阅读层级。

## 2026-05-15 散人报名详情重复标签移除发现

- 散人约队详情页顶部 `AppTabHeader` 已通过 `pageTitle` 显示“散人报名”，`ChallengeIndividualRegistration` 内部再渲染一个“散人报名”大胶囊属于重复信息。
- 删除内部 tabs 不影响报名截止卡、立即报名/取消报名按钮、回到大厅入口和比赛说明区域。

## 2026-05-15 部署脚本 nginx heredoc 发现

- `deploy_out109_registration_rs.sh` 在 nginx 配置更新步骤里把 Python heredoc 放进本地双引号 SSH 命令，配置文本中的 `$host`、`$remote_addr` 会先被本地 `zsh set -u` 展开，导致部署在 `host: parameter not set` 处退出。
- 修复方向是把 Python 代码通过本地 quoted heredoc 传给远端 `python3 -`，并让 Python 从环境变量读取 nginx 容器名、配置路径和备份后缀，避免 nginx 配置变量被本地 shell 展开。

## 2026-05-16 微信手机号响应解析发现

- 小程序编辑资料页通过 `registration_system_mini/src/api/wx.ts` 调用 `/wx/getPhoneNumber`，前端仍只需要本系统返回的 `phone_number`。
- 后端失败点在 `registration_system_rs/src/wx/adapters/api/real_wechat_api.rs`；原实现直接 `response.json()`，解析失败时日志只剩 `error decoding response body`。
- 微信手机号接口成功响应的 `phone_info` 内部字段是 `phoneNumber`，不是 Rust DTO 字段名 `phone_number`；缺少 serde camelCase 映射会导致正常响应也解码失败。
- 后端修复应限定在微信外部响应 DTO 和解析诊断，不需要改变小程序 API 契约。
- 微信成功响应会带 `errcode=0, errmsg=ok`；后端不能把“存在 errcode”直接当失败，只应在 `errcode != 0` 时返回微信 API 错误。
- Docker healthcheck 本身只标记 `healthy/unhealthy`，不会自动通知；飞书告警适合放在服务器侧 cron 脚本，连续失败 3 次后发送，避免部署重启误报。

## 2026-05-17 首页 onShow 策略改造发现

- 上一轮的 `shouldSkipNextShowRefresh` 只覆盖"最近要处理的比赛"卡片这一种入口，且 flag 在 `uni.navigateTo` 的 success 异步回调里设；其它入口（约队卡、tab 切换、管理页等）回首页仍 reload，是抖动主因。
- `navigatingMatchId` 用 `setTimeout(500ms)` 异步清是次要抖动源；改成 `onHide` 同步清更稳定。
- 简版 A 方案（事件标志 + 遮蔽时长阈值 + 下拉刷新）足以覆盖用户原始抱怨：看一眼回来 → 时间窗口 skip；操作过回来 → 事件标志 reload；长时间离开回来 → 兜底 reload；主动求最新 → 下拉刷新。
- 没做局部 patch（事件不带 payload）：用户在详情页操作的约队/比赛**未必落在首页 limit 截取的列表里**，patch 难稳定生效；统一 reload 简单可靠，浮标"更新中..."可接受。
- pages.json `navigationStyle: custom` 不影响 `enablePullDownRefresh`；下拉露出的 `backgroundColor` 必须和页面渐变底色（`#eef2e9`）对齐，否则会闪白边。
- `homePageLoading.test.ts` 把上一轮 `shouldSkipNextShowRefresh` 整套源码字符串钉死，改造时必须同步更新断言。已确认 `pageBackButton.test.ts` 中 `challenges/detail.vue` 失败为 pre-existing（标题已改成动态 `:title="pageTitle"`，测试仍要求字符串绑定），与本轮无关。

## 2026-05-17 资料页手机号绑定配置发现

- 后端已有公开系统运行配置接口 `GET /api/system/mini-app-runtime-config`，小程序已有 `loadMiniAppRuntimeConfig()` fallback；本需求适合复用该链路，不需要新增接口。
- `rs_system_runtime_configs` 存的是 JSON；新增 `profile` section 时必须给 `MiniAppRuntimeConfig.profile` 加 `serde(default)`，否则线上旧 `mini_app` JSON 缺少字段会导致读取配置失败。
- 用户要求“默认不显示，也就是不绑定”，因此默认值应是 `profile.require_phone_binding=false`，小程序配置加载失败时也应沿用默认隐藏。
- 当前资料页手机号绑定原本是可选字段；本轮只做显示和提交门控，不新增“手机号必填”校验。

## 2026-05-17 管理端报名拆分

- 小程序“创建散人约队”页面 `registration_system_mini/src/pages/challenges/create-individual/index.vue` 调用 `createChallenge`，提交字段是 `kind: "individual"`。
- 后端散人报名不写 `rs_activity.match_kind=internal`；发布写 `rs_challenges.kind='individual'`，用户报名写 `rs_challenge_individual_acceptances`。
- `activity.match_kind=internal` 是比赛类型“队内内战”，不是散人报名分类。
- 球队报名派生活动通过 `rs_activity.source_activity_id IS NOT NULL` 识别，派生活动记录 `team_registration_count`。

## 2026-05-17 管理端约队/散人报名编辑删除

- 当前“删除”按软删除处理，即调用取消逻辑把 `rs_challenges.status` 置为 `cancelled`，保留报名、通知和历史关联数据。
- 约队编辑不应修改 `kind`、`host_team_id`、`guest_team_id`、报名关系或 `activity_id`，否则已生成比赛和报名关系会产生跨表不一致。
- 后端管理权限应与后台列表可见范围保持一致：超管全量；普通管理员仅限已分配球队相关记录；场馆/散人这种无球队主体的全局记录仅超管处理。
- 前端列表页和详情页都需要操作入口，但表单和确认框应抽成独立组件，避免 `ChallengeList.vue` 继续超过 600 行并复制详情页逻辑。

## 2026-05-17 后台创建散人报名

- `rs_challenges.host_user_id` 指向小程序用户表，不是管理员表；后台创建不能直接用 admin id 当发布人。
- 后台创建散人报名采用“超管代用户发布”模型，表单显式填写发布用户 ID。
- 无球队主体的散人报名创建仍要求该发布用户具备场馆身份，沿用用户端场馆发布权限语义。
- 为避免误用，管理员创建分支只允许 `kind=individual`，不开放球队约队后台创建。
- `ChallengeEditDialog` 使用 DaisyUI input/textarea 放进两列 grid 时，需要给控件显式 `w-full`；否则控件按默认宽度收缩，编辑弹窗会出现输入框不齐和留白异常。

## 2026-05-17 散人报名详情报名人员发现

- 后端 `ChallengeDetailDto` 已包含 `individual_participants`，字段为 `user_id`、`display_name`、`avatar_url`；管理端此前只定义并渲染了 summary/activity，导致详情页没有报名人员信息。
- 后端 Postgres 详情查询原先对报名人员加了 `LIMIT 12`，但管理端详情页用于运营核对名单，应返回完整报名列表；本轮已用 13 人仓储测试钉住该行为。
- 散人报名列表页适合展示轻量预览而不是完整名单；后端 summary 使用 `individual_participant_preview` 返回每条散人局前 3 个报名人员，详情页继续使用完整 `individual_participants`。

## 2026-05-19 活动报名列表为空发现

- 管理端活动报名页固定请求 `/api/admin/activities?registration_scope=team`。
- 后端旧 SQL 把 `team` scope 定义为 `source_activity_id IS NOT NULL`，只包含球队报名派生活动。
- 当前数据库中东安洺悦联队的报名中活动有 `home_team_id=1`、`source_activity_id=NULL`，因此被旧 scope 条件过滤，页面统计和列表都显示 0。
- 管理端“活动报名”的真实语义应是有球队参与、可管理球队内部球员报名的活动；判断条件应基于 `home_team_id IS NOT NULL OR away_team_id IS NOT NULL`，而不是仅基于是否从源活动派生。

## 2026-05-19 活动报名列表信息补全发现

- 管理端 `Activity` 列表 DTO 已包含本次展示所需字段：`color`、`opposing_color`、`holding_date`、`start_time`、`end_time`。
- 当前业务语义中 `holding_date` 是比赛时间，`start_time` / `end_time` 是报名开始和报名截止时间；列表不能再把 `start_time` / `end_time` 标成比赛时间段。
- 倒计时应以报名截止 `end_time` 为准，过期后显示“已截止”。
- 页面文案应使用“结束报名倒计时”，比“截止倒计时”更贴近运营实际含义。

## 2026-05-19 小程序球队活动报名人数上限发现

- 小程序比赛报名详情原先在 `useMatchDetailPage.ts` 中把 `maxPlayers` 算为 `players_per_team + 2`。
- 该值不只是展示用，还用于 `isAtRegistrationCapacity`，达到后会阻止个人报名并提示“本场已满员”。
- 对球队活动来说当前产品规则是先不限制最大报名人数，因此 `/players_per_team` 只能作为最低成行人数提示，不能作为满员上限或报名拦截条件。
- 进度条中的分割线仍需要保留，用于标记最低成行人数；超出部分只做压缩视觉提示，不按容量比例表达最大值。

## 2026-05-20 后端球队活动报名人数上限发现

- 后端用户个人报名链路是 `PATCH /activity/:activity_id/my-stand` -> `ActivityService::update_my_stand` -> `ManageRegistrationUseCase::update_my_stand`。
- 旧后端逻辑会先查活动 `players_per_team`，再按 `players_per_team + 2` 和当前容量报名数决定是否返回“本场报名已满员”。
- 该限制和当前“球队活动先不限制最大报名人数”的规则冲突，应移除；散人约队 challenge 的容量规则不属于本次改动范围。

## 2026-05-20 比赛报名下半区职责重构发现

- 上半张卡已经承担倒计时、`已报 N / 8`、成行状态和已报名头像总览；如果下半区继续把三组人同时展开，会和上方“已报名”信息形成明显重复。
- 更合适的职责分离是：上半区做全局概览，下半区做状态切换和报名操作，这样页面焦点更清楚。
- `TeamMemberRegistrationBoard.vue` 适合改成单一 `selectedGroup` 驱动：默认跟随当前用户所在分组，只渲染 `activeSection.members`，避免三组列表同时占满页面高度。
- 右上角摘要如果继续写 `10/18` 会和上方人数表达撞车；改成 `18人` 更像总览信息，不会和“最低成行人数”语义混淆。

## 2026-05-20 小程序比赛报名状态按钮发现

- `TeamMemberRegistrationBoard` 原先在卡片内部放置“我要报名 / 我要请假 / 未报名”三按钮，占用内容区且页面滚动后不可见。
- 当前用户状态可以通过 `groups.joined/leave/pending` 中的 `isCurrentUser` 判断，不需要额外接口字段。
- 用户要求已报名后的“取消报名”语义等同请假，因此已报名状态的 action sheet 应提交 `stand=2`，不是 `stand=0`。

## 2026-05-20 Wot UI v2 Dialog 迁移发现

- Wot UI 官方当前文档使用 v2：npm 包名为 `@wot-ui/ui`，Dialog 组件为 `<wd-dialog />`，函数式 hook 为 `useDialog()`。
- 项目原先使用 `wot-design-uni@1.14.0`，对应弹窗组件是 `<wd-message-box />` 和 `useMessage()`；本轮按用户要求迁移到 v2，不再沿用 1.x 兼容写法。
- v2 Dialog 适合快速接入标准能力，但在这页强定制视觉下并不是最终最优解；这块最终收口为自定义业务弹窗。
- v2 `wd-picker` 的 `modelValue` 类型为数组，即使单列选择器也需要用 `[value]` 作为 v-model，并在 setter 中取第一个值回写业务字段。
- `@wot-ui/ui@2.0.8` npm 包以源码形式发布，当前项目 `vue-tsc` 会直接检查依赖源码并触发第三方包内部类型错误；本轮通过 `tsconfig.paths` 为 `@wot-ui/ui` 提供本地类型声明，只影响类型解析，实际运行打包仍走 npm 包。
- Wot Dialog 的默认视觉偏标准组件库风格，和当前比赛报名页的黑/荧光绿、较克制圆角体系不一致；本页面适合通过 `custom-class` 和 CSS 变量局部覆盖，不做全局主题改动。
- 当前函数式 Dialog 调用没有直接配置 `lockScroll` 的入口；小程序里更稳的方案不是额外铺透明 fixed 视图，而是把可见状态上抛到页面根节点，用 `page-meta` 设置 `overflow: hidden`，这样不会误伤弹窗按钮点击。
- 报名截止卡头像预览是否完整显示，取决于 `useMatchDetailPage.ts` 的 `participantPreview` 是否截断，而不是 `IndividualCountdownCard.vue` 自身模板逻辑。
- 队员报名状态三栏头像的边框、当前用户描边和选中高亮都集中在 `TeamMemberRegistrationBoard.vue` 的 `.member-avatar*` 样式块里，单独改这里就能收掉边框而不影响其它页面。

## 2026-05-20 小程序微信 CI 本地上传工具发现

- 共享 CLI 放在本机目录 `/Users/carlwang/.local/share/mini-program-ci-cli`，两个项目只保留很薄的一层 `scripts/mini-ci.mjs` 转发脚本。
- 项目本地敏感配置放在 `.env.ci.local`，并通过 `*.local` 规则被 git 忽略，适合存放私钥路径和机器人编号。
- `registration_system_mini/src/manifest.json` 是标准 JSON，而 `football_insight_mini/src/manifest.json` 带注释；共享 CLI 需要用 `JSON5` 解析，不能直接 `JSON.parse`。
- `registration_system_mini` 的真实 `preview` 已成功走到微信 CI 服务端，但被微信后台拒绝，错误是 `invalid ip: 125.70.163.152`，说明私钥和 CLI 都已生效，当前阻塞点是微信侧 IP 白名单。
- `football_insight_mini` 在补入私钥后，`bun run mp:preview` 已成功生成预览二维码，输出路径为 `dist/build/mp-weixin/preview-qrcode.jpg`。
