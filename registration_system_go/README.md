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

```bash
cp .env.example .env
set -a
source .env
set +a
go run ./cmd/api
```

健康检查：`GET http://127.0.0.1:18080/health`。

## 数据库版本管理

数据库 migration 使用 goose，SQL 查询类型使用 sqlc：

```bash
make migrate-status
make migrate-up
make migrate-down
make generate
```

所有 migration 位于 `db/migrations/`，查询位于 `db/queries/`。`DATABASE_URL` 只从本地环境读取，不提交真实密码。

## 验证

```bash
make verify
```
