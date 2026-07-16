# Findings

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
