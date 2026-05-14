# Admin Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Vue management frontend closer to the same maintainability standard now used by the mini-program frontend.

**Architecture:** Keep API wrappers in `registration_system_backend_fe/src/services/`. Large view SFCs should become page orchestration shells, with page-local components and model helpers colocated under each `src/views/<domain>/` directory. Business payload shaping and reusable derived state should move into small `*.model.ts` files, while UI-heavy sections move into focused page-local components.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Tailwind CSS 4, DaisyUI 5, Axios, Bun, `vue-tsc`.

---

## Current Findings

- `src/views/teams/TeamDetail.vue` is about 2321 lines. It mixes team profile, member management, attendance, credit, membership and dialogs in one SFC. This is the highest-risk file.
- `src/views/activities/ActivityDetail.vue` is about 1448 lines after the settlement panel extraction. It still mixes activity summary, edit modal, check-in config, registration table, manual registration, batch status updates and cancellation dialogs.
- `src/views/players/PlayerList.vue` is about 1123 lines. It combines filter state, table rendering, create/edit/freeze/delete dialogs and data loading.
- `src/views/activities/ActivityList.vue` is about 841 lines. It should be split before adding more activity list filters or bulk actions.
- `src/views/activities/ActivitySettlementPanel.vue` has already been introduced as a page-local component and `settlement.model.ts` holds payload/state helpers. This is the preferred pattern for future admin refactors.

## Target Pattern

- Page SFC owns lifecycle, route params, top-level loading/error state and event wiring.
- Page-local components own self-contained UI blocks and emit intent events.
- `*.model.ts` files own formatting, form patching, payload shaping and validation that is not directly tied to DOM.
- Services remain the only frontend place that knows backend DTO fields and endpoints.
- Avoid global components unless they are stable across multiple pages.

## Priority

1. `TeamDetail.vue`
   - Split first because it is the largest file and is actively touched by team management, attendance, billing and membership work.
2. `ActivityDetail.vue`
   - Continue the split already started by `ActivitySettlementPanel.vue`.
3. `PlayerList.vue`
   - Split create/edit/freeze dialogs and list filter/table areas.
4. `ActivityList.vue`
   - Split toolbar, table, status summary and batch action areas.

## Task 1: Finish Activity Detail Settlement Split

- [x] Add `src/views/activities/settlement.model.ts`.
- [x] Add `src/views/activities/ActivitySettlementPanel.vue`.
- [x] Update `src/services/billing.ts` for settlement mode, participant scope and item DTOs.
- [x] Replace the old inline settlement block in `ActivityDetail.vue`.
- [x] Run `bun run type-check` in `registration_system_backend_fe`.

## Task 2: Split Team Detail By Functional Panels

**Files:**
- Modify: `registration_system_backend_fe/src/views/teams/TeamDetail.vue`
- Create: `registration_system_backend_fe/src/views/teams/team-detail.model.ts`
- Create: `registration_system_backend_fe/src/views/teams/TeamProfilePanel.vue`
- Create: `registration_system_backend_fe/src/views/teams/TeamMemberPanel.vue`
- Create: `registration_system_backend_fe/src/views/teams/TeamAttendancePanel.vue`
- Create: `registration_system_backend_fe/src/views/teams/TeamCreditPanel.vue`
- Create: `registration_system_backend_fe/src/views/teams/TeamMembershipPanel.vue`

**Steps:**
- [x] Move pure display helpers and form patch helpers into `team-detail.model.ts`.
- [x] Extract the profile block to `TeamProfilePanel.vue`.
- [x] Extract member list display to `TeamMemberPanel.vue`.
- [ ] Extract attendance ranking/records to `TeamAttendancePanel.vue`.
- [x] Extract credit transactions/review/penalty display to `TeamCreditPanel.vue`.
- [ ] Extract membership recharge display/actions to `TeamMembershipPanel.vue`.
- [x] Extract super admin assignment display to `TeamAdminPanel.vue`.
- [x] Extract edit/admin assignment/set-role/remove confirmation dialogs to page-local components.
- [x] Keep `TeamDetail.vue` responsible for route loading, service calls, toast handling and event wiring.
- [x] Run `bun run type-check`.
- [x] Run `bun run build`.

## Task 3: Continue Activity Detail Split

**Files:**
- Modify: `registration_system_backend_fe/src/views/activities/ActivityDetail.vue`
- Create: `registration_system_backend_fe/src/views/activities/activity-detail.model.ts`
- Create: `registration_system_backend_fe/src/views/activities/ActivitySummaryPanel.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityCheckInPanel.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityRegistrationTable.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityEditDialog.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityManualRegistrationDialog.vue`

**Steps:**
- [x] Move activity date, match format and registration-progress helpers to `activity-detail.model.ts`.
- [x] Extract top summary area to `ActivitySummaryPanel.vue`.
- [x] Extract check-in config display to `ActivityCheckInPanel.vue`.
- [x] Extract registration filter/table/pagination to `ActivityRegistrationTable.vue`.
- [x] Extract edit activity dialog to `ActivityEditDialog.vue`.
- [x] Extract manual registration and cancellation dialogs to dedicated components.
- [x] Run `bun run type-check`.

## Task 4: Split Player List

**Files:**
- Modify: `registration_system_backend_fe/src/views/players/PlayerList.vue`
- Create: `registration_system_backend_fe/src/views/players/player-list.model.ts`
- Create: `registration_system_backend_fe/src/views/players/PlayerFilterBar.vue`
- Create: `registration_system_backend_fe/src/views/players/PlayerTable.vue`
- Create: `registration_system_backend_fe/src/views/players/PlayerEditDialog.vue`
- Create: `registration_system_backend_fe/src/views/players/PlayerFreezeDialog.vue`

**Steps:**
- [x] Move status labels and filter normalization into `player-list.model.ts`.
- [x] Extract filters to `PlayerFilterBar.vue`.
- [x] Extract table rendering to `PlayerTable.vue`.
- [x] Extract create/edit dialog to `PlayerEditDialog.vue`.
- [x] Extract freeze/unfreeze flow to `PlayerFreezeDialog.vue`.
- [x] Run `bun run type-check`.
- [x] Run `bun run build`.

## Task 5: Split Activity List

**Files:**
- Modify: `registration_system_backend_fe/src/views/activities/ActivityList.vue`
- Create: `registration_system_backend_fe/src/views/activities/activity-list.model.ts`
- Create: `registration_system_backend_fe/src/views/activities/ActivityListToolbar.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityListTable.vue`
- Create: `registration_system_backend_fe/src/views/activities/ActivityStatusSummary.vue`

**Steps:**
- [ ] Move status summary and query param helpers into `activity-list.model.ts`.
- [ ] Extract search/filter/bulk action toolbar to `ActivityListToolbar.vue`.
- [ ] Extract table rendering and row actions to `ActivityListTable.vue`.
- [ ] Extract status counts to `ActivityStatusSummary.vue`.
- [ ] Run `bun run type-check`.

## Verification

- [ ] After each task: `cd registration_system_backend_fe && bun run type-check`.
- [ ] After behavior-affecting service/form changes: `cd registration_system_backend_fe && bun run lint`.
- [ ] Before handoff after a batch: `cd registration_system_backend_fe && bun run build`.

## Deferred Notes

- Do not rewrite the whole admin visual system during these refactors.
- Do not move page-specific components into `src/components/` until two or more pages need them.
- Do not add frontend unit tests for pure visual extraction unless route, permissions, data submission or shared helpers change.
