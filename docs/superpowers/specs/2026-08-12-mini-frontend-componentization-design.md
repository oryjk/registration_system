# Mini Frontend Componentization Design

## Goal

Reduce the maintenance risk of the largest mini-app orchestration files without changing UI, routes, API contracts, or user-visible behavior.

## Scope

- Split match-detail orchestration by registration, check-in/review, and settlement responsibilities.
- Split team-management orchestration by profile, membership, and attendance responsibilities.
- Split shared view-model builders by business domain while preserving the current `@/utils/viewModels` import surface.
- Keep page-local UI components presentation-only: props in, events out, no direct business API calls.

## Architecture

`useMatchDetailPage.ts` remains the page facade. Domain composables receive the shared refs and dependencies they need, own their domain state and actions, and return the same properties currently consumed by `detail.vue`.

`pages/teams/manage/index.vue` remains the visual composition layer. A page composable owns page state and delegates profile, membership, and attendance workflows to focused local modules. Existing child component props and events remain unchanged.

Shared view-model builders move into domain files. `utils/viewModels.ts` becomes a compatibility barrel so current imports do not require a repository-wide rewrite.

## Constraints

- Preserve H5 and WeChat mini-program compatibility.
- Use `uni.*` APIs only.
- Do not change API payloads, response adaptation, routing, UI copy, or styling.
- Preserve unrelated working-tree changes.
- Refactoring verification uses existing tests, type-checking, H5 build, and mini-program build.

## Verification

- Run focused existing tests after each extraction where practical.
- Run `bun test` and `bun run type-check` after all extractions.
- Run `bun run build:h5` and `bun run build:mp-weixin` before completion.
