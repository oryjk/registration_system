# registration_system_backend（Rust）— AGENTS

## 项目定位

> ⚠️ **本子项目已降级为只读参考**：工作区的主力后端是 `../registration_system_go/`（Go 新后端，在复刻并优化本项目的业务模型）。Rust 后端**不再承接新功能、不再增加代码**，保留它主要是为了 `migrations/`、DTO/路由布局和 OpenAPI schema，供 Go 重写时参考，以及做历史数据迁移核对。新后端功能只写入 `registration_system_go/`。

历史定位（仅供参考）：赛事报名与球队管理系统的旧后端服务，曾负责认证、活动、约队、通知、球队、球员、账单、支付、系统配置、微信相关能力。管理端接口挂在 `/api/admin` 下，默认端口 `18080`（`.env.example` 的 `APP_PORT`）。

## 技术栈

- Rust 2024
- Axum 0.7
- Tokio
- PostgreSQL + sqlx 0.8
- JWT（`jsonwebtoken`）+ bcrypt
- tracing / tracing-subscriber
- utoipa / Swagger UI

## 目录结构

按六边形分层组织，主要业务模块包括 `activity`、`auth`、`billing`、`challenge`、`notification`、`payment`、`system`、`team`、`user`、`wx`：

```text
src/<module>/
  domain/          # 实体、值对象、领域错误
  application/     # 用例 / service
  ports/           # trait 抽象
  adapters/
    persistence/   # sqlx 仓储实现
    web/           # handler、dto、routes
    external|api/  # 按模块需要接第三方服务或外部网关
```

横切模块主要在 `src/shared/` 与 `src/bootstrap/`。

## 常用命令

```bash
cd registration_system_rs
cargo build
cargo clippy
cargo test
cargo run
```

## 重要入口

- 启动入口：`src/main.rs`
- crate 挂载：`src/lib.rs`
- 模块装配：`src/bootstrap/`
- 迁移目录：`migrations/`
- 集成测试：`tests/`

## 协作约定

- 默认**不在本子项目新增功能**；新后端能力请写到 `../registration_system_go/`，并以其 DTO/路由/迁移为准。本子项目只读，参考其实现即可。
- 仅当任务是「迁移核对」「修复存量 Rust 行为以维持参考准确性」或「读懂老后端契约」时，才在本目录内做最小必要改动。
- 阅读 / 参考实现时，仍按 `domain -> ports -> application -> adapters` 推进理解：业务规则在领域或应用层，DTO 与领域对象分离，HTTP 错误统一映射。
- 管理后台专用接口历史上只挂载在 `/api/admin/*`，不复用到 `/api/*`。
- 历史上对接本后端的老 Vue 管理后台 `../registration_system_backend_fe/` 已从工作区删除；小程序 `../registration_system_mini/` 也已切换到 Go 后端。Rust 项目只读，不存在「改 Rust 接口 → 同步老前端」的联动。**不要**把任何 Rust 内容同步到 `*_go` 新项目，那些对接的是 Go 后端。

## 环境与数据

- 配置主要来自 `.env` / `.env.example`
- Cargo 依赖统一通过项目级 `.cargo/config.toml` 使用字节跳动 Dev Infra 的 `rsproxy.cn` sparse 镜像；Docker 构建复用同一配置。
- 数据库为 PostgreSQL，不要误按 MySQL 假设编写 SQL
- 涉及迁移时，优先保持可审阅、可回滚、非破坏性

## 验证建议

- 本子项目一般不主动改动，命令主要用于「迁移核对 / 读懂契约 / 验证存量行为」场景。
- 需要核对迁移或跑测试时执行 `cargo test`；需要 DB 的测试用 `#[ignore]` 标注并通过 `make integration-test`（需 `TEST_DATABASE_URL`）。
- 仅做参考阅读、未改动代码时，无需运行任何验证命令。
