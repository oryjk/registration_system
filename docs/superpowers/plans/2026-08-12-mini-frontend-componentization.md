# Mini Frontend Componentization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the largest mini-app orchestration files into focused modules while preserving existing behavior and component interfaces.

**Architecture:** Keep each page as a stable facade and visual composition layer. Extract cohesive workflows into page-local composables and split shared pure view-model builders by domain behind a compatibility barrel.

**Tech Stack:** uni-app, Vue 3 Composition API, TypeScript, Vite, Bun

## Global Constraints

- Do not change UI, routes, API contracts, request payloads, response adaptation, or user-visible behavior.
- Preserve H5 and WeChat mini-program compatibility and use `uni.*` APIs only.
- Preserve unrelated working-tree changes.

---

### Task 1: Split match-detail orchestration

**Files:**
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`
- Create: focused page-local composables under `registration_system_mini/src/pages/matches/`

- [ ] Extract registration state and actions without changing the facade returned to `detail.vue`.
- [ ] Extract check-in and review state and actions.
- [ ] Extract settlement state and actions.
- [ ] Run match-detail tests and type-checking.

### Task 2: Split team-management orchestration

**Files:**
- Modify: `registration_system_mini/src/pages/teams/manage/index.vue`
- Create: focused page-local composables under `registration_system_mini/src/pages/teams/manage/`

- [ ] Move page state and workflow orchestration out of the SFC script.
- [ ] Separate profile/logo, membership, and attendance responsibilities inside the page logic.
- [ ] Keep current child component props and emitted events unchanged.
- [ ] Run team-related tests and type-checking.

### Task 3: Split shared view models

**Files:**
- Modify: `registration_system_mini/src/utils/viewModels.ts`
- Create: domain view-model modules under `registration_system_mini/src/utils/viewModels/`

- [ ] Move builders into team, home-match, challenge, billing/attendance, and notification modules.
- [ ] Re-export the existing public functions from `utils/viewModels.ts`.
- [ ] Run view-model tests and type-checking.

### Task 4: Full verification

- [ ] Run `bun test`.
- [ ] Run `bun run type-check`.
- [ ] Run `bun run build:h5`.
- [ ] Run `bun run build:mp-weixin`.
- [ ] Review the final diff for behavior changes and unrelated edits.
