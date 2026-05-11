# Registration System Backend Architecture Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有业务接口语义的前提下，完成 OpenAPI/Swagger、基础设施配置与错误收口、bootstrap 装配层整理。

**Architecture:** 保留当前按业务模块纵向拆分的六边形结构，只收紧 `bootstrap` 与 `shared` 基础设施。OpenAPI 改为 `utoipa + Swagger UI`，配置改为分段结构并保持既有环境变量兼容，应用状态改为一次性构建完整服务集合，避免运行时空服务分支。

**Tech Stack:** `axum`、`sqlx`、`utoipa`、`utoipa-swagger-ui`、`tracing`

---

### Task 1: OpenAPI 文档入口

**Files:**
- Modify: `Cargo.toml`
- Modify: `src/openapi.rs`
- Modify: `src/bootstrap/app.rs`
- Test: `tests/openapi_api_test.rs`

**Step 1: 写失败测试**

- 已补 `swagger_ui_route_is_available`

**Step 2: 运行测试确认失败**

Run: `env -u SCRCPY_SERVER_PATH cargo test --test openapi_api_test -- --nocapture`
Expected: `GET /api/docs/` 返回 `404`，测试失败

**Step 3: 写最小实现**

- 引入 `utoipa` 与 `utoipa-swagger-ui`
- 将文档构建改为返回 `utoipa::openapi::OpenApi`
- 暴露 `/api/openapi.json` 与 `/apid/openapi.json`
- 暴露 `/api/docs/` 与 `/apid/docs/`

**Step 4: 运行测试确认通过**

Run: `env -u SCRCPY_SERVER_PATH cargo test --test openapi_api_test -- --nocapture`
Expected: 全部通过

### Task 2: 配置、日志、错误模型收口

**Files:**
- Modify: `src/bootstrap/config.rs`
- Create: `src/bootstrap/logging.rs`
- Modify: `src/bootstrap/mod.rs`
- Modify: `src/main.rs`
- Modify: `src/shared/error.rs`

**Step 1: 写回归约束**

- 复用现有 `health/openapi/wx/payment` 集成测试，确保重构不改外部行为

**Step 2: 写最小实现**

- `AppConfig` 改为分段结构：`app/server/database/auth/wx/wx_pay`
- 保持现有环境变量名称不变
- 日志初始化迁移到 `bootstrap/logging.rs`
- 错误模型增加统一 `error_code` / `error_type`

**Step 3: 运行回归**

Run: `env -u SCRCPY_SERVER_PATH cargo test --test health_api_test --test wx_payment_test --test openapi_api_test -- --nocapture`
Expected: 全部通过

### Task 3: Bootstrap 装配层整理

**Files:**
- Modify: `src/bootstrap/app.rs`
- Create: `src/bootstrap/modules/router.rs`
- Modify: `src/bootstrap/modules/mod.rs`
- Modify: `src/bootstrap/modules/*.rs`
- Modify: `src/*/adapters/web/handlers.rs`

**Step 1: 写回归约束**

- 复用现有剩余路由与账务测试，确保装配层重构不改路由行为

**Step 2: 写最小实现**

- 增加 `AppServices`，去掉 `AppState` 中各服务的 `Option`
- 模块构建函数改为显式返回服务或路由组件
- `bootstrap/modules/router.rs` 负责拼装所有业务路由与文档路由

**Step 3: 跑全量验证**

Run: `env -u SCRCPY_SERVER_PATH cargo fmt`

Run: `env -u SCRCPY_SERVER_PATH cargo test -- --nocapture`
Expected: 全部通过

### Task 4: 文档更新

**Files:**
- Modify: `README.md`

**Step 1: 更新说明**

- 记录 Swagger UI 地址
- 记录新的配置分段设计
- 保持启动与 migration 命令不变

**Step 2: 最终校验**

Run: `env -u SCRCPY_SERVER_PATH cargo test -- --nocapture`
Expected: 全部通过
