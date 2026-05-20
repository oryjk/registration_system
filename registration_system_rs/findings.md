# 后端重构发现记录

## 2026-05-12

- `team` 已完成读写仓储分离，`TeamService` 只保留兼容 facade。
- 当前应用层大文件行数：`activity/service.rs` 约 1221 行，`challenge/service.rs` 约 526 行，`billing/service.rs` 约 429 行，`user/service.rs` 约 426 行，`payment/service.rs` 约 395 行。
- `challenge` 目前仍是单一 `ChallengeService` + 单一 `ChallengeRepository`。业务包含：创建约队、接约队、取消约队、球队列表、公开列表、管理端列表、详情。
- `challenge` 已依赖 `TeamQueryRepository`，适合先抽权限/团队访问检查，再拆 use case。
- `challenge` 应用层已拆出：`commands`、`queries`、`permission`、`notifier`、创建/接约/取消/列表/详情 use case。`ChallengeService` 保持 public API 作为 facade。
- `ChallengeRepository` 已拆为 `ChallengeQueryRepository` / `ChallengeCommandRepository`。Postgres 暂时仍由 `PostgresChallengeRepository` 同时实现两个 trait，SQL 文件搬迁可后续单独做。
- `billing` 已拆出 `commands`、`read_models`、`error`、`use_cases`。`BillingService` 只做 facade 转发。
- `BillingRepository` 已拆为 `BillingQueryRepository` / `BillingCommandRepository`。Postgres 暂时仍由 `PostgresBillingRepository` 同时实现两个 trait；SQL 通过内部 `do_*` 方法复用，避免大规模搬动 SQL。
- `payment` 依赖微信网关、用户仓储、球队查询、账单端口，下一步应优先拆应用层 use case，再考虑 `PaymentOrderRepository` 读写拆分。
- `payment` 已拆出 `commands`、`read_models`、`openid_resolver`、`order_no` 和 use cases。`PaymentService` 已变为 facade。
- `PaymentOrderRepository` 已拆成 `PaymentOrderQueryRepository` / `PaymentOrderCommandRepository`，Postgres 和测试 fake 已同步。
- `user` 被 `payment` 的 openid 解析依赖，拆 `UserRepository` 读写 port 时需要同步 payment openid resolver、用户模块测试 fake、bootstrap。
- `user` 应用层已拆出 `commands`、`read_models`、`permissions` 和 login/profile/query/manage player use cases。`UserService` 已变为兼容 facade，公开方法签名保持不变。
- `UserRepository` 已拆成 `UserQueryRepository` / `UserCommandRepository`。`PaymentOpenIdResolver` 只依赖查询 port；Postgres 暂时仍由 `PostgresUserRepository` 同时实现两个 trait，并通过内部方法复用球员列表 SQL。
- `system` 应用层已拆出 `commands`、`read_models`、`permissions` 和 map settings / mini app runtime config use cases。`SystemSettingsService` 已变为 facade。
- `SystemSettingsRepository` 已拆成 `SystemSettingsQueryRepository` / `SystemSettingsCommandRepository`。`activity` 的 `ConfiguredLocationSearchGateway` 只依赖系统设置读侧 port。
- `wx` 模块体量较小，`WechatApi` 是外部网关 port，不适合按读写仓储拆分。当前已拆出登录、access token、手机号 use case，`WxService` 只做 facade。
- `auth` 已拆出 `commands`、`read_models`、`permissions` 和登录/校验管理员/管理员管理 use cases。`AuthService` 已变为 facade。
- `AdminUserRepository` 已拆成 `AdminUserQueryRepository` / `AdminUserCommandRepository`。Postgres 仍由 `PostgresAdminUserRepository` 同时实现两个 trait。
- `notification` 已拆出 `permissions` 和发送通知、查询/标记通知 use cases。`NotificationService` 已变为 facade。
- `NotificationRepository` 已拆成 `NotificationQueryRepository` / `NotificationCommandRepository`。`challenge` 测试 fake 已同步新构造方式。
- 球队 ID 数字化迁移已落地：`rs_teams.id` 为 `BIGINT`，球队相关引用列全部改为 `BIGINT`，并保留 `rs_teams.legacy_id` 作为历史映射。
- `rs_admin_team_assignment.team_id` 已补齐与 `rs_teams(id)` 的物理外键。
- `rs_user_billings.activity_id` 已补齐到 `rs_activity(id)` 的物理外键。
- billing 领域命名已进一步统一到 activity：应用层 `GameExpense*` 已改为 `ActivityExpense*`，账单类型改为 `activity_fee` / `activity_fee_reversal`。
- `rs_user_monthly_balance.game_fee_amount` 已改为 `activity_fee_amount`。
- 开发库账单/订单旧数据已按用户要求清空，相关账户与基金汇总已重置。
- 仅靠 skill 触发不足以稳定保证后端任务持续维护工作文档，因此已把约束同步写入后端子项目 `AGENTS.md` / `CLAUDE.md`。
- 后端全量 `clippy` 暴露出一批 team ID 数字化后的机械性借用写法，说明这轮 schema/类型迁移虽然功能正确，但还有一层静态质量收尾需要补。
- `remaining_team_activity_routes_test` 中仍有字符串 `team_id` 测试数据，造成鉴权前先触发 DTO 校验 `422`；这属于测试数据过期，不是运行时路由回归。
- `rs_recharge_records.transaction_no` 当前兼具“微信交易号”和“后台手工充值凭证”双重语义，因此不适合直接改造成 `rs_payment_orders` 的外键列。
- 新增独立的 `payment_order_no` 更符合边界：payment 模块只为系统内支付成功写这个字段，billing 后台手工充值继续使用 `transaction_no`。
- `PaymentBillingPort` 的真实职责是“支付成功后的结算落账”，与 billing 模块并非一一对应，改名为 `PaymentSettlementPort` 后边界更清晰。
- 订单状态 `paid` 不等于结算一定已完成。为支持“订单已 paid，但下游落账中断”的自愈路径，`sync_order_status` / 微信回调在命中已支付订单时仍应允许再次进入 settlement adapter。
- 充值入账幂等最稳的落点是数据库唯一约束：`rs_recharge_records.payment_order_no` 唯一后，adapter 可通过“先插充值记录，冲突则短路”避免重复加余额。
- Postgres 的 `ON CONFLICT (col)` 不能命中部分唯一索引；这轮真实测试已经验证过，最终改为普通唯一索引后行为正确。
- `rs_activity_order` 不是支付订单，而是活动费用快照。它按 `activity_id` 唯一保存费用描述、单人费用和人数，结算流程也会 upsert 这张表。
- 按用户最新约束，除报名、活动、用户外无需兼容旧数据，因此 `rs_activity_order` 直接重命名为 `rs_activity_fee_snapshots`，并重命名唯一约束和外键约束。
- 为降低小程序结算接口影响，保留既有 `/api/order` 和 `/api/admin/orders` 路由组；仅把费用快照子路径改为 `/activity-fee-snapshots`，自动费用计算子路径改为 `/fee/auto-calculate`。

## 2026-05-14 队员会员标识

- `is_member` 是 `rs_team_members` 上的队员属性，不复用 `rs_teams.is_vip` 或 payment/team_membership 概念。
- 新增成员和重新激活成员默认 `is_member = false`，旧客户端不传字段时行为保持兼容。
- `TeamMemberDto` 和 `TeamMemberWithInfoDto` 都需要返回 `is_member`，分别服务小程序和管理端。
- 后端 schema 测试约束 `rs_team_members.is_member` 为 `boolean NOT NULL DEFAULT false`。
## 2026-05-15 场馆角色与约队发布权限发现

- `CreateChallengeRequest.host_team_id` 当前必填，DTO、domain、repository、前端类型都沿用该假设。
- `CreateChallengeUseCase` 当前明确要求 actor 是 user，并通过 `ChallengeTeamAccessChecker::is_team_manager` 校验队长/领队。
- `rs_challenges.host_team_id` 非空外键到 `rs_teams(id)`；summary 查询使用 `INNER JOIN rs_teams host`，所以不能仅把 `host_team_id` 置空而不改查询。
- 当前 `User`/`UserDto` 只有 `is_manager`，没有更清晰的用户角色枚举或场馆身份。
- 管理端球员管理目前只支持基本资料、冻结、球队关系展示，尚无用户角色/场馆身份编辑。
- 方案 B 已确认并实现为 `rs_user_info.is_venue boolean not null default false`，保持用户/球员身份叠加。
- 场馆发布不创建虚拟球队，因此 `rs_challenges.host_team_id` 改为可空，外键删除行为改为 `ON DELETE SET NULL`。
- 创建约队时：有 `host_team_id` 走队长/领队校验；无 `host_team_id` 走 `is_venue` 校验。
- 用户澄清场馆球队约队应撮合两支球队，且第一支球队占位后应能组织队员报名，因此第一支球队接约时就生成 `away_team_id = NULL`、`opposing = 等待对手` 的活动。
- 现有 `guest_team_id` 保留给第二支球队；第二支球队接约时更新同一个活动，设置 `away_team_id = 第二支球队` 和双方对阵文案。

## 2026-05-16 微信手机号响应解析发现

- `/api/wx/getPhoneNumber` 的失败点在 `src/wx/adapters/api/real_wechat_api.rs`，原代码直接用 `response.json::<WechatErrorResponse>()` 解析微信响应，失败时只保留 `error decoding response body`，缺少上游 body 证据。
- 微信手机号接口成功响应中的 `phone_info` 字段使用 camelCase，例如 `phoneNumber`，而现有 `PhoneInfoResponse` 只声明了 Rust 字段 `phone_number`，没有 `serde(rename_all = "camelCase")`，因此正常 JSON 也会解码失败。
- 小程序调用仍期望后端返回 snake_case 的 `phone_number`；修复应限定在外部微信响应 DTO，不改变本系统 API 契约。
- 为后续排查微信网关、反代或网络异常，手机号响应解析失败时应记录 HTTP status、content-type 和原始 body 摘要。
- 微信成功响应会带 `errcode=0, errmsg=ok`；后端只应把非 0 errcode 视为微信 API 错误。
- 飞书健康告警应放在服务器侧监控脚本而非业务进程内，避免业务代码耦合告警渠道；当前采用 cron 每分钟检查 Docker health、本机 health 和公网 `/regist-v2/health`。

## 2026-05-17 小程序手机号绑定运行配置发现

- `MiniAppRuntimeConfig` 通过 `rs_system_runtime_configs.config_value` 保存为 JSON；新增字段必须考虑旧 JSON 兼容。
- `profile.require_phone_binding` 属于小程序运行配置的 profile section，默认 `false`，语义是控制小程序资料页是否展示和触发手机号绑定。
- `MiniAppRuntimeConfigDto` 也需要给 `profile` 加 `serde(default)`，否则管理端或脚本用旧 payload PATCH 配置时会因为缺少新 section 而失败。
- 该配置不涉及数据库迁移；持久化仍复用 `mini_app` config key。

## 2026-05-17 管理端报名列表过滤

- `registration_scope=team` 对应 `rs_activity.source_activity_id IS NOT NULL`，用于球队报名派生活动。
- `kind=individual` 对应 `rs_challenges.kind = 'individual'`，用于散人约队报名。
- `activity.match_kind=internal` 是比赛类型“队内内战”，不能用于散人报名过滤。

## 2026-05-17 管理端约队/散人报名编辑删除

- `CancelChallengeUseCase` 原先只允许 `ActorKind::User`，管理端即使可见约队也无法取消；本轮扩展为管理员可按后台权限取消。
- 更新接口需要保持六边形边界：application 使用 `UpdateChallengeCommand`，port 层使用 `UpdateChallengeFields`，避免 repository port 反向依赖 application command。
- 可编辑字段只覆盖 `rs_challenges` 自身基础信息；`kind`、主客队、报名关系和 `activity_id` 不应通过后台编辑接口修改。
- 普通管理员对无球队主体的场馆/散人记录没有球队授权锚点，因此仅超管可处理这类记录。

## 2026-05-17 后台创建散人报名

- `host_user_id` 是 `rs_user_info` 用户 ID；后台创建需要显式传入该 ID，不能复用管理员 ID。
- `CreateChallengeUseCase` 现在有两条创建分支：用户端分支仍使用当前用户；管理员分支只允许超管代场馆用户创建 `individual`。
- 后台创建校验发布用户 `is_venue=1`，保持与用户端无球队主体发布规则一致。

## 2026-05-17 散人报名详情完整名单

- `PostgresChallengeRepository::get_detail` 已经查询 `rs_challenge_individual_acceptances` 并组装 `individual_participants`，但 SQL 末尾有 `LIMIT 12`，会导致报名人数超过 12 时管理端详情页漏人。
- 管理端详情页是运营核对名单场景，应返回完整报名人员列表；列表页仍可只看 `accepted_count`，不受影响。
- 管理端列表页也需要头像昵称用于扫视，但不应拉完整名单；本轮在 summary 上增加前 3 人 `individual_participant_preview`，通过一次窗口函数查询按 challenge 批量装配。

## 2026-05-20 球队活动报名人数上限发现

- `/activity/:activity_id/my-stand` 对应后端 `ManageRegistrationUseCase::update_my_stand`。
- 旧逻辑中的 `ensure_registration_capacity` 会按 `players_per_team + 2` 做最大人数限制，并返回“本场报名已满员”。
- 当前产品规则是不限制球队活动个人报名最大人数，因此后端应直接 upsert 报名状态，不再统计容量人数。
