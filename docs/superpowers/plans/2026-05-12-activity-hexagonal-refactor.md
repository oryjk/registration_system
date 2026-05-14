# Activity Hexagonal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `activity` 模块从单一大 `ActivityService` 拆成高内聚 use case、兼容 facade 和读写分离 ports，同时保持现有 API、DTO、错误语义和业务行为不变。

**Architecture:** 采用当前后端已经稳定下来的模式：`Service` 只做 facade，业务规则进入 `application/use_cases/*`，权限和校验工具抽到 application 内部模块，repository 先拆 trait 再逐步整理 persistence。`activity` 是最大且耦合最高的模块，禁止全量重写，必须按可验证切片推进。

**Tech Stack:** Rust 2024, Axum, sqlx, Tokio, PostgreSQL, existing integration/unit tests.

---

## 当前问题

- `src/activity/application/service.rs` 约 1221 行，混合了命令 DTO、校验函数、权限判断、活动创建/更新、报名、球队报名、签到、查询和测试入口。
- `ActivityRepository` 同时包含活动读写、报名读写、球队报名派生活动、签到配置、签到记录等职责。
- `PostgresActivityRepository` 约 805 行，SQL 边界还可以接受，但在 port 拆分后应避免继续变大。
- `activity` 被 `challenge`、`team`、小程序和管理端多处依赖，应最后拆，且每个切片必须验证。

## 目标结构

```text
src/activity/application/
  commands.rs                 # CreateActivityCommand / UpdateActivityCommand / checkin/registration commands
  read_models.rs              # OngoingActivityInfo 等读模型
  validation.rs               # 颜色、坐标、签到半径、签到窗口、人制、match_kind 校验
  permission.rs               # ActivityPermissionChecker，封装 admin/user/team manager 判断
  service.rs                  # ActivityService facade，仅转发
  use_cases/
    mod.rs
    query_activity.rs         # 列表、详情、进行中、报名列表
    manage_activity.rs        # 创建、更新、状态、删除、回填
    manage_registration.rs    # 个人报名、管理员报名、批量报名、删除报名
    team_registration.rs      # 球队报名、取消球队报名、派生活动
    location.rs               # 搜索地点、坐标反查
    checkin.rs                # 签到配置、签到提交

src/activity/ports/
  activity_repository.rs      # 后续拆成 query/command traits，或保留文件名导出两个 trait
```

## Port 拆分目标

```rust
pub trait ActivityQueryRepository: Send + Sync {
    async fn list_page(...);
    async fn find_by_id(...);
    async fn find_derived_by_source_and_team(...);
    async fn find_ongoing_activity(...);
    async fn list_registrations(...);
    async fn count_capacity_registrations(...);
    async fn list_registrations_with_info_page(...);
    async fn list_team_checkin_configs(...);
    async fn find_team_checkin_config(...);
    async fn find_checkin_record(...);
}

pub trait ActivityCommandRepository: Send + Sync {
    async fn create(...);
    async fn delete_many(...);
    async fn update_status(...);
    async fn update_activity(...);
    async fn upsert_registration(...);
    async fn delete_registration(...);
    async fn backfill_team_member_registrations(...);
    async fn upsert_team_checkin_config(...);
    async fn record_checkin(...);
}
```

`PostgresActivityRepository` 第一阶段继续同时实现两个 trait，不急着拆 SQL 文件。

## Task 1: 抽命令、读模型和校验工具

**Files:**
- Create: `registration_system_rs/src/activity/application/commands.rs`
- Create: `registration_system_rs/src/activity/application/read_models.rs`
- Create: `registration_system_rs/src/activity/application/validation.rs`
- Modify: `registration_system_rs/src/activity/application/mod.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 移动这些 command/read model，保持字段名和类型不变：
  - `CreateActivityCommand`
  - `UpdateActivityCommand`
  - `UpdateMyStandCommand`
  - `CreateActivityCheckInConfigCommand`
  - `UpdateTeamCheckInConfigCommand`
  - `SubmitActivityCheckInCommand`
  - `OngoingActivityInfo`
- [x] 移动这些校验/工具函数到 `validation.rs`，先保持 `pub(crate)`：
  - `validate_optional_hex_color`
  - `validate_optional_hex_color_patch`
  - `validate_location_coordinates`
  - `validate_location_coordinates_patch`
  - `validate_checkin_radius`
  - `validate_checkin_window_minutes`
  - `haversine_distance_meters`
  - `is_capacity_stand`
  - `normalize_match_kind`
  - `is_frozen_during_activity`
- [x] 保持 `service.rs` 仍能直接调用这些函数，先不拆业务逻辑。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests
```

Expected: 全部通过。

## Task 2: 抽权限检查器

**Files:**
- Create: `registration_system_rs/src/activity/application/permission.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`
- Modify: `registration_system_rs/src/activity/application/mod.rs`

- [x] 新增 `ActivityPermissionChecker`，封装：
  - `ensure_admin(principal)`
  - `ensure_user(principal)`
  - `ensure_team_manager(principal, team_id)`
  - `ensure_activity_manager_or_admin(principal, activity)`
- [x] 把 `is_team_manager_role` 移到 `permission.rs`。
- [x] 只替换 `create_activity` 和 `update_activity` 中的权限判断，作为最小验证切片。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests::team_manager_can_create_activity_with_initial_checkin_config
cargo test activity::application::service::tests::team_manager_can_update_own_future_activity
cargo test activity::application::service::tests
```

Expected: 全部通过。

## Task 3: 拆查询类 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/mod.rs`
- Create: `registration_system_rs/src/activity/application/use_cases/query_activity.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`
- Modify: `registration_system_rs/src/activity/application/mod.rs`

- [x] 新增 `QueryActivityUseCase`，迁移：
  - `list_activities`
  - `get_activity`
  - `check_ongoing_activities`
  - `list_activity_users`
  - `list_registrations_with_info`
- [x] `ActivityService` 增加 `query_activity_use_case` 字段，公开方法只转发。
- [x] 不改 handler 和 DTO。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests
cargo test --test remaining_team_activity_routes_test
```

Expected: 全部通过。

## Task 4: 拆地点 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/location.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 新增 `ActivityLocationUseCase`，迁移：
  - `search_locations`
  - `resolve_location`
- [x] 保持未配置地图服务时的错误文案不变。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests::returns_actionable_error_when_location_gateway_is_not_configured
cargo test activity::application::service::tests::resolves_location_name_from_coordinates
cargo test activity::application::service::tests::app_user_can_resolve_location_name_from_coordinates
```

Expected: 全部通过。

## Task 5: 拆报名 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/manage_registration.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 新增 `ManageRegistrationUseCase`，迁移：
  - `update_my_stand`
  - `ensure_registration_capacity`
  - `update_user_stand`
  - `delete_user_registration`
  - `admin_register_user`
  - `batch_update_user_stand`
- [x] 容量判断必须保持现有语义：当前用户已占容量时再次更新不触发满员错误。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests::update_my_stand_zero_deletes_current_user_registration
cargo test activity::application::service::tests::update_my_stand_attending_upserts_current_user_registration
cargo test --test batch_operations_business_test
```

Expected: 全部通过。

## Task 6: 拆活动管理 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/manage_activity.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 新增 `ManageActivityUseCase`，迁移：
  - `create_activity`
  - `update_activity`
  - `update_status`
  - `delete_activities`
  - `backfill_activity`
- [x] 创建活动时保留：
  - 普通用户必须是主队 captain/leader/admin 类角色
  - 自动回填球队成员报名
  - 初始签到配置校验和保存
  - `match_kind`、球服颜色、经纬度校验
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests::create_activity_persists_location_coordinates
cargo test activity::application::service::tests::create_activity_persists_match_kind
cargo test activity::application::service::tests::team_manager_can_create_activity_with_initial_checkin_config
cargo test activity::application::service::tests::update_activity_can_clear_location_coordinates
cargo test activity::application::service::tests::team_manager_can_update_own_future_activity
```

Expected: 全部通过。

## Task 7: 拆球队报名 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/team_registration.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 新增 `TeamRegistrationUseCase`，迁移：
  - `update_team_registration`
  - `cancel_team_registration`
- [x] 保持派生活动语义：
  - 同队已有未取消派生活动时返回 conflict
  - 已取消派生活动再次报名时恢复状态并更新人数
  - 新派生活动继承源活动信息并 `source_activity_id = Some(source_activity.id)`
  - 创建派生活动后自动回填球队成员报名
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests::cancel_team_registration_marks_derived_activity_cancelled
cargo test --test challenge_service_business_test
```

Expected: 全部通过。

## Task 8: 拆签到 use case

**Files:**
- Create: `registration_system_rs/src/activity/application/use_cases/checkin.rs`
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 新增 `ActivityCheckInUseCase`，迁移：
  - `update_team_checkin_config`
  - `submit_check_in`
- [x] 保持签到规则：
  - 派生活动不能配置签到
  - 只有参赛球队能配置/签到
  - 普通用户必须是球队管理角色才能配置
  - 签到必须在开放窗口内
  - 超出半径返回现有错误文案
  - 已签到不能重复提交
- [x] 运行：

```bash
cargo fmt --check
cargo test --test activity_checkin_service_business_test
cargo test activity::application::service::tests::team_manager_can_create_activity_with_initial_checkin_config
```

Expected: 全部通过。

## Task 9: ActivityService facade 收敛

**Files:**
- Modify: `registration_system_rs/src/activity/application/service.rs`

- [x] 确认 `ActivityService` 只保留：
  - usecase 字段
  - `new(...)`
  - 与旧 public API 同名的转发方法
- [x] 确认 `service.rs` 已收敛为 facade（当前 300 行，剩余主要是旧 public API 转发方法）。
- [x] 运行：

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected: 全部通过。

## Task 10: 拆 ActivityRepository 读写 port

**Files:**
- Modify: `registration_system_rs/src/activity/ports/activity_repository.rs`
- Modify: `registration_system_rs/src/activity/ports/mod.rs`
- Modify: `registration_system_rs/src/activity/adapters/persistence/postgres_activity_repository.rs`
- Modify: `registration_system_rs/src/activity/application/use_cases/*.rs`
- Modify: `registration_system_rs/src/bootstrap/modules/activity.rs`
- Modify: `registration_system_rs/src/activity/application/service/tests.rs`

- [x] 定义 `ActivityQueryRepository` 和 `ActivityCommandRepository`。
- [x] `PostgresActivityRepository` 同时实现两个 trait。
- [x] 应用层 use case 改成只依赖自己需要的 trait：
  - 查询/详情/列表：query only
  - 创建/更新/报名/签到：query + command
- [x] 测试 fake 同时实现两个 trait，构造 `ActivityService::new(query, command, location_gateway, team_access)`。
- [x] 运行：

```bash
cargo fmt --check
cargo test activity::application::service::tests
cargo test --test activity_checkin_service_business_test
cargo test --test batch_operations_business_test
cargo test --test remaining_team_activity_routes_test
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected: 全部通过。

## Task 11: 可选 SQL 适配器整理

**Files:**
- Current: `registration_system_rs/src/activity/adapters/persistence/postgres_activity_repository.rs`
- Optional create:
  - `registration_system_rs/src/activity/adapters/persistence/models.rs`
  - `registration_system_rs/src/activity/adapters/persistence/queries.rs`

- [x] 仅当 `postgres_activity_repository.rs` 后续继续增长时执行。
- [x] 先抽 row model 和 `From` 转换，不先拆 SQL。
- [x] 不改变任何 SQL 语义。
- [x] 运行：

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected: 全部通过。

## 执行顺序建议

1. `Task 1-2`：先建立公共 commands/validation/permission，风险最低。
2. `Task 3-4`：先拆查询和地点，这两个行为相对独立。
3. `Task 5-8`：再拆报名、活动管理、球队报名、签到，每个都带专项测试。
4. `Task 9`：收敛 facade。
5. `Task 10`：最后拆 repository port。
6. `Task 11`：可选，不作为本轮必须目标。

## 风险点

- 不要先拆 SQL 文件，否则业务和持久化同时变化，排查成本高。
- `get_activity` 当前会附带 `team_checkin_configs`，拆 usecase 后所有依赖详情的逻辑都要继续拿到这个扩展信息。
- `update_activity` 对普通用户有“比赛开始后不可修改”的限制，管理员没有这个限制。
- 球队报名创建的是派生活动，不是源活动报名记录，这个模型不能在重构中改掉。
- 签到使用本地时间和球场坐标，坐标校验、开放窗口、距离计算必须保持原样。

## 最终验收

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

并额外确认：

- 管理端和小程序路由测试通过。
- `ActivityService` public API 没有破坏 handler 调用。
- `activity` handler 没有直接依赖 persistence。
- `activity` 模块只剩 `activity` 本身未拆 SQL 文件，不影响后续维护。
