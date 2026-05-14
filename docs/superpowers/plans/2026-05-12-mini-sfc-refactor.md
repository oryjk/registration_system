# Mini SFC Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the maintenance risk of oversized mini-program page SFCs, starting with the current test baseline and `matches/detail.vue`.

**Architecture:** Keep existing API wrappers in `src/api/`. Move page-specific data orchestration, derived state, and action helpers out of the SFC into colocated page modules under `src/pages/matches/`. The Vue page remains responsible for template, styles, lifecycle wiring, and calling the extracted helpers.

**Tech Stack:** uni-app, Vue 3 `<script setup>`, TypeScript, Bun test, `vue-tsc`, WeChat mini-program build.

## Current Status, 2026-05-12

- `matches/detail.vue` has been split into `detailData.ts`, `detailState.ts`, `detailActions.ts`, plus page-local registration/skeleton components.
- `teams/manage/index.vue` has been split into `teamManageActions.ts`, `teamManageState.ts`, plus page-local profile/create/join/member/popup components.
- `home/index.vue` has page-local hero, skeleton, match list, opportunity list and digest grid components.
- `activities/index.vue` has page-local toolbar, skeleton, publish sheet, hall section and card components.
- Latest mini verification after these refactors: `bun test` 109 pass / 0 fail, `bun run type-check` pass, `bun run build:mp-weixin` pass.
- Follow-up structure guidance now lives in `registration_system_mini/docs/mini-architecture.md`.

---

## File Structure

- Modify: `registration_system_mini/src/utils/__tests__/systemInfo.test.ts`
  - Replace brittle import-string assertion with behavior/source assertions that match current `AppTabHeader.vue`.
- Modify: `registration_system_mini/src/components/__tests__/pageBackButton.test.ts`
  - Accept dynamic `:title` header usage where the page title is computed.
- Modify: `registration_system_mini/src/pages/__tests__/miniRemainingFeaturesIntegration.test.ts`
  - Update stale implementation-name assertions to current team-management mode naming.
- Modify: `registration_system_mini/src/pages/__tests__/matchDetailRegistrationDesign.test.ts`
  - Separate confirmed current behavior from potential product gaps around roster-member selection.
- Modify: `registration_system_mini/src/pages/__tests__/teamManageIntegration.test.ts`
  - Update stale handler-name assertion to current candidate selection handler.
- Create: `registration_system_mini/src/pages/matches/detailData.ts`
  - Load public match data and authenticated match context.
- Create: `registration_system_mini/src/pages/matches/detailState.ts`
  - Hold pure derived-state helpers for capacity, labels, dates, permission flags, and local state patching.
- Create: `registration_system_mini/src/pages/matches/detailActions.ts`
  - Hold action helpers that call activity/team APIs and return data for the SFC to apply.
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
  - Delegate data orchestration, pure state helpers, and action API calls to the new modules.
- Test: relevant existing Bun tests plus `bun run type-check` and `bun run build:mp-weixin`.

## Task 1: Stabilize Current Test Baseline

- [ ] Run `bun test` in `registration_system_mini` and capture failing test names.
- [ ] For each failing test, inspect the tested source and classify:
  - stale implementation-name assertion,
  - valid behavior expectation,
  - real product gap.
- [ ] Update only stale static assertions first.
- [ ] If a failure represents a real product gap, leave or rewrite it as a focused pending/failing behavior test before implementation.
- [ ] Re-run `bun test`.
- [ ] Expected result before refactor: either all tests pass, or remaining failures are documented real gaps that the refactor will not obscure.

## Task 2: Extract Match Detail Pure State Helpers

- [ ] Create `src/pages/matches/detailState.ts`.
- [ ] Move pure helpers from `detail.vue` into the module:
  - date/time formatting,
  - countdown/day labels,
  - avatar color,
  - team registration count clamp,
  - active derived activity predicate,
  - local registration/check-in/review state patch helpers where practical.
- [ ] Add or update focused tests only for business/permission/state helpers, not visual layout.
- [ ] Update `detail.vue` imports and remove duplicated local helpers.
- [ ] Run `bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts` and `bun run type-check`.

## Task 3: Extract Match Detail Data Loading

- [ ] Create `src/pages/matches/detailData.ts`.
- [ ] Move the raw data loading currently inside `loadPageData` into explicit functions:
  - `loadPublicMatchDetailData(matchId)`,
  - `loadAuthenticatedMatchDetailContext(activity, activityPage, currentTeamId)`.
- [ ] Keep API wrappers in `src/api/`; this module only composes existing API calls.
- [ ] Update `detail.vue` so `loadPageData` coordinates UI flags and applies returned data.
- [ ] Run match-detail tests and `bun run type-check`.

## Task 4: Extract Match Detail Actions

- [ ] Create `src/pages/matches/detailActions.ts`.
- [ ] Move API-call action bodies for:
  - individual signup/cancel,
  - team signup/cancel,
  - check-in,
  - check-in config save,
  - post-match review submit.
- [ ] Keep user prompts and Toasts in `detail.vue` unless moving them clearly reduces duplication without changing UX.
- [ ] Return typed results from action helpers and apply local state in `detail.vue`.
- [ ] Run match-detail tests and `bun run type-check`.

## Task 5: Final Verification

- [ ] Run `bun test`.
- [ ] Run `bun run type-check`.
- [ ] Run `bun run build:mp-weixin`.
- [ ] Summarize changed files, remaining risks, and any intentionally deferred refactors (`teams/manage`, `home`).

## Task 6: Extract Team Manage Page Components

**Goal:** Reduce `src/pages/teams/manage/index.vue` by moving self-contained UI blocks into focused Vue components while preserving current behavior and visual output.

**Component boundaries:**
- Create page-local components under `src/pages/teams/manage/components/` for team-management business UI:
  - `MemberEditPopup.vue`: member edit bottom sheet.
  - `MemberAttendancePopup.vue`: member attendance bottom sheet.
  - `TeamMemberManager.vue`: add/search members and grouped member lists.
  - `TeamProfilePanel.vue`: current team profile form and logo upload entry.
  - `TeamCreatePanel.vue`: create team form.
  - `TeamJoinPanel.vue`: team search and join form.
- Keep globally reusable components under `src/components/` only when they have no team-specific dependency and have a stable cross-page API. Do not prematurely move one-off team UI to global components.
- Keep API wrappers in `teamManageActions.ts` and pure formatting/grouping helpers in `teamManageState.ts`.
- Keep `index.vue` responsible for page mode, team context, form ownership, async actions, and event wiring.

**Steps:**
- [ ] Create `src/pages/teams/manage/components/MemberEditPopup.vue` and move the edit popup template/styles into it.
- [ ] Create `src/pages/teams/manage/components/MemberAttendancePopup.vue` and move the attendance popup template/styles into it.
- [ ] Update `index.vue` to import both popup components and pass explicit props/emits.
- [ ] Run targeted tests and `bun run type-check`.
- [ ] Create `src/pages/teams/manage/components/TeamMemberManager.vue` and move the add-member/search/member-list UI into it.
- [ ] Update `index.vue` member-management wiring through props/emits.
- [ ] Run targeted tests and `bun run type-check`.
- [ ] Create `TeamProfilePanel.vue`, `TeamCreatePanel.vue`, and `TeamJoinPanel.vue`.
- [ ] Update `index.vue` to render panel components from active mode.
- [ ] Move component-specific scoped CSS out of `index.vue`.
- [ ] Run `bun test`, `bun run type-check`, and `bun run build:mp-weixin`.
