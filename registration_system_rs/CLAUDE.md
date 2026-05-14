# Claude — Rust 后端子项目指南

你当前在 `registration_system_rs/` 中工作，crate 名为 `registration_system_backend`。

## 必读

- 同目录 [`AGENTS.md`](/Users/carlwang/registration_system/registration_system_rs/AGENTS.md)

## 推荐定位顺序

1. `src/bootstrap` 或模块 `routes.rs`
2. `adapters/web` 下的 handler / dto
3. `application` service
4. `ports`
5. `adapters/persistence`

## 修改原则

- 改接口时同时关注 DTO、权限校验、统一响应包装与前端调用方。
- 改 SQL 或仓储时，不要破坏现有分页、筛选、聚合语义。
- 对外接口字段保持稳定；若必须调整，明确同步前端和小程序调用。
- 复杂任务默认走 `planning-with-files`；除了代码本身，还要同步更新根目录和后端子项目下的 `task_plan.md`、`findings.md`、`progress.md`。

## 验证要求

- 默认建议执行 `cargo clippy`
- 涉及路由、仓储、业务逻辑时建议执行 `cargo test`

## 输出要求

- 对用户使用简体中文说明
- 引用路径时使用仓库内实际文件路径
