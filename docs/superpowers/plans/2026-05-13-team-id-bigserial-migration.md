# Team ID Bigserial Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate team identifiers from string UUID-style IDs to database-generated numeric IDs across PostgreSQL, Rust backend, mini-program frontend, and admin frontend.

**Status:** Implemented in code and verified on clean-migration tests plus frontend/backend type checks. Development database execution is still a separate runtime step if the local DB has not yet applied this migration.

**Architecture:** Treat this as a cross-system schema migration, not a local data patch. The database must become the source of truth for numeric team IDs, while application use cases and DTOs expose `i64/number` team IDs consistently. Preserve data integrity by migrating all referencing tables in one controlled migration and updating all code paths that currently treat team IDs as strings.

**Tech Stack:** PostgreSQL + sqlx migrations, Rust 2024/Axum/sqlx, uni-app Vue 3 TypeScript, Vue 3 admin frontend TypeScript.

---

## Current Facts

- Current schema has `rs_teams.id CHAR(36) PRIMARY KEY`.
- Current Rust domain has `Team.id: String`, `TeamMember.team_id: String`, and many commands/DTOs use `String` team IDs.
- Current frontend services use `string` for team IDs in both mini-program and admin frontend.
- Referencing tables include at least:
  - `rs_team_members.team_id`
  - `rs_activity.home_team_id`
  - `rs_activity.away_team_id`
  - `rs_activity_team_checkin_configs.team_id`
  - `rs_activity_checkins.team_id`
  - `rs_challenges.host_team_id`
  - `rs_challenges.guest_team_id`
  - `rs_challenge_individual_acceptances` indirectly through challenges only
  - `rs_team_credit_transactions.team_id`
  - `rs_team_credit_transactions.reviewer_team_id`
  - `rs_activity_team_reviews.reviewer_team_id`
  - `rs_activity_team_reviews.reviewee_team_id`
  - `rs_team_membership_orders.team_id`
  - `rs_admin_team_assignment.team_id`
- `rs_admin_team_assignment.team_id` currently has no real foreign key and is `VARCHAR(64)`.

## Decision

Team IDs must become numeric database-generated IDs.

Target:

- `rs_teams.id BIGSERIAL PRIMARY KEY`
- All foreign key columns referencing teams become `BIGINT`.
- Rust backend uses `i64` for team IDs.
- Mini-program and admin frontend use `number` for team IDs.
- If legacy string IDs are needed for debugging or migration traceability, keep them as `legacy_id VARCHAR(64) UNIQUE NULL` on `rs_teams`.

## Recommended Migration Strategy

Because this is still development stage and data can be cleaned, prefer a direct schema migration with a mapping table inside the migration:

1. Add `legacy_id` and temporary numeric IDs.
2. Backfill numeric IDs.
3. Convert all referencing columns through the mapping.
4. Rebuild foreign keys and indexes.
5. Drop old string ID columns or rename them to `legacy_*`.
6. Update Rust and frontend types.
7. Run migrations on a fresh database and on current development database.

Do not mix this with billing rewrite or unrelated UI changes.

Confirmed additional constraint:

- Existing billing/order data is known to be wrong and may be deleted during this migration.
- The migration should clear billing/order tables before rebuilding account/order foreign keys.
- After clearing data, add the missing physical FK from `rs_user_billings.activity_id` to `rs_activity(id)`.

## Task 1: Inventory All Team ID References

**Files:**
- Read: `registration_system_rs/migrations/*.sql`
- Read: `registration_system_rs/src/**/*.rs`
- Read: `registration_system_mini/src/**/*.ts`
- Read: `registration_system_mini/src/**/*.vue`
- Read: `registration_system_backend_fe/src/**/*.ts`
- Read: `registration_system_backend_fe/src/**/*.vue`
- Modify: `docs/superpowers/plans/2026-05-13-team-id-bigserial-migration.md`

- [x] Run backend reference scan:

```bash
cd /Users/carlwang/registration_system
rg -n "team_id|home_team_id|away_team_id|host_team_id|guest_team_id|reviewer_team_id|reviewee_team_id|Team.id|String" registration_system_rs/src registration_system_rs/tests registration_system_rs/migrations
```

- [x] Run mini frontend reference scan:

```bash
cd /Users/carlwang/registration_system
rg -n "teamId|team_id|home_team_id|away_team_id|host_team_id|guest_team_id|activeTeamId|BackendTeam|Team.id" registration_system_mini/src
```

- [x] Run admin frontend reference scan:

```bash
cd /Users/carlwang/registration_system
rg -n "teamId|team_id|home_team_id|away_team_id|host_team_id|guest_team_id|Team.id" registration_system_backend_fe/src
```

- [x] Append a concrete checklist of every file that needs code changes under this plan's "Implementation Checklist" section.

## Task 2: Write Migration Safety Tests

**Files:**
- Modify or create: `registration_system_rs/tests/migration_loading_test.rs`
- Create: `registration_system_rs/tests/team_id_numeric_schema_test.rs`

- [x] Add a test that applies all migrations to a clean database and asserts `rs_teams.id` is numeric.

Expected test intent:

```rust
#[sqlx::test(migrations = "./migrations")]
async fn team_id_is_bigint_after_migrations(pool: sqlx::PgPool) {
    let row: (String,) = sqlx::query_as(
        r#"
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'rs_teams' AND column_name = 'id'
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("rs_teams.id column should exist");

    assert_eq!(row.0, "bigint");
}
```

- [x] Add assertions for representative FK columns:

```rust
let columns = [
    ("rs_team_members", "team_id"),
    ("rs_activity", "home_team_id"),
    ("rs_activity", "away_team_id"),
    ("rs_challenges", "host_team_id"),
    ("rs_challenges", "guest_team_id"),
    ("rs_admin_team_assignment", "team_id"),
];
```

- [x] Run the new test before implementation.

```bash
cd registration_system_rs
cargo test --test team_id_numeric_schema_test
```

Expected: fail until migration exists.

## Task 3: Add Database Migration

**Files:**
- Create: `registration_system_rs/migrations/YYYYMMDDHHMMSS_team_id_bigserial.sql`

- [x] Create a migration that:
  - adds `legacy_id` to `rs_teams`;
  - creates a temporary mapping from old string team IDs to new bigint IDs;
  - converts all team reference columns to bigint through the mapping;
  - recreates foreign keys;
  - makes `rs_teams.id` bigint primary key;
  - normalizes `rs_admin_team_assignment.team_id` to bigint and adds foreign keys.

- [x] Include explicit handling for the current development assumption of one team:

```sql
-- If current data contains only one team, the first team should naturally become id = 1
-- through the generated numeric sequence. Do not hard-code team names as IDs.
```

- [x] Run:

```bash
cd registration_system_rs
cargo test --test team_id_numeric_schema_test
```

Expected: pass.

## Task 4: Update Rust Domain and Commands

**Files:**
- Modify: `registration_system_rs/src/team/domain/team.rs`
- Modify: `registration_system_rs/src/activity/domain/activity.rs`
- Modify: `registration_system_rs/src/challenge/domain/challenge.rs`
- Modify: `registration_system_rs/src/team/application/commands.rs`
- Modify: `registration_system_rs/src/activity/application/commands.rs`
- Modify: `registration_system_rs/src/challenge/application/commands.rs`
- Modify: related `read_models.rs` files

- [x] Change team IDs from `String` to `i64` where they represent `rs_teams.id`.
- [x] Keep activity IDs and challenge IDs as `String`.
- [x] Keep user/admin IDs as `i64`.
- [x] Run:

```bash
cd registration_system_rs
cargo check
```

Expected: compile errors in repositories/DTOs that still use string team IDs. Use these errors to drive Tasks 5 and 6.

## Task 5: Update Rust Repositories

**Files:**
- Modify: `registration_system_rs/src/team/adapters/persistence/*`
- Modify: `registration_system_rs/src/activity/adapters/persistence/*`
- Modify: `registration_system_rs/src/challenge/adapters/persistence/*`
- Modify: `registration_system_rs/src/billing/adapters/persistence/*` if settlement access queries reference team IDs

- [x] Update sqlx row structs and binds from `String` to `i64` for team ID columns.
- [x] Update SQL casts and comparisons that assumed char/varchar team IDs.
- [x] Keep `legacy_id` read-only unless a migration/debug endpoint explicitly needs it.
- [x] Run:

```bash
cd registration_system_rs
cargo check
cargo test team::application::service::tests
cargo test activity::application::service::tests
cargo test --test challenge_service_business_test
```

Expected: all pass after repository changes.

## Task 6: Update Rust Web DTOs and Handlers

**Files:**
- Modify: `registration_system_rs/src/team/adapters/web/dto.rs`
- Modify: `registration_system_rs/src/activity/adapters/web/dto.rs`
- Modify: `registration_system_rs/src/challenge/adapters/web/dto.rs`
- Modify: related handlers if path extractors or query params parse team IDs

- [x] Change request/response team ID fields to `i64`.
- [x] Update path extractors for routes like `/teams/:id`.
- [x] Update validation error messages if team ID parsing fails.
- [x] Run:

```bash
cd registration_system_rs
cargo test
```

Expected: all backend tests pass.

## Task 7: Update Mini Program Types and API Calls

**Files:**
- Modify: `registration_system_mini/src/types/backend.ts`
- Modify: `registration_system_mini/src/api/team.ts`
- Modify: `registration_system_mini/src/api/activity.ts`
- Modify: `registration_system_mini/src/api/challenge.ts`
- Modify: pages/stores that hold `activeTeamId` or pass `team_id`

- [x] Change team ID types from `string` to `number`.
- [ ] Keep route query serialization explicit:

```ts
String(teamId)
```

only at URL construction boundaries.

- [x] Run:

```bash
cd registration_system_mini
bun run type-check
```

Expected: pass.

## Task 8: Update Admin Frontend Types and API Calls

**Files:**
- Modify: `registration_system_backend_fe/src/services/team.ts`
- Modify: `registration_system_backend_fe/src/services/activity.ts`
- Modify: `registration_system_backend_fe/src/services/challenge.ts`
- Modify: `registration_system_backend_fe/src/views/**/*.vue`
- Modify: `registration_system_backend_fe/src/views/**/*.ts`

- [x] Change team ID fields from `string` to `number`.
- [x] Convert route params to number before service calls:

```ts
const teamId = Number(route.params.id)
if (!Number.isFinite(teamId)) throw new Error('球队 ID 无效')
```

- [x] Run:

```bash
cd registration_system_backend_fe
bun run type-check
bun run build
```

Expected: pass.

## Task 9: Run End-to-End Verification Against Development Database

**Files:**
- No code changes unless verification reveals a bug.

- [ ] Back up current development database.
- [ ] Run migrations:

```bash
cd registration_system_rs
sqlx migrate run
```

- [ ] Verify one-team development expectation:

```sql
SELECT id, legacy_id, name FROM rs_teams ORDER BY id;
```

Expected: current primary team has numeric ID `1` if it is the first generated team.

- [ ] Start backend and verify representative endpoints:

```bash
curl http://127.0.0.1:18080/api/teams
curl http://127.0.0.1:18080/api/activity/infos
```

- [ ] Run frontend type checks again:

```bash
cd registration_system_mini && bun run type-check
cd ../registration_system_backend_fe && bun run type-check
```

## Implementation Checklist

Task 1 scan completed. Key files requiring code changes:

Backend domain/ports/application:

- `registration_system_rs/src/team/domain/team.rs`
- `registration_system_rs/src/activity/domain/activity.rs`
- `registration_system_rs/src/challenge/domain/challenge.rs`
- `registration_system_rs/src/payment/domain/payment_order.rs`
- `registration_system_rs/src/team/ports/team_repository.rs`
- `registration_system_rs/src/activity/ports/activity_repository.rs`
- `registration_system_rs/src/activity/ports/team_access_port.rs`
- `registration_system_rs/src/billing/ports/activity_access_port.rs`
- `registration_system_rs/src/payment/application/commands.rs`
- `registration_system_rs/src/team/application/commands.rs`
- `registration_system_rs/src/activity/application/commands.rs`
- `registration_system_rs/src/challenge/application/commands.rs`

Backend persistence and web adapters:

- `registration_system_rs/src/team/adapters/persistence/*`
- `registration_system_rs/src/activity/adapters/persistence/*`
- `registration_system_rs/src/challenge/adapters/persistence/*`
- `registration_system_rs/src/payment/adapters/persistence/*`
- `registration_system_rs/src/billing/adapters/persistence/*`
- `registration_system_rs/src/team/adapters/web/dto.rs`
- `registration_system_rs/src/team/adapters/web/handlers.rs`
- `registration_system_rs/src/activity/adapters/web/dto.rs`
- `registration_system_rs/src/activity/adapters/web/handlers.rs`
- `registration_system_rs/src/challenge/adapters/web/dto.rs`
- `registration_system_rs/src/challenge/adapters/web/handlers.rs`
- `registration_system_rs/src/payment/adapters/web/dto.rs`
- `registration_system_rs/src/payment/adapters/web/handlers.rs`

Backend tests:

- `registration_system_rs/tests/team_id_numeric_schema_test.rs`
- Activity/team/challenge/payment/billing service and repository tests using string team IDs.

Mini program:

- `registration_system_mini/src/types/backend.ts`
- `registration_system_mini/src/api/team.ts`
- `registration_system_mini/src/api/activity.ts`
- `registration_system_mini/src/api/challenge.ts`
- `registration_system_mini/src/api/payment.ts`
- `registration_system_mini/src/stores/appSession.ts`
- `registration_system_mini/src/utils/authStorage.ts`
- `registration_system_mini/src/utils/viewModels.ts`
- `registration_system_mini/src/pages/**` files using `activeTeamId`, `teamId`, `team_id`, `home_team_id`, `away_team_id`, `host_team_id`, or `guest_team_id`.

Admin frontend:

- `registration_system_backend_fe/src/services/team.ts`
- `registration_system_backend_fe/src/services/activity.ts`
- `registration_system_backend_fe/src/services/challenge.ts`
- `registration_system_backend_fe/src/services/player.ts`
- `registration_system_backend_fe/src/views/teams/*`
- `registration_system_backend_fe/src/views/activities/*`
- `registration_system_backend_fe/src/views/challenges/*`
- `registration_system_backend_fe/src/views/players/*`

Database migration:

- Create `registration_system_rs/migrations/20260513000100_team_id_bigserial.sql`.

## Verification Checklist

- [ ] `cd registration_system_rs && cargo fmt --check`
- [ ] `cd registration_system_rs && cargo clippy`
- [ ] `cd registration_system_rs && cargo test`
- [ ] `cd registration_system_mini && bun run type-check`
- [ ] `cd registration_system_mini && bun run build:mp-weixin`
- [ ] `cd registration_system_backend_fe && bun run type-check`
- [ ] `cd registration_system_backend_fe && bun run build`

## Rollback Notes

- This migration changes primary and foreign key types. A production rollback should restore from database backup rather than rely on a trivial down migration.
- Before running on any non-development database, export `rs_teams` and all referencing tables.
- Keep `legacy_id` at least through one release cycle for traceability.
