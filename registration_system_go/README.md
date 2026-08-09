# registration_system_go

赛事报名与球队管理的新 Go 后端，使用 Gin、PostgreSQL，并按业务模块遵守六边形架构。

要求 Go 1.26.5 或更高版本。macOS 26 不能使用旧的 Go 1.22 工具链运行测试。

## 当前范围

- 微信登录与 JWT 鉴权
- 超级管理员创建和查看场馆管理员
- 用户和球队角色
- 三种比赛发布模式
- `online_team` 球队候选申请、选择与退出事务
- 队内报名与散人对手报名，包括用户侧幂等更新、取消、容量和并发控制
- 散人人数默认规则（配置管理 API 待实现）

订单、支付、账单、结算、签到和通知不在第一阶段范围内。Rust 后端保留为只读参考。

## 本地运行

Go API 直接在宿主机运行，本地开发不使用 Docker 启动服务。请提前准备可通过 `DATABASE_URL` 访问的 PostgreSQL，并完成 schema migration；数据库可以是本机已安装的 PostgreSQL 或独立开发库。

项目的 Makefile 固定使用国内 Go 模块代理 `https://goproxy.cn,direct` 和可在国内访问的 checksum database `sum.golang.google.cn`。本机直接运行 `go build`、`go test` 等命令时，建议同步设置全局 Go 环境：

```bash
go env -w GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn
```

不要通过 `GOSUMDB=off` 或通配 `GONOSUMDB` 关闭公开依赖的完整性校验。

```bash
cp .env.example .env
make migrate-up
go run ./cmd/api
```

API 启动时会自动读取当前目录的 `.env`，系统已导出的环境变量优先。编译后也可以在项目目录直接运行：

```bash
go build -o ./api ./cmd/api
./api
```

健康检查：`GET http://127.0.0.1:18080/health`。

API 契约与在线调试入口：

- Swagger UI：`http://127.0.0.1:18080/api/docs/`
- OpenAPI YAML：`http://127.0.0.1:18080/api/docs/openapi.yaml`

Swagger UI 5 的静态资源和 OpenAPI 3.0.3 文档均嵌入 Go 二进制，访问时不依赖 CDN，也不需要 Docker。`/api/v1/app` 下的受保护接口需要用户 JWT，`/api/v1/admin` 下的受保护接口需要管理员 JWT；在 Swagger UI 的 Authorize 输入框中填写令牌值，bearer scheme 会生成对应的 `Authorization` 请求头。

管理员接口统一位于 `/api/v1/admin`：

- `GET/POST /api/v1/admin/admins`
- `GET/POST /api/v1/admin/teams`
- `GET/PATCH/DELETE /api/v1/admin/teams/:id`
- `GET/POST /api/v1/admin/teams/:id/members`
- `PATCH/DELETE /api/v1/admin/teams/:id/members/:user_id`
- `GET /api/v1/admin/teams/:id/member-candidates`
- `PATCH /api/v1/admin/teams/:id/captain`
- `PATCH /api/v1/admin/users/:id/profile`
- `GET/POST /api/v1/admin/matches`
- `PATCH /api/v1/admin/matches/:id/status`
- `DELETE /api/v1/admin/matches/:id`
- `GET /api/v1/admin/matches/:id/team-applications`
- `POST /api/v1/admin/matches/:id/team-applications/:application_id/select`
- `POST /api/v1/admin/matches/:id/team-applications/:application_id/withdraw`

小程序/H5 接口统一位于 `/api/v1/app`：

- `POST /api/v1/app/auth/wechat/login`：微信 code 登录并获取用户 JWT
- `GET /api/v1/app/teams/my`：查看当前用户所属球队
- `GET /api/v1/app/matches?scope=all|mine`：分页查询全部或与当前用户有关的比赛
- `GET /api/v1/app/matches/:id`：查看比赛、报名组、各组已参赛人数和自己的报名状态
- `PUT /api/v1/app/matches/:id/groups/:group_id/my-registration`：创建或幂等更新自己的报名
- `DELETE /api/v1/app/matches/:id/groups/:group_id/my-registration`：幂等取消自己的报名
- `GET/POST /api/v1/app/matches/:id/team-applications`：按球队角色查看或提交整队申请
- `POST /api/v1/app/matches/:id/team-applications/:application_id/select`：主队管理者选择客队
- `POST /api/v1/app/matches/:id/team-applications/:application_id/withdraw`：撤回申请或退出已选客队

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

导入命令从 `LEGACY_MYSQL_*` 环境变量读取旧 MySQL，只读获取球队、关联用户和成员关系；目标 PostgreSQL 使用现有 `DATABASE_URL`。源 MySQL 不会被写入。首次历史对账先执行全量预演：

```bash
go run ./cmd/importlegacyteams --mode full --dry-run
```

确认汇总数量后正式导入：

```bash
go run ./cmd/importlegacyteams --mode full
```

首次全量对账完成后，切换前的重复同步使用 `--mode incremental --dry-run` 预演，确认后再去掉 `--dry-run` 执行。两种模式都只写目标 PostgreSQL。

目标写入位于单个事务内。dry-run 和任一步失败都会整体回滚；日志只输出新增/更新汇总，不输出连接串、openid、真实姓名或手机号。

## 旧比赛数据导入

导入命令从 `LEGACY_PG_URL`（Rust 旧 PostgreSQL）通过只读事务获取指定球队的历史比赛和报名，写入目标 PostgreSQL（`DATABASE_URL`）。该命令不会修改 Rust 数据。导入前必须确认目标库已有对应主队和成员用户（见“旧球队数据导入”）。

先预演（需指定目标主队 ID 与队长用户 ID）：

```bash
go run ./cmd/importlegacymatches --mode full --dry-run --legacy-team-id <source-team-id> --host-team-id <target-team-id> --captain-user-id <target-user-id>
```

`orphan_references` 大于 0 或 `conflicts` 大于 0 时不要正式导入；先补齐映射或确认差异。首次全量预演确认后执行：

```bash
go run ./cmd/importlegacymatches --mode full --legacy-team-id <source-team-id> --host-team-id <target-team-id> --captain-user-id <target-user-id>
```

之后的切换前同步改用 `--mode incremental`，仍然先 dry-run。目标写入位于单个事务，dry-run 或任一步失败整体回滚；源库始终只读。切换时允许现有 Rust JWT 和缓存自然保留，用户统一重新登录，不需要服务端清理。

## 验证

```bash
gofmt -w .
go test -run '^$' ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

以上命令不启动 Docker。完整 PostgreSQL 并发集成测试位于 `internal/match/adapters/postgres`，需要隔离测试数据库环境；没有独立测试库时不要把 `DATABASE_URL` 指向现有开发或生产数据来运行测试。
