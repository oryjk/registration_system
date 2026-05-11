# Registration System Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Rust 完整重构球队报名系统后端，采用参考项目的模块化六边形架构，并支持 `sqlx migrate run` 初始化和升级数据库。

**Architecture:** 项目采用 `bootstrap + 业务模块` 结构，业务模块按 `auth / user / team / activity / registration / billing` 拆分，每个模块内部再按 `domain / ports / application / adapters` 组织。Web 层统一使用 `axum`，持久化统一使用 `sqlx` 的 MySQL 驱动，配置、路由装配、OpenAPI 与数据库连接由 `bootstrap` 负责。

**Tech Stack:** Rust 2024, axum, tokio, sqlx(mysql), serde, chrono, uuid, anyhow, thiserror, async-trait, tracing, tower-http, utoipa, jsonwebtoken, bcrypt

---

### Task 1: 初始化工程骨架

**Files:**
- Create: `Cargo.toml`
- Create: `src/main.rs`
- Create: `src/lib.rs`
- Create: `src/bootstrap/mod.rs`
- Create: `src/bootstrap/app.rs`
- Create: `src/bootstrap/config.rs`
- Create: `src/bootstrap/infra.rs`
- Create: `src/bootstrap/modules/*.rs`
- Create: `.env.example`
- Create: `Makefile`
- Test: `tests/health_api_test.rs`

**Step 1: Write the failing test**

编写 `tests/health_api_test.rs`，验证应用至少暴露：
- `GET /health` 返回 200 与 `"ok"`
- `GET /api/version` 返回版本信息结构

**Step 2: Run test to verify it fails**

Run: `cargo test health_api_test -- --nocapture`
Expected: FAIL，因为路由与应用装配尚未实现。

**Step 3: Write minimal implementation**

初始化 Cargo 工程、基础配置、日志、连接池类型与应用装配逻辑，暴露最小可运行路由。

**Step 4: Run test to verify it passes**

Run: `cargo test health_api_test -- --nocapture`
Expected: PASS

### Task 2: 建立 migration 基线

**Files:**
- Create: `migrations/20260414000100_baseline.sql`
- Create: `tests/migration_loading_test.rs`
- Modify: `Cargo.toml`

**Step 1: Write the failing test**

编写 `tests/migration_loading_test.rs`，验证：
- `sqlx::migrate!("./migrations")` 可以加载 migration
- 基线 migration 名称存在

**Step 2: Run test to verify it fails**

Run: `cargo test migration_loading_test -- --nocapture`
Expected: FAIL，因为 migration 目录或基线文件不存在。

**Step 3: Write minimal implementation**

创建 MySQL 基线 schema，覆盖：
- `rs_admin_users`
- `rs_users`
- `rs_teams`
- `rs_team_members`
- `rs_activities`
- `rs_registrations`
- `rs_registration_logs`
- `rs_activity_orders`
- `rs_user_accounts`
- `rs_user_billings`

**Step 4: Run test to verify it passes**

Run: `cargo test migration_loading_test -- --nocapture`
Expected: PASS

### Task 3: 认证与用户模块

**Files:**
- Create: `src/auth/**`
- Create: `src/user/**`
- Test: `tests/auth_user_api_test.rs`

**Step 1: Write the failing test**

编写认证与用户 API 测试，至少覆盖：
- 管理员登录成功/失败
- 当前用户信息查询
- 用户列表查询

**Step 2: Run test to verify it fails**

Run: `cargo test auth_user_api_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

实现：
- JWT 令牌服务
- 管理员仓储与登录用例
- 用户仓储、查询与更新用例
- Web DTO、提取器与路由

**Step 4: Run test to verify it passes**

Run: `cargo test auth_user_api_test -- --nocapture`
Expected: PASS

### Task 4: 球队模块

**Files:**
- Create: `src/team/**`
- Test: `tests/team_api_test.rs`

**Step 1: Write the failing test**

编写球队 API 测试，至少覆盖：
- 创建球队
- 查询球队列表
- 查询球队详情
- 加入球队
- 查询我的球队

**Step 2: Run test to verify it fails**

Run: `cargo test team_api_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

实现 `team` 模块领域模型、仓储端口、SQLx MySQL 适配器、用例与路由。

**Step 4: Run test to verify it passes**

Run: `cargo test team_api_test -- --nocapture`
Expected: PASS

### Task 5: 活动与报名模块

**Files:**
- Create: `src/activity/**`
- Create: `src/registration/**`
- Test: `tests/activity_registration_api_test.rs`

**Step 1: Write the failing test**

编写活动与报名 API 测试，至少覆盖：
- 创建活动
- 查询活动列表与详情
- 更新活动状态
- 用户修改自己的报名状态
- 查询活动报名列表

**Step 2: Run test to verify it fails**

Run: `cargo test activity_registration_api_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

实现活动与报名核心链路，并保留面向支付/微信的扩展端口。

**Step 4: Run test to verify it passes**

Run: `cargo test activity_registration_api_test -- --nocapture`
Expected: PASS

### Task 6: 账单与账户基础模块

**Files:**
- Create: `src/billing/**`
- Test: `tests/billing_api_test.rs`

**Step 1: Write the failing test**

编写账单与账户 API 测试，至少覆盖：
- 查询余额
- 创建活动订单
- 查询用户账单流水

**Step 2: Run test to verify it fails**

Run: `cargo test billing_api_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

实现账户余额、活动订单、账单流水查询的最小闭环。

**Step 4: Run test to verify it passes**

Run: `cargo test billing_api_test -- --nocapture`
Expected: PASS

### Task 7: OpenAPI、文档与收尾

**Files:**
- Create: `src/openapi.rs`
- Modify: `README.md`
- Modify: `.env.example`

**Step 1: Write the failing test**

编写最小测试验证 OpenAPI 路由可访问。

**Step 2: Run test to verify it fails**

Run: `cargo test openapi -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

补全 Swagger/OpenAPI、启动说明、`sqlx migrate run` 使用说明与环境变量说明。

**Step 4: Run test to verify it passes**

Run: `cargo test -- --nocapture`
Expected: PASS
