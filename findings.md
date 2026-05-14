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
