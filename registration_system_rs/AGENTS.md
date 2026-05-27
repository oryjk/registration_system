# registration_system_backend（Rust）— AGENTS

## 项目定位

赛事报名与球队管理系统的后端服务，负责认证、活动、约队、通知、球队、球员、账单、支付、系统配置、微信相关能力。管理端接口通常挂载在 `/api/admin` 下。

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

- 新增能力优先沿 `domain -> ports -> application -> adapters` 推进。
- 业务规则放在领域或应用层，不要堆在 handler 或 SQL 调用点。
- DTO 与领域对象分离；HTTP 错误统一映射，不把内部错误直接暴露给接口层。
- 管理后台专用接口只挂载在 `/api/admin/*`，不要再复用到 `/api/*`。
- 改动接口时，顺带检查管理端 `../registration_system_backend_fe/src/services/` 与小程序 `../registration_system_mini/src/api/` 是否需要同步。
- 若现有持久化文件命名仍带旧痕迹，只在当前任务需要时局部修正，不做无关批量重命名。
- 最终回复前，必须确认上述工作文档已经反映当前后端改动和验证结果。

## 环境与数据

- 配置主要来自 `.env` / `.env.example`
- 数据库为 PostgreSQL，不要误按 MySQL 假设编写 SQL
- 涉及迁移时，优先保持可审阅、可回滚、非破坏性

## 验证建议

- 至少执行 `cargo clippy`
- 涉及业务逻辑、仓储、路由时执行 `cargo test`
- 后端行为变更需要优先按 TDD 思路推进：能写业务测试时先写或同步补齐失败用例，再实现修复；纯配置、文档或无行为影响的机械调整除外。
