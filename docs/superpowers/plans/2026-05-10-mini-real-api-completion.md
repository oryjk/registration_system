# Mini Real API Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining mini-program real-backend integrations in the agreed order: create/join team, captain team registration, check-in, and membership payment.

**Architecture:** Reuse the existing `src/api/*` request layer and keep page logic in mini-program pages. Add one small app-side backend route only for team registration because the existing equivalent is admin-only. Avoid broad refactors.

**Tech Stack:** uni-app + Vue 3 + TypeScript for the mini-program; Rust + Axum for the backend route.

---

## File Structure

- `registration_system_mini/src/api/team.ts`: add create/search/join/password-info wrappers.
- `registration_system_mini/src/api/activity.ts`: add team registration wrapper.
- `registration_system_mini/src/pages/teams/manage/index.vue`: new create/join team page.
- `registration_system_mini/src/components/BottomTabBar.vue`: route the create-team shortcut to the new page.
- `registration_system_mini/src/pages/matches/detail.vue`: wire team registration and check-in UI.
- `registration_system_mini/src/pages/user/index.vue`: add membership payment action using existing payment API.
- `registration_system_rs/src/activity/adapters/web/{dto.rs,handlers.rs,routes.rs}`: expose app-side team registration.

## Current Implementation Status

This plan is no longer pending. The codebase has moved beyond the original scope, and the implementation now includes the originally planned integrations plus additional follow-up work captured in `task_plan.md`.

Implemented:

- [x] Create/join team wrappers exist in `registration_system_mini/src/api/team.ts`:
  - `createTeam`
  - `searchTeams`
  - `joinTeam`
  - `getTeamPasswordInfo`
- [x] Create/join/manage team page exists at `registration_system_mini/src/pages/teams/manage/index.vue`.
- [x] Bottom tab and home team management entry route to `/pages/teams/manage/index`.
- [x] Team registration wrappers exist in `registration_system_mini/src/api/activity.ts`:
  - `submitTeamRegistration`
  - `cancelTeamRegistration`
- [x] App-side team registration routes are available through the shared activity app router:
  - `POST /api/activity/:activity_id/team-registration`
  - `DELETE /api/activity/:activity_id/team-registration`
- [x] Match detail page uses real team registration and cancellation calls.
- [x] Match detail page uses real activity check-in and check-in config calls:
  - `POST /api/activity/:activity_id/check-in`
  - `PATCH /api/activity/:activity_id/check-in-config`
- [x] Membership payment is wired through `createTeamMembershipOrder` on the user page.
- [x] Payment order management is wired on the billing page.
- [x] Static integration tests exist under `registration_system_mini/src/pages/__tests__/`.

## Follow-Up State

The current active work is tracked in:

- `docs/superpowers/plans/2026-05-11-mini-app-runtime-config.md`

That plan adds database-backed mini app runtime configuration and updates the home page to hide expired matches.

## Verification Notes

Use these commands for fresh verification after changes:

```bash
cd registration_system_mini
bun test
bun run type-check
```

```bash
cd registration_system_rs
cargo test
cargo clippy
```

If any command fails, record whether the failure is caused by the current runtime-config work or an unrelated pre-existing issue.
