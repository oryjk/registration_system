# registration_system_go - AGENTS

## 项目定位

新的赛事报名与球队管理后端，**当前唯一在开发的后端**。第一阶段优先实现微信登录、用户/球队权限和 Match 比赛闭环。旧 Rust 项目 `../registration_system_rs/` 已停止开发并从工作区删除（2026-08-30，需要核对旧实现时从 git 历史检出只读查看）；不要重建或修改它。

历史数据已由 `scripts/migrate-legacy.sh`（`cmd/migratelegacydb`）从 Rust 旧库全量迁入 Go 结构（迁移直连线上旧库，不依赖已删除的代码目录）；后续增量迁移与所有新功能都在本项目实现。

本项目最低工具链为 Go 1.26.5；macOS 26 上不要回退到无法生成 `LC_UUID` 的旧 Go 1.22 工具链。

## 推荐定位顺序

1. `internal/bootstrap` 和目标模块 `adapters/http/routes.go`
2. HTTP DTO / handler
3. application use case
4. ports
5. adapters/postgres 与 `db/queries`
6. `db/migrations`

## 架构约束

- 按业务模块组织：`internal/<module>/domain|application|ports|adapters`。
- `domain` 不依赖 Gin、pgx、sqlc 或外部 SDK。
- `application` 只依赖 domain 和 ports，负责业务编排和权限规则。
- `ports` 定义模块需要的外部能力，不依赖 adapter。
- Gin 与 `gin.Context` 只能出现在 `adapters/http` 和 `bootstrap`。
- SQL、pgx、sqlc 只能出现在 `adapters/postgres` 和数据库工具中。
- handler 只做协议适配、Actor 提取、DTO 转换和错误映射。
- 用户端与管理端使用独立的 `/api`、`/api/admin` 路由组。

## 领域边界

- 新功能优先形成小而高内聚的 use case，不建立全局巨型 service。
- **Match 是唯一比赛聚合根**；报名阵营使用 RegistrationGroup，不复制比赛。
- 旧 Rust 后端已从工作区删除；数据库迁移用 `cmd/migratelegacydb` / `scripts/migrate-legacy.sh`，日常 schema 变更用 `cmd/dbmigrate`（不要用 `go run goose@version`，CLI 驱动依赖不在 go.sum）。
- PostgreSQL 集成测试通过 `internal/testsupport` 为每个用例创建独立随机 schema，任何测试都不得 TRUNCATE 共享业务表。

## 开发约束

- 后端业务行为按 TDD 推进：先确认失败测试，再写最小实现。
- 新增 SQL 前先确认 migration 和现有 query，禁止臆造字段。
- 不使用重型 ORM；查询通过 sqlc 生成类型。
- Go 模块下载使用 `GOPROXY=https://goproxy.cn,direct`，校验使用 `GOSUMDB=sum.golang.google.cn`；不要关闭公开依赖的 checksum 校验。
- 不记录 JWT、微信 code、AppSecret、数据库连接串等敏感信息。
- 已实现首版微信支付 V2 充值与个人钱包；新增资金行为必须保持订单、流水和余额原子一致，并通过唯一来源键保证幂等。
- 当前不实现退款、提现、人工调账、微信内 H5 支付、签到和通知。
- PostgreSQL 集成测试只使用显式 `TEST_DATABASE_URL`，不得回退连接 `DATABASE_URL` 或为测试启动 Docker。

## 验证

```bash
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

未运行的验证必须在最终回复中说明原因。
