# Go 球员基础资料与旧球队导入设计

## 目标

在 `registration_system_go` 中把真实姓名和手机号纳入球员基础信息，并将旧 MySQL `registration_system` 中的 1 支球队、21 名关联用户、21 条成员关系及队长引用导入新 PostgreSQL。保留目标库现有 3 支球队，不清库、不覆盖无关数据。

## 数据模型

为 PostgreSQL `users` 新增两个可空字段：

- `real_name VARCHAR(120) NULL`
- `phone_number VARCHAR(32) NULL`

两个字段进入 `internal/user/domain.User`。输入统一去除首尾空白，空字符串保存为 `NULL`；真实姓名最多 120 个字符，手机号最多 32 个字符。手机号暂不增加唯一约束，避免把尚未确认的业务唯一性固化到数据库，并允许未提供手机号的微信用户正常创建。

旧库关联的 21 名用户均有真实姓名；9 人有 11 位手机号，12 人未提供手机号，已有手机号无重复。

## 后端边界

用户资料维护属于 user 模块，不放进 team handler：

- user domain 负责真实姓名和手机号的规范化与长度校验。
- user ports 增加资料更新能力。
- user PostgreSQL adapter 通过 sqlc 更新资料。
- user HTTP adapter 提供管理员资料更新接口 `PATCH /api/admin/users/:id/profile`。
- 只有已认证管理员可调用；目标用户不存在时返回 404，校验失败返回 400。

现有微信登录响应补充 `real_name`、`phone_number`。Go 配套小程序只同步类型和会话数据，本次不新增小程序资料编辑页面。

## 球队成员联动

成员详情和候选人模型补充真实姓名、手机号。管理端候选搜索覆盖：

- 昵称
- 真实姓名
- 手机号
- 用户 ID

Go 管理端成员列表优先显示真实姓名，昵称作为辅助身份；手机号有值时展示。成员编辑交互可维护真实姓名、手机号以及原有成员角色和状态。用户资料与成员关系仍由各自接口负责，前端按明确顺序提交并分别处理错误，不在 team handler 中跨聚合更新用户资料。

## 导入工具

在 Go 项目中提供独立导入命令，运行时通过环境变量读取源 MySQL 和目标 PostgreSQL 连接信息，不提交任何凭据。命令支持 `--dry-run`，正式导入在单个 PostgreSQL 事务中执行。

导入规则：

1. 从旧 MySQL 读取唯一球队及其 21 条成员关系和关联用户。
2. 用户按 `openid` 匹配；不存在则新增，存在则更新本次支持的基础资料。
3. 球队按精确名称匹配；不存在则新增。若目标存在多个同名球队，立即失败，不猜测目标。
4. 成员按 `(team_id, user_id)` 匹配并更新或新增。
5. 角色映射为 `captain`、`vice_captain`、`member`；旧状态 1 映射 `active`，0 映射 `inactive`。
6. 最后将旧 captain 映射后的目标用户写入球队 `captain_id`。
7. 重置受影响 identity sequence，确保后续正常插入不会撞 ID。

导入可重复执行，不删除目标现有记录。任一步失败则回滚整个目标事务；源 MySQL 始终只读。

## 安全与审计

- dry-run 输出源记录数、预计新增/更新数和冲突，不打印 openid、手机号、连接串或其他个人敏感信息。
- 正式导入前再次核对目标数量，防止盘点后发生未预期变化。
- 正式导入后核对目标球队、用户、成员、角色、状态和 captain 引用。
- 不迁移新 schema 不支持的 union_id、旧 username、请假时间等字段。

## 测试与验收

后端按 TDD 实现：

- migration contract 测试先证明字段缺失，再新增 migration。
- user domain 测试覆盖去空白、空值和长度限制。
- user application/HTTP 测试覆盖管理员更新、404 和校验错误。
- team repository/HTTP 测试覆盖新增字段和姓名/手机号搜索。
- 导入映射测试覆盖角色、状态、可空手机号、重复执行和同名球队冲突。

实现后执行：

```bash
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

Go 管理端执行 `bun run type-check`、`bun run lint`、`bun run build`，并对桌面与移动视口的成员管理流程进行浏览器验证。数据库导入以 dry-run、正式事务和导入后 SQL 对账作为最终验收证据。
