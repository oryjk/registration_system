# Findings

## 2026-07-17 历史比赛迁移执行（补用户、合并重复账号、正式导入）

- 9 个未映射 openid 逐一核验：8 人为真新用户（昵称/真实姓名/手机号与目标 21 人均无交集）；1 人（源 user 16「阿祖」）与目标 #38「东安利马」真实姓名同为桂强，系同一人双微信账号（两账号 union_id 均为空，无法据此判重，以真实姓名为据）。用户决定：8 人补迁，阿祖报名合并到 #38。
- 用户明确：补人/合并属一次性工作，不写 Go 代码，直接用 SQL 完成；导入器保持原状（曾按 TDD 起了补迁+别名映射的分支，已按用户要求整体撤销）。
- 一次性 SQL（事务、幂等、先 ROLLBACK 预演再 COMMIT）：插入 9 用户（8 新 + 阿祖临时用户，均 active，真实姓名/手机号/头像 URL 来自源库，本次头像均为正常 http URL 无需 Data URI 规范化）+ 8 条 team 11 成员关系（源 role=member、status=0 → inactive）；阿祖不建成员关系。
- 源库 rs_activity id=6、7 两场 end_time=start_time，违反目标 `matches_time_order_check`；按其 20:00 开球友谊赛常规时长，一次性 SQL 预置这两场（end_time=start+2h，publication_mode=offline_confirmed、opponent 待定、players_per_team=8），导入器随后按 (name, start_time, host_team_id) 命中走 update 路径，不改动起止时间。其余 96 场起止时间原样保留（源数据多为跨 2-3 天，属旧系统语义，不改写）。
- 阿祖的 40 条历史报名与 #38（东安利马）100% 同场重叠（同一人两账号重复报名）；目标 `(group_id, user_id)` 唯一约束本就不允许这种重复。合并落地方式：导入完成后删除阿祖临时用户（id=72），`ON DELETE CASCADE` 连带清掉 40 条重复报名；#38 自有 50 条报名保持不变。其中 4 场阿祖 stand=1（出席）而 #38 为 stand=3（缺席），按合并语义以 #38 现有记录为准。
- 正式导入结果：`matches=98`（registering 5、ended 80、cancelled 13，与源 0/2/3 分布一致）；`match_registrations=1946`（unknown 43、attending 970、leave 686、absent 247，与源剔除阿祖后逐值一致）；主队报名组 98 个；`players_per_team` 全部落为 8（源 89 场为 8、9 场空/0 补默认）。
- 对手映射复核：源 19 场真实对手名（away_team_id 为空、opponent_name 原文保留）、79 场「待定/对手待定/空」引用占位客队「待定」，与目标实值逐值一致；早前「19 场含对手待定」的估计以本次实测为准。
- 目标终态：users=29（21+8）、team 11 成员=29（inactive 11 = 旧冻结 3 + 新迁 8）、占位客队「待定」1 支。
- 含 openid/手机号的临时 SQL 仅存放本机 `/tmp`，不入仓库；执行后已清理。
- 验证：`gofmt -w .`、`go vet ./...`、`go build ./cmd/api`、`go test -race ./...`（含 Testcontainers）全部通过；按任务范围未运行前端 E2E。

## 2026-07-16 洺悦御府历史比赛迁移

- 用户要求只迁移旧库中与“洺悦御府”关联的历史比赛；若 Go Match 缺字段，需要先实现正式功能再导入。
- 源库实为 PostgreSQL（`211.154.18.252:15432/registration_system`，即 Rust 自身库），不是 MySQL；之前文档称 MySQL 为沿用旧名。表与字段与 Rust migration 的 `rs_*` schema 一致。
- 源库目标球队为“东安洺悦联队”（`rs_teams.id=1`，`home_team_id` 现为 bigint）。目标 Go 库已存在的对应球队为 `teams.id=11`（name=“洺悦御府”，由上一轮球队导入写入）。源球队 1 → 目标球队 11。
- 涉及球队 1 的历史比赛共 98 场（主队 1，`away_team_id` 全部为空）：状态 0=5、2=80、3=13；`match_kind` 全部为 `external`。时间范围 2024-07-04 ~ 2026-07-14。
- 报名记录（`rs_user_activity`）共 1986 条：stand 0=43、1=976、2=700、3=267。`paid` 字段全部为 0（与本期不迁财务一致）。
- 98 场比赛的 `players_per_team`：89 场=8、5 场=0、4 场=NULL。Go `matches.players_per_team` 要求 >0；NULL 与 0 必须在导入边界给默认值（来源中绝大多数为 8）。
- `opposing` 文本：98 场中 19 场有真实对手名（如“叮叮猫”“老朋友”等，共 16 个不同值，含“对手待定”），其余为 `待定` 或空。源库所有活动都是 `match_kind=external`，`away_team_id` 从不为真实客队，对手只是文本字段。
- 30 个不重复用户报名过球队 1 的比赛；其中 9 人的 openid 当前不在目标库（上一轮球队导入只迁了 21 个当时在册成员）。这 9 人目前仍是源球队 1 的成员 —— 源球队 1 现在有 35 名成员，比目标 21 多 14 人。导入比赛前必须先补齐这些用户与成员关系，否则报名外键无法落地。
- 所有报名用户都来自源球队 1 的成员（散人/外部用户为 0），无需迁移队外用户。
- `rs_registration_log` 有 568 条审计行；目标 Go schema 无对应表，本期不迁（属历史审计，非报名闭环必需）。
- 涉及球队 1 的 `rs_challenges` 有 11 条（约队/候选申请流），本期按用户范围只迁“历史比赛”即 `rs_activity`+`rs_user_activity`，候选/约队状态机不迁。
- 目标 Go 库现状：`matches=0`、`users=21`、`team_members=21`（team 11）、goose version 3。
- 当前 Go `matches` 强制要求发布模式、对手状态、主队、每队人数、起止时间、地点和创建来源；历史活动是否能无损映射需要按旧表实值核验（见下）。
- 本次不运行前端 E2E；前端变更仅做 type-check、lint、build 和用户人工验收。

### 字段映射难点（源 rs_activity → 目标 Go matches）

- Go 把比赛发布模式固化为三选一枚举并配数据库 CHECK：`offline_confirmed`（必须填对手名、`opponent_state=no_recruitment`、无客队）或 `online_team`/`online_individual`（禁止填对手名）。历史活动 `opposing` 同时存在真实对手名和“待定”占位文本，与 Go 二元约束不直接兼容。
- 历史活动没有“创建来源”概念，但有 `created_at`；导入需补一个确定的 created_by（管理员或指定用户），且 Go 要求 user/admin 创建者二选一。
- Go `Match.status` 为字符串枚举（registering/ongoing/ended/cancelled），源为 smallint 0/2/3，可直接映射（无 1/ongoing）。
- 结论：导入器需在边界做语义化映射（决定每场历史比赛落到哪个 PublicationMode、如何处理“待定”对手文本、补默认 players_per_team 与创建者），不改变源数据。

## 2026-07-16 旧 MySQL 球队数据导入

- 用户指定源库为旧 MySQL `registration_system`，目标为 `registration_system_go` 使用的新 PostgreSQL。
- 旧库连接凭据、源球队表名和字段映射尚未确认；在真实写入前仅做只读检查。
- 目标 `teams` 表的历史空表结论来自 2026-07-15，属于可能漂移的信息，需要现场复核。
- 2026-07-16 现场复核：目标 PostgreSQL `teams` 已有 3 条（ID 1、2、4），`users` 与 `team_members` 均为 0，不能清库或直接复用旧球队 ID。
- 用户指定的 MySQL 可使用仓库已有历史迁移账号只读连接；`rs_teams` 有 1 条，名称为“洺悦御府”，无空名、超长名或重名。
- 源球队字段为字符串 UUID、名称、简介、Logo、旧 captain_id、join_password、tinyint 状态与时间戳；目标球队使用 bigint identity，且 captain_id 必须引用目标 `users`。
- 源 `rs_team_members` 有 21 条、对应 21 个用户和 1 支球队：18 条有效普通成员、1 条停用普通成员、1 条有效队长、1 条有效副队长。
- 目标库当前没有用户，若迁移成员，必须同步迁移用户或先建立旧用户到新用户的身份映射。
- 用户确认需要连同成员关系导入，因此范围为 1 支球队、21 个关联用户、21 条成员关系和球队队长引用。
- 21 个关联用户在源库均存在，`openid`、昵称、头像均非空，`openid` 无重复，用户状态均为 1（有效）。
- 源球队 `captain_id` 对应的成员存在，角色为 `captain`、状态为 1。
- 源成员状态中仅 1 条普通成员为 0，其余 20 条为 1；可直接映射为目标 `inactive` / `active`。
- 目标用户模型不承载旧库的 union_id、username、real_name、phone_number、请假时间等字段，本次只能迁移目标 schema 支持的 openid、nickname、avatar_url、status 与时间戳。
- 已拉取最新远端提交 `feat: manage team members and captains`；本地主分支完成 rebase，原有未提交改动已保留。autostash 恢复时仅 `task_plan.md` 冲突，已合并保留双方章节。
- 最新 Go 用户模型和 `users` 表仍只有 openid、nickname、avatar_url、status 与时间戳；当前没有用户资料维护 API。
- 最新球队成员/候选人查询只返回昵称和头像，候选搜索只覆盖昵称和用户 ID；管理端也不展示真实姓名或手机号。
- 21 名旧成员的真实姓名全部非空，最长 9 个字符；9 人有 11 位手机号、12 人手机号为空，非空手机号无重复。
- 真实姓名和手机号应使用目标可空字段；手机号暂不设唯一约束，避免把业务假设固化到数据库并兼容未来空值/共享号码情况。
- 已新增 goose migration 3：`users.real_name VARCHAR(120) NULL`、`users.phone_number VARCHAR(32) NULL`，并贯穿用户领域、管理员资料 API、登录响应、球队成员/候选响应与候选搜索。
- React 管理端成员抽屉已支持展示和维护真实姓名、手机号；桌面与移动聚焦 E2E 及截图检查通过。
- 正式导入前目标库由早先 3 支球队漂移为 1 支；剩余球队 `asdadsdd` 无比赛引用且与源球队不重名，因此保留并继续导入。
- dry-run 汇总为新增 21 用户、1 球队、21 成员且 0 更新；正式导入汇总相同。
- 导入后目标总计 21 用户、2 球队、21 成员；“洺悦御府”有 20 个 active、1 个 inactive 成员，角色为 1 captain、1 vice_captain、19 member。
- 导入球队的 captain_id 与 active captain 成员一致；21 人均有 real_name，9 人有 phone_number；goose 当前 version 3。
- 导入不复用旧 ID，目标 identity 自动生成新 ID，因此无需手工重置 sequence，避免无意义地改写并发序列状态。
- 头像不显示的根因位于旧数据格式：21 个源 `avatar_url` 均为以 `/9j/` 开头的裸 JPEG Base64，没有 URL scheme 或 Data URI 前缀；前端按 URL 加载后回退为姓名首字。
- importer 已在写入边界把裸 JPEG/PNG/GIF/WebP Base64 规范化为对应 Data URI，同时保持现有 URL/Data URI 不变。
- 真实幂等更新后 21/21 个成员头像均为 JPEG Data URI；抽样可解码为 132x132 JPEG。Playwright 桌面/移动用例验证 Data URI 图片加载后 `naturalWidth > 0`。

## 2026-07-14 项目初始化

- 新后端模块路径为 `github.com/oryjk/registration_system/registration_system_go`。
- 当前机器是 macOS 26.4；旧 `/usr/local/go` 1.22.3 生成的测试二进制缺少 `LC_UUID`，会被 dyld 在启动前拒绝。
- Go 1.26.5 生成的测试二进制包含 `LC_UUID`，可以正常运行，因此项目最低版本固定为 Go 1.26.5。
- 用户 Go 环境的 `GOSUMDB=sum.golang.google.cn` 与当前模块代理不匹配；Makefile 仅对项目命令导出标准 `sum.golang.org`，不修改用户全局 Go 配置。
- `go build ./cmd/api` 会在项目根生成名为 `api` 的本地二进制；项目统一使用 `-o /tmp/registration-system-go-api`。
- Rust 后端目录在初始化期间保持零 diff。

## 2026-07-14 新数据库

- 新 Go 开发库位于 `local233` 的独立 `registration-system-go-postgres` 容器，库名为 `registration_system_go`。
- 容器使用 PostgreSQL 16，映射宿主机 5432，数据持久化在 `/opt/data/registration-system-go`。
- 本机已经通过外部地址验证连接，初始 public schema 没有业务表。
- 连接凭据只用于本地环境，不写入仓库；集成测试继续使用 testcontainers 隔离数据库。

## 2026-07-15 管理端比赛闭环

- 开发运行拓扑固定为本机 Go 进程连接 `127.0.0.1:5432` 的 PostgreSQL 容器；Go 服务和前端不容器化。
- migration version 1 已应用，当前 `admin_users`、`users`、`teams`、`matches` 均为空。
- `matches.created_by_user_id` 当前为非空，管理员创建比赛需要新增管理员创建来源并保持两种创建者互斥。
- 管理比赛采用状态取消，不物理删除 Match 聚合数据。
