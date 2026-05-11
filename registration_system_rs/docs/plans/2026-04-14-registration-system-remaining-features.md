# Registration System Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将旧 TS 后端尚未迁移的全部业务接口补齐到当前 Rust 版本，优先保持旧接口路径和核心响应语义兼容。

**Architecture:** 继续沿用现有的模块化六边形结构，在 `auth / user / team / activity / billing / payment / wx` 模块内扩展端口、应用服务和 Web 路由。统计类与查询类能力优先通过明确 SQL 查询实现，管理类能力复用现有 JWT/角色模型，并在 `/api/*` 与 `/apid/*` 下同时保留。

**Tech Stack:** Rust 2024, axum, tokio, sqlx(mysql), serde, chrono, uuid, anyhow, thiserror, async-trait, tracing, bcrypt, jsonwebtoken

---

### Task 1: 补齐 Auth 与 User 剩余接口

**Files:**
- Modify: `src/auth/**`
- Modify: `src/user/**`
- Test: `tests/remaining_user_routes_test.rs`

**Step 1: Write the failing test**

写测试覆盖至少：
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `GET /api/user/infos`
- `GET /api/user/attendance-ranking`

**Step 2: Run test to verify it fails**

Run: `cargo test --test remaining_user_routes_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

补管理员注册/状态管理/列表、用户搜索、用户活动、出勤记录、出勤排名、按用户查询与删除。

**Step 4: Run test to verify it passes**

Run: `cargo test --test remaining_user_routes_test -- --nocapture`
Expected: PASS

### Task 2: 补齐 Team 与 Activity 剩余接口

**Files:**
- Modify: `src/team/**`
- Modify: `src/activity/**`
- Test: `tests/remaining_team_activity_routes_test.rs`

**Step 1: Write the failing test**

写测试覆盖至少：
- `GET /api/teams/search`
- `GET /api/teams/{id}/password-info`
- `GET /api/activity/check-ongoing`
- `PATCH /api/activity/{id}/user/{userId}/stand`

**Step 2: Run test to verify it fails**

Run: `cargo test --test remaining_team_activity_routes_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

补球队搜索、密码信息、成员管理、球队更新/删除，以及活动批量删除、进行中检查、管理员代改报名、删除报名、更新活动、数据回填。

**Step 4: Run test to verify it passes**

Run: `cargo test --test remaining_team_activity_routes_test -- --nocapture`
Expected: PASS

### Task 3: 补齐 Account 与 Order 高级财务接口

**Files:**
- Modify: `src/billing/**`
- Modify: `src/payment/**`
- Test: `tests/remaining_billing_routes_test.rs`

**Step 1: Write the failing test**

写测试覆盖至少：
- `GET /api/account/{userId}/balance`
- `GET /api/account/transactions`
- `GET /api/order/users/{userId}/billing-flow`
- `GET /api/order/activities/billing`

**Step 2: Run test to verify it fails**

Run: `cargo test --test remaining_billing_routes_test -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

补充值/扣费/罚款/校准/交易记录/余额校准记录/用户账单汇总/活动账单汇总/订单详情与列表/自动计算/月度罚款计算。

**Step 4: Run test to verify it passes**

Run: `cargo test --test remaining_billing_routes_test -- --nocapture`
Expected: PASS

### Task 4: 补齐文档与 OpenAPI

**Files:**
- Create: `src/openapi.rs`
- Modify: `README.md`

**Step 1: Write the failing test**

写测试覆盖 `GET /api/openapi.json` 或 `GET /api/docs`。

**Step 2: Run test to verify it fails**

Run: `cargo test openapi -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

补 OpenAPI 文档入口和迁移完成后的接口说明。

**Step 4: Run test to verify it passes**

Run: `cargo test -- --nocapture`
Expected: PASS
