# 后端重构发现记录

## 2026-05-27 access log 业务语义发现

- access log 原本把所有请求统一记成“业务请求”，问题不在 tracing 配置，而在 `src/bootstrap/app.rs` 中间件 message 写死。
- 当前日志字段已经有 method/path/query/body/status/latency，但缺少面向业务排查的稳定语义层，导致看本地日志时必须手动翻译接口路径。
- 这类需求更适合放在 bootstrap 日志层做 method + path 语义映射，而不是分散到各个 handler 单独打印一条“业务日志”，否则口径容易不统一。
- 动态路由需要单独做后缀分类，否则 `/api/activity/:id/team-registration`、`/api/teams/:id/logo` 这类接口仍会退化成泛化日志。

## 2026-05-27 后台场馆管理发现

- 现有后端已经有 `POST /api/admin/users/players/role-users` 和 `PATCH /api/admin/users/players/:user_id/password`，能创建独立场馆账号和改密码，但还没有独立的“场馆管理”查询/编辑入口。
- 场馆身份仍然是 `rs_user_info.is_venue`，天然允许和普通球员身份叠加，因此“把小程序用户设为场馆”本质是对已有用户做更新，而不是创建新用户。
- 用户端密码登录 `UserLoginUseCase::execute_with_password` 已经按 `user.status != 1` 拒绝，这意味着冻结后“不能登录”底层已具备，但需要确认场馆发布链路也显式拦截冻结用户。
- 场馆发布约队/散人报名目前在 `challenge/application/use_cases/create_challenge.rs` 走 `user.is_venue == 1` 校验，还需要补 `status == 1` 约束。
- 管理端当前只有泛球员管理页面和 `is_venue` 开关，没有独立场馆列表、搜索绑定小程序用户、独立账号创建/改密入口。
- “删除场馆”需要按来源区分语义：`admin_role_user_*` 且带密码的独立账号可物理删除；已有小程序用户只移除 `is_venue`，保留原用户记录。
- 场馆页要区分“独立账号”和“绑定用户”，前端不能只靠 `is_venue`；本轮通过在 player 列表 DTO 补 `username` 字段来判断来源。

## 2026-05-23 散人约队最少/最多人数配置发现

- `Challenge::signup_capacity()` 当前既用于散人约队最大人数，也间接影响前端显示；需要拆成 `min_signup_players()` 和 `max_signup_players()` 这类明确语义。
- `AcceptChallengeUseCase::accept_individual_challenge` 当前在应用层按 `accepted_count >= challenge.signup_capacity()` 拦截，应该改为按 `max_signup_players()` 拦截。
- `PostgresChallengeRepository::accept_individual` 当前插入后按 `players_per_team * 2` 判断是否更新状态；新规则应按 `min_signup_players()` 判断是否已成行。
- `UpdateChallengeFields` 当前只包含基础字段；后台编辑人数上下限需要从 DTO -> command -> fields -> repository 全链路传递。
- 旧数据兼容更适合把 `min_players/max_players` 设计为 nullable，并在领域层提供默认计算，而不是一次性回填写死。

## 2026-05-23 散人约队支付方式发现

- `Challenge` 领域模型目前没有支付方式；`CreateChallengeCommand` 和 Web DTO 也没有 `payment_mode`。
- `ChallengeCommandRepository::accept_individual` 目前只接收 `challenge_id` 和 `user_id`，因此无法写入支付状态、支付截止时间或订单关联。
- `PaymentOrderType::Activity` 已存在，适合用于散人约队报名支付，但 `HandlePaidOrderUseCase` 目前只处理充值和球队会员。
- 支付 settlement port 当前聚焦充值和球队会员；散人报名支付回写更适合通过 payment settlement port 新增 `settle_activity_payment`，由 PostgreSQL adapter 更新 `rs_challenge_individual_acceptances`。
- 系统内通知模块已经存在，赛后未支付提醒应复用 notification application service。
- `rs_challenge_individual_acceptances` 需要保存 `payment_status`、`payment_deadline_at`、`payment_order_no`、`payment_notified_at`，分别服务支付状态展示、赛前自动取消、支付回写和赛后通知去重。
- 散人支付下单不应直接依赖 challenge repository；payment 模块新增 `ActivityPaymentAccessPort` 查询/关联散人报名，保持 payment 与 challenge 持久化细节解耦。
- 自动处理任务放在 app bootstrap 后台 loop 中，每 60 秒执行一次；即使前端不打开详情页，赛前超时取消和赛后通知仍会发生。

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

## 2026-05-20 球员列表 bigint/text 500 发现

- 线上日志 `operator does not exist: bigint = text` 指向 SQL 比较两侧类型不一致。
- 报错链路是 `list_players_handler -> ManagePlayerUseCase::list_players -> PostgresUserRepository::do_list_players_admin`。
- `do_list_players_admin` 的总数查询和分页查询都还在用 `JOIN rs_teams t ON t.id = tm.team_id::text`。
- `do_find_player_teams` 也保留了 `CAST(t.id AS TEXT) AS team_id` 和 `tm.team_id::text`。
- 当前 schema 已经把 `rs_teams.id` 和 `rs_team_members.team_id` 迁移为 `BIGINT`，所以这里应按 Rust `i64` 与 SQL bigint 全链路处理。

## 2026-05-20 小程序首页装修配置后端发现

- `MiniAppRuntimeConfig` 当前通过 serde 直接存入 `rs_system_runtime_configs.config_value`，domain `sanitize()` 是保护默认值和范围的主要入口。
- `MiniAppHomeRuntimeConfig` 新增字段如果没有 `#[serde(default)]`，旧 JSON 会反序列化失败；`hero_banners` 需要默认函数保证兼容。
- `GET /api/system/mini-app-runtime-config` 不需要登录，适合小程序启动和首页直接读取；管理端更新接口已经要求 super admin。
- 装修图片上传需要强制进入 MinIO，因此应复用用户头像链路里的 `save_minio_bytes`，而不是球队 Logo 使用的按配置 `save_upload_bytes`。
- 对象 key 采用 `mini-app/home-banners/<uuid>.<ext>`，与头像和球队 Logo 目录分开，便于后续清理和权限管理。

## 2026-05-23 散人约队最少/最多人数配置发现

- `Challenge::signup_capacity()` 原本把散人容量固定为 `players_per_team * 2`，与“赛制”和“最多报名人数”两个概念混在一起。
- 新规则需要三个独立语义：`players_per_team` 是赛制，`min_players` 是成行阈值，`max_players` 是报名上限。
- 散人达到 `min_players` 后状态可变为 `matched`，但只要未达到 `max_players`，仍应继续允许报名；因此 application 接约入口不能把散人 `matched` 直接视为不可报名。
- 后台把 `max_players` 改小到小于当前已报名人数时不应踢人，也不需要在 update use case 中查当前报名数；后续新增报名由 accept use case 拦截。

## 2026-05-24 队长/场馆角色账号管理发现

- 场馆身份是 `rs_user_info.is_venue`，和普通球员身份可叠加；创建场馆账号只需要设置该字段并保留普通用户属性。
- 队长身份是球队关系，不是用户字段；现有约队发布和球队管理会看 `rs_teams.captain_id` 或成员角色 `captain/leader`。
- 创建队长账号如果不绑定球队，后端无法证明该用户具备队长权限；因此本轮 `role=captain` 要求传 `team_id`，并在同一仓储方法中更新 `rs_teams.captain_id` 与 `rs_team_members.role='captain'`。
- 账号密码登录需要 `rs_user_info.password_hash`，但历史 `username` 可能重复；数据库唯一索引只约束 `password_hash IS NOT NULL` 的账号用户，应用层额外用 `find_by_username` 拒绝账号冲突。
- 修改密码接口限制为超级管理员，且目标用户必须是场馆或拥有 active captain 球队关系，避免误给普通用户开放角色账号管理能力。

## 2026-05-27 首页活动/约队查询发现

- `/api/activity/infos` 原先无法按具体球队过滤，首页只能宽拉取再前端筛选；新增 `team_id` 后可直接返回 `home_team_id = team_id OR away_team_id = team_id` 的活动。
- activity list 有三组查询：状态 counts、filtered total、分页 rows；三者都需要一致叠加 `team_id`，否则前端分页/统计会和列表不一致。
- counts 查询中的 `OR` scope 条件必须用括号包起来，再 `AND team_id`，否则 SQL 优先级会让 `team_id` 只作用于 `direct` 分支。
- `/api/challenges` 的未来过滤适合放在通用列表 query 中，字段为 `starts_after`，Postgres 语义为 `c.start_time > starts_after`。
- 未来约队机会和当前球队无关，首页不应走 `team_id` 分支；需要走 public/auth 列表，这样可以展示所有未来约队并保留当前用户的散人报名状态。
- `/api/teams/my-teams` 原本只返回球队基础信息，小程序为了判断 `canManageTeam` 继续请求完整 `/api/teams/:id`；这会把首页活动/约队请求挡在 session bootstrap 后面。
- 当前用户在球队内的 `role`、`joined_at` 和 active 成员数量都能在 `rs_team_members` 上一次查询得到，适合由 `/api/teams/my-teams` 作为轻量摘要返回。

## 2026-05-27 `/api/activity/infos` 性能发现

- 当前 activity list repository 会对 PostgreSQL 顺序执行 3 条查询：counts、filtered total、rows；当数据库在远端时，哪怕 SQL 本身极快，也会累计 3 次网络往返。
- `EXPLAIN ANALYZE` 显示这 3 条 SQL 在数据库内部执行都在 `1ms` 内，且 `rs_activity` 当前只有 `105` 行，所以加索引不会显著改变这次接口耗时。
- `DATABASE_URL=117.72.164.211:5432` 指向的是 `jd` 上 Docker 暴露的 PostgreSQL；`jd` 的 `5432` NAT 到本机容器 `172.17.0.3:5432`。
- `peiqian` 上也有独立 PostgreSQL 暴露 `5432`，但从 `jd` 和本机直连 `peiqian:5432` 都是 `Connection refused`，说明当前业务流量并没有经由 `jd -> peiqian:5432`。
- 本机到 `jd:5432` 的 TCP 建连耗时在 `44ms ~ 158ms` 间波动，远高于数据库内部执行时间，是当前接口慢的主要来源。
