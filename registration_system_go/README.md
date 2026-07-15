# registration_system_go

赛事报名与球队管理的新 Go 后端，使用 Gin、PostgreSQL，并按业务模块遵守六边形架构。

要求 Go 1.26.5 或更高版本。macOS 26 不能使用旧的 Go 1.22 工具链运行测试。

## 当前范围

- 微信登录与 JWT 鉴权
- 用户和球队角色
- 三种比赛发布模式
- 球队候选申请与选择
- 队内报名与散人对手报名
- 管理端人数默认配置

订单、支付、账单、结算、签到和通知不在第一阶段范围内。Rust 后端保留为只读参考。

## 本地运行

Go API 直接在宿主机运行，Docker 只用于提供映射到本机 `5432` 端口的 PostgreSQL。

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

## 初始化管理员

数据库首次迁移后，在当前终端临时设置管理员账号和密码：

```bash
ADMIN_USERNAME=<username> ADMIN_PASSWORD='<password>' ADMIN_ROLE=super_admin make create-admin
```

初始化命令只允许在 `admin_users` 为空时执行，不会覆盖已有管理员。密码至少 10 个字符。

## 数据库版本管理

数据库 migration 使用 goose，SQL 查询类型使用 sqlc：

```bash
make migrate-status
make migrate-up
make migrate-down
make generate
```

API 和管理员初始化命令会在进程内自动加载 `.env`；migration 命令会通过 Makefile 将 `.env` 注入 goose。所有 migration 位于 `db/migrations/`，查询位于 `db/queries/`。`DATABASE_URL` 只从本地环境读取，不提交真实密码。

## 验证

```bash
make verify
```
