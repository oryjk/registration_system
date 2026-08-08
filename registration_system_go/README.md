# registration_system_go

赛事报名与球队管理的新 Go 后端，使用 Gin、PostgreSQL，并按业务模块遵守六边形架构。

要求 Go 1.26.5 或更高版本。macOS 26 不能使用旧的 Go 1.22 工具链运行测试。

## 当前范围

- 微信登录与 JWT 鉴权
- 超级管理员创建和查看场馆管理员
- 用户和球队角色
- 三种比赛发布模式
- `online_team` 球队候选申请、选择与退出事务
- 队内报名与散人对手报名数据模型（写入 API 待实现）
- 散人人数默认规则（配置管理 API 待实现）

订单、支付、账单、结算、签到和通知不在第一阶段范围内。Rust 后端保留为只读参考。

## 本地运行

Go API 直接在宿主机运行，Docker 只用于提供映射到本机 `5432` 端口的 PostgreSQL。

项目的 Makefile 固定使用国内 Go 模块代理 `https://goproxy.cn,direct` 和可在国内访问的 checksum database `sum.golang.google.cn`。本机直接运行 `go build`、`go test` 等命令时，建议同步设置全局 Go 环境：

```bash
go env -w GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn
```

不要通过 `GOSUMDB=off` 或通配 `GONOSUMDB` 关闭公开依赖的完整性校验。

```bash
cp .env.example .env
make migrate-up
make run
```

API 启动时会自动读取当前目录的 `.env`，系统已导出的环境变量优先。编译后也可以在项目目录直接运行：

```bash
go build -o ./api ./cmd/api
./api
```

健康检查：`GET http://127.0.0.1:18080/health`。

管理员接口：

- `GET /api/admin/admins`：超级管理员查看管理员列表
- `POST /api/admin/admins`：超级管理员创建场馆管理员
- `GET/POST /api/admin/teams`：管理员筛选、查看和创建球队
- `GET/PATCH/DELETE /api/admin/teams/:id`：管理员查看、更新和删除球队；已被比赛或申请引用的球队不能删除
- `GET/POST /api/admin/teams/:id/members`：管理员查看和添加球队成员
- `PATCH/DELETE /api/admin/teams/:id/members/:user_id`：管理员更新或移除球队成员
- `GET /api/admin/teams/:id/member-candidates`：管理员按真实姓名、昵称、手机号或用户 ID 查询可添加球员
- `PATCH /api/admin/teams/:id/captain`：管理员设置或取消队长；`user_id` 为 `null` 时取消
- `PATCH /api/admin/users/:id/profile`：管理员维护球员真实姓名和手机号
- `GET/POST /api/admin/matches`：超级管理员和场馆管理员查看、发布比赛
- `PATCH /api/admin/matches/:id/status`：管理员按状态机取消或推进比赛
- `DELETE /api/admin/matches/:id`：超级管理员永久删除任意状态比赛及其关联报名数据
- `GET /api/admin/matches/:id/team-applications`：管理员查看整队候选申请
- `POST /api/admin/matches/:id/team-applications/:application_id/select`：管理员选择客队
- `POST /api/admin/matches/:id/team-applications/:application_id/withdraw`：管理员让已选客队退出并重开招募

用户接口：

- `POST /api/auth/wechat/login`：微信 code 登录并获取用户 JWT
- `GET /api/teams/my`：查看当前用户所属球队
- `GET /api/matches`：分页查询比赛，可按状态和关键词筛选
- `GET /api/matches/:id`：查看比赛、报名组、各组已参赛人数和当前用户自己的报名状态
- `GET /api/matches/:id/team-applications`：主队管理者查看全部申请；候选队管理者只查看自己球队的申请
- `POST /api/matches/:id/team-applications`：候选球队队长或领队提交整队申请
- `POST /api/matches/:id/team-applications/:application_id/select`：主队队长或领队选择客队
- `POST /api/matches/:id/team-applications/:application_id/withdraw`：申请队撤回，或主客队管理者让已选客队退出

## 初始化管理员

数据库首次迁移后，在当前终端临时设置管理员账号和密码：

```bash
ADMIN_USERNAME=<username> ADMIN_PASSWORD='<password>' ADMIN_ROLE=super_admin make create-admin
```

初始化命令只允许在 `admin_users` 为空时执行，不会覆盖已有管理员。密码至少 6 个字符。

## 数据库版本管理

数据库 migration 使用 goose，SQL 查询类型使用 sqlc：

```bash
make migrate-status
make migrate-up
make migrate-down
make generate
```

API 和管理员初始化命令会在进程内自动加载 `.env`；migration 命令会通过 Makefile 将 `.env` 注入 goose。所有 migration 位于 `db/migrations/`，查询位于 `db/queries/`。`DATABASE_URL` 只从本地环境读取，不提交真实密码。

## 旧球队数据导入

导入命令从 `LEGACY_MYSQL_*` 环境变量读取旧 MySQL，只读获取球队、关联用户和成员关系；目标 PostgreSQL 使用现有 `DATABASE_URL`。先预演：

```bash
go run ./cmd/importlegacyteams --dry-run
```

确认汇总数量后正式导入：

```bash
go run ./cmd/importlegacyteams
```

目标写入位于单个事务内。dry-run 和任一步失败都会整体回滚；日志只输出新增/更新汇总，不输出连接串、openid、真实姓名或手机号。

## 旧比赛数据导入

导入命令从 `LEGACY_PG_URL`（旧 PostgreSQL）只读获取指定球队的历史比赛和报名，写入目标 PostgreSQL（`DATABASE_URL`）。导入前必须确认目标库已有对应主队和 21 个成员用户（见“旧球队数据导入”）。

先预演（需指定目标主队 ID 与队长用户 ID）：

```bash
go run ./cmd/importlegacymatches --dry-run --host-team-id 11 --captain-user-id 37
```

`unmapped_openids` 大于 0 表示有报名引用的目标用户不存在，导入会中止——需先补齐用户或与维护者确认后再正式导入：

```bash
go run ./cmd/importlegacymatches --host-team-id 11 --captain-user-id 37
```

历史比赛统一映射为 `offline_confirmed`；对手为“待定”或缺失的比赛会自动复用名为“待定”的占位客队。`players_per_team` 缺失补默认 8；报名 `stand` 0/1/2/3 映射为 `unknown`/`attending`/`leave`/`absent`，`registration_count` 为 0 时补 1。目标写入同样位于单个事务，dry-run 或任一步失败整体回滚。

## 验证

```bash
make verify
```
