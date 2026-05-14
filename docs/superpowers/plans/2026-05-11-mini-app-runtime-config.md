# Mini App Runtime Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-backed JSON runtime configuration for the mini app and use it to drive home page match/challenge limits plus expired-match filtering.

**Architecture:** Extend the existing Rust `system` module rather than creating a separate configuration subsystem. Store non-secret runtime values in a generic JSONB table keyed by config name, expose a safe public mini-app config endpoint under `/api/system`, and keep admin update support under `/api/admin/system` for future UI use. The mini app reads config through `src/api/system.ts`, falls back to local defaults if loading fails, and uses the config in the home page first.

**Tech Stack:** Rust 2024, Axum, sqlx/PostgreSQL JSONB, serde, uni-app Vue 3 TypeScript, Bun test conventions already used by the mini project.

---

## Scope

Implement now:
- Database table for runtime configs: `rs_system_runtime_configs`.
- `mini_app` JSON config defaults and sanitization in the backend domain.
- Backend repository/service/web DTO/route support for reading and admin-updating `mini_app`.
- Mini app API/types/default config helpers.
- Home page uses configured match/challenge limits, fetch page size, and hides matches whose `holding_date` has passed when configured.
- Focused tests for backend service behavior and mini app config/filter helpers.

Defer:
- Admin UI for editing config.
- Migrating map settings into the generic JSON table.
- Configuring UI copy, routes, status labels, and tab labels.
- Broadly replacing every numeric constant in the mini app.

## Files

- Modify: `registration_system_rs/src/system/domain/mod.rs`
- Modify: `registration_system_rs/src/system/ports/system_settings_repository.rs`
- Modify: `registration_system_rs/src/system/adapters/persistence/postgres_system_settings_repository.rs`
- Modify: `registration_system_rs/src/system/application/service.rs`
- Modify: `registration_system_rs/src/system/adapters/web/dto.rs`
- Modify: `registration_system_rs/src/system/adapters/web/handlers.rs`
- Modify: `registration_system_rs/src/system/adapters/web/routes.rs`
- Add: `registration_system_rs/migrations/20260511000100_system_runtime_configs.sql`
- Modify: `registration_system_mini/src/types/backend.ts`
- Modify: `registration_system_mini/src/api/system.ts`
- Add: `registration_system_mini/src/config/runtimeConfig.ts`
- Add or modify tests under `registration_system_mini/src/**/__tests__/`
- Modify: `registration_system_mini/src/pages/home/index.vue`

## Task 1: Backend Runtime Config Domain And Service Tests

- [x] **Step 1: Write failing backend service tests**

Add tests in `registration_system_rs/src/system/application/service.rs` that require:
- default mini app runtime config is returned when no DB config exists;
- super admin can update mini app runtime config;
- non-super admin cannot update mini app runtime config.

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd registration_system_rs
cargo test system::application::service::tests
```

Expected at this stage: compilation fails because `MiniAppRuntimeConfig` and service methods do not exist.

- [x] **Step 3: Implement domain and repository trait**

Add `MiniAppRuntimeConfig` and nested config structs with defaults/sanitization in `system/domain/mod.rs`. Extend `SystemSettingsRepository` with `get_mini_app_runtime_config` and `upsert_mini_app_runtime_config`.

Status: domain structs and repository trait methods have been added. Service/repository implementations are still pending.

- [x] **Step 4: Implement service methods**

Add `get_mini_app_runtime_config()` public read method and `update_mini_app_runtime_config(actor, config)` super-admin-only update method. In-memory repository must persist the config for tests.

- [x] **Step 5: Run backend service tests**

Run:

```bash
cd registration_system_rs
cargo test system::application::service::tests
```

Expected: all system service tests pass.

Actual: `cargo test system::application::service::tests` passed with 8 system service tests.

## Task 2: Backend Persistence And HTTP API

- [x] **Step 1: Add migration**

Create `registration_system_rs/migrations/20260511000100_system_runtime_configs.sql`:

```sql
CREATE TABLE IF NOT EXISTS rs_system_runtime_configs (
    config_key VARCHAR(64) PRIMARY KEY,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO rs_system_runtime_configs (config_key, config_value)
VALUES (
    'mini_app',
    '{
      "home": {
        "match_card_limit": 2,
        "challenge_card_limit": 2,
        "activity_fetch_page_size": 100,
        "hide_matches_after_holding_time": true
      },
      "matches": {
        "related_activity_limit": 2,
        "participant_avatar_limit": 5,
        "capacity_extra_slots": 2
      },
      "checkin": {
        "default_radius_meters": 200,
        "default_open_minutes_before": 60,
        "default_close_minutes_after": 45
      },
      "billing": {
        "recent_order_limit": 10
      },
      "notifications": {
        "list_limit": 50
      }
    }'::jsonb
)
ON CONFLICT (config_key) DO NOTHING;
```

- [x] **Step 2: Implement PostgreSQL repository JSONB read/write**

Use `serde_json::Value` or direct `Json<T>` conversion to load and save `MiniAppRuntimeConfig`, returning sanitized config.

- [x] **Step 3: Add DTOs and handlers**

Expose:
- `GET /api/system/mini-app-runtime-config`
- `GET /api/admin/system/mini-app-runtime-config`
- `PATCH /api/admin/system/mini-app-runtime-config`

The app GET endpoint must not require auth and must return only the non-secret runtime config.

- [x] **Step 4: Register route under app router**

Current app router does not nest `/system`. Add `.nest("/system", build_system_router())` to the app router if safe, reusing route auth decisions in handlers.

- [x] **Step 5: Run backend verification**

Run:

```bash
cd registration_system_rs
cargo test system::application::service::tests
cargo test
cargo clippy
```

Expected: pass, or document unrelated pre-existing failures if any.

Actual:
- `cargo test` passed.
- `cargo clippy` passed with one pre-existing warning in `src/challenge/application/service.rs:267` (`too_many_arguments`).

## Task 3: Mini App Config API And Helpers

- [x] **Step 1: Add TypeScript backend type**

Add `BackendMiniAppRuntimeConfig` and nested interfaces to `registration_system_mini/src/types/backend.ts`.

- [x] **Step 2: Add API wrapper**

Add `getMiniAppRuntimeConfig()` in `registration_system_mini/src/api/system.ts` using:

```ts
return requestApi<BackendMiniAppRuntimeConfig>({
  url: "/system/mini-app-runtime-config",
});
```

- [x] **Step 3: Add runtime config defaults/helpers**

Create `registration_system_mini/src/config/runtimeConfig.ts` with:
- `defaultMiniAppRuntimeConfig`
- `sanitizeMiniAppRuntimeConfig`
- `loadMiniAppRuntimeConfig`
- helpers for numeric clamping and `isFutureRuntimeActivity(activity, config, now)`

- [x] **Step 4: Write and run helper tests**

Add Bun tests for:
- missing/invalid numeric values fall back or clamp;
- `hide_matches_after_holding_time: true` excludes past `holding_date`;
- `hide_matches_after_holding_time: false` preserves old status-only behavior.

Run with Bun from `registration_system_mini`.

Actual: `bun test src/config/__tests__/runtimeConfig.test.ts` passed.

## Task 4: Mini App Home Page Integration

- [x] **Step 1: Load config in home page data flow**

In `registration_system_mini/src/pages/home/index.vue`, import `loadMiniAppRuntimeConfig` and use it in both guest and logged-in flows. Keep fallback behavior local to helper so page code stays simple.

- [x] **Step 2: Replace hardcoded home limits**

Use:
- `config.home.activity_fetch_page_size` instead of `100`;
- `config.home.match_card_limit` instead of `2` for match cards;
- `config.home.challenge_card_limit` instead of `2` for challenges.

- [x] **Step 3: Apply expired match filtering**

Before sorting/slicing home activities, filter by current time when `hide_matches_after_holding_time` is true. Keep `status !== 2 && status !== 3`.

- [x] **Step 4: Update source-level page tests**

Existing tests in `registration_system_mini/src/pages/__tests__/homePageLoading.test.ts` assert hardcoded calls such as `listChallenges({ limit: 2, ... })`. Update them to assert config-driven loading instead of literal limits.

- [x] **Step 5: Run mini app verification**

Run:

```bash
cd registration_system_mini
bun test
bun run type-check
```

Expected: pass, or document unrelated pre-existing failures if any.

Actual:
- Targeted tests passed: `bun test src/config/__tests__/runtimeConfig.test.ts src/pages/__tests__/homePageLoading.test.ts`.
- `bun run type-check` passed.
- Full `bun test` still has 8 failures in pre-existing/static expectation areas unrelated to this runtime-config change:
  - `src/utils/__tests__/viewModels.test.ts`
  - `src/utils/__tests__/systemInfo.test.ts`
  - `src/components/__tests__/pageBackButton.test.ts`
  - `src/pages/__tests__/miniRemainingFeaturesIntegration.test.ts`
  - `src/pages/__tests__/matchDetailRegistrationDesign.test.ts`
  - `src/pages/__tests__/teamManageIntegration.test.ts`

Current status note, 2026-05-12:
- The static expectation failures above have since been fixed during the mini SFC refactor work.
- Latest mini verification after the refactors: `bun test` 109 pass / 0 fail, `bun run type-check` pass, `bun run build:mp-weixin` pass.

## Final Verification

- [x] Run `git diff --check`.
- [x] Run targeted backend tests and clippy.
- [x] Run mini app tests and type-check.
- [x] Summarize changed files, behavior change, and any verification gaps.

Actual final verification:
- `git -C registration_system_rs diff --check` passed.
- `git -C registration_system_mini diff --check` passed.
- `cargo test` passed.
- `cargo clippy` passed with the pre-existing `too_many_arguments` warning.
- `bun run type-check` passed.
- Targeted runtime-config/home tests passed.
- Full `bun test` has pre-existing/static assertion failures listed above.

Current status note, 2026-05-12:
- Full mini `bun test` now passes; see the note above.
