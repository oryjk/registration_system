# Go Mini Home End-to-End Implementation Plan

> **Archive note (2026-08-08):** This completed plan targeted the former `registration_system_mini_go/` project, which has since been removed. Future mini/H5 implementation must use `registration_system_mini/`; paths below remain only as historical execution records.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the production uni-app home page backed by a dedicated authenticated Go user endpoint for actionable and recently ended matches.

**Architecture:** Add `GET /api/matches/home` inside the existing user-authenticated match route group. The match application service owns the 3-action/6-ended limits, a user-only repository query selects matches related through active team membership or registration, and a user DTO maps only home-safe fields. The mini app adds its own types/API/composable and renders the approved task-desk design without importing any admin frontend code.

**Tech Stack:** Go 1.26.5, Gin, PostgreSQL, pgx, sqlc, Go testing/testcontainers, uni-app, Vue 3, TypeScript, Vite, Bun

## Global Constraints

- `/api/admin/**` and `/api/**` remain separate HTTP contracts; no admin handler, admin DTO, or admin frontend API is reused by the mini app.
- The backend may reuse domain/application concepts but the home endpoint is registered only under authenticated user routes.
- No new database columns or migration: the schema has no registration deadline, so the home UI displays start time.
- Home returns at most 3 actionable matches and 6 ended matches; `ended_has_more` is computed by requesting 7 ended rows and trimming.
- Actionable matches are `registering` or `ongoing` matches related to the actor through active host/away team membership or an existing registration.
- Ended matches are actor-related matches with status `ended`, newest first.
- The mini app remains H5 and WeChat compatible and does not simulate WeChat credentials on H5.
- Existing unrelated dirty worktree files are not modified or staged.

---

### Task 1: User Home Query Contract

**Files:**
- Modify: `registration_system_go/internal/match/ports/repository.go`
- Modify: `registration_system_go/internal/match/application/user_query_service.go`
- Modify: `registration_system_go/internal/match/application/user_query_service_test.go`

**Interfaces:**
- Consumes: `sharedauth.Actor`, existing `domain.Match`, `domain.RegistrationGroup`, and `domain.Registration`.
- Produces: `ports.HomeMatchItem`, `UserMatchRepository.ListHomeActionItems(ctx, userID, limit)`, `ListHomeEndedItems(ctx, userID, limit)`, `application.UserMatchHomeResult`, and `UserMatchQueryService.Home(ctx, actor)`.

- [ ] **Step 1: Write failing application tests**

Add tests proving `Home` rejects admin actors, requests action limit `3`, requests ended limit `7`, trims ended rows to `6`, preserves order, and sets `EndedHasMore` only when a seventh row exists.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `go test ./internal/match/application -run 'TestUserMatchHome' -count=1`

Expected: compilation failure because `Home`, `HomeMatchItem`, and repository methods do not exist.

- [ ] **Step 3: Add the minimal port and service implementation**

Define:

```go
type HomeMatchItem struct {
    Item  MatchItem
    Group UserGroupState
}

type UserMatchHomeResult struct {
    ActionItems  []ports.HomeMatchItem
    EndedItems   []ports.MatchItem
    EndedHasMore bool
}
```

`Home` must require a user actor, call the repository with actor ID and limits 3/7, trim ended rows to six, and wrap repository errors with user-facing internal errors.

- [ ] **Step 4: Run application tests and verify GREEN**

Run: `go test ./internal/match/application -count=1`

Expected: PASS.

---

### Task 2: User-Scoped PostgreSQL Home Queries

**Files:**
- Modify: `registration_system_go/db/queries/match.sql`
- Regenerate: `registration_system_go/internal/match/adapters/postgres/sqlc/match.sql.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository_test.go`

**Interfaces:**
- Consumes: the repository methods and `ports.HomeMatchItem` from Task 1.
- Produces: SQL-backed action rows containing a single actor-relevant registration group, attendance count, and actor registration; ended rows contain user-safe match/team data.

- [ ] **Step 1: Write a failing repository integration test**

Seed one actor, an unrelated user, active/inactive team memberships, action matches, seven ended matches, and an unrelated match. Assert that only actor-related active matches are returned, action order is ongoing then nearest registering, group attendance excludes non-attending statuses, current registration belongs to the actor, ended order is newest first, and the repository can return seven rows for application-level `has_more` detection.

- [ ] **Step 2: Run the focused repository test and verify RED**

Run: `go test ./internal/match/adapters/postgres -run 'TestRepositoryListsUserHomeMatches' -count=1`

Expected: compilation failure because the home repository methods do not exist.

- [ ] **Step 3: Add dedicated user SQL**

Add `ListHomeActionMatchesForUser` and `ListHomeEndedMatchesForUser`. The action query selects one non-cancelled group related by active team membership or actor registration using a lateral subquery, calculates attending count from `status='attending'`, and orders `ongoing` before `registering`, then by ascending start time. The ended query uses active host/away membership or any actor registration, filters `status='ended'`, and orders by descending start time.

- [ ] **Step 4: Regenerate sqlc code**

Run: `make generate`

Expected: generated methods and row types compile without manual edits.

- [ ] **Step 5: Map generated rows to ports**

Implement both repository methods. Reuse domain mapping helpers only; do not call `ListForAdmin`, `CountForAdmin`, or any admin HTTP code.

- [ ] **Step 6: Run repository tests and verify GREEN**

Run: `go test ./internal/match/adapters/postgres -run 'TestRepositoryListsUserHomeMatches' -count=1`

Expected: PASS with a running Docker engine.

---

### Task 3: Authenticated User Home HTTP Endpoint

**Files:**
- Modify: `registration_system_go/internal/match/adapters/http/user_handler.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler_test.go`

**Interfaces:**
- Consumes: `UserMatchQueryService.Home` and existing user authentication middleware.
- Produces: `GET /api/matches/home` returning `{code,message,data:{action_items,ended_items,ended_has_more}}`.

- [ ] **Step 1: Write a failing handler test**

Register the handler with user middleware, request `/matches/home`, and assert the JSON includes action match/group state and ended fields but excludes `created_by_admin_id`, roster profiles, and admin-only fields. Also assert the service receives actor kind `user` and ID `42`.

- [ ] **Step 2: Run the focused handler test and verify RED**

Run: `go test ./internal/match/adapters/http -run 'TestUserMatchHome' -count=1`

Expected: failure because the route and DTO do not exist.

- [ ] **Step 3: Add user-only response DTOs and route**

Add `UserHomeActionMatchResponse`, `UserHomeEndedMatchResponse`, and `UserMatchHomeResponse`. Register `GET /matches/home` before `GET /matches/:id`, map opponent name from away team then offline opponent name, and map registration status as nullable.

- [ ] **Step 4: Run handler and router tests**

Run: `go test ./internal/match/adapters/http ./internal/bootstrap -count=1`

Expected: PASS.

---

### Task 4: Mini-App User API and Home State

**Files:**
- Modify: `registration_system_mini_go/src/types/api.ts`
- Create: `registration_system_mini_go/src/api/match.ts`
- Create: `registration_system_mini_go/src/pages/home/useHomeMatches.ts`

**Interfaces:**
- Consumes: `GET /api/matches/home` through the existing `request<T>` user client with `auth: true`.
- Produces: `getHomeMatches(): Promise<HomeMatchesResponse>` and `useHomeMatches()` exposing `homeData`, `loading`, `errorMessage`, `load`, formatting helpers, registration labels, and progress values.

- [ ] **Step 1: Add exact user DTOs**

Define string unions for match/group/registration status and interfaces matching the snake_case user home response. Do not import types from `registration_system_backend_fe_go`.

- [ ] **Step 2: Add the user API function**

Implement `getHomeMatches` with path `/matches/home` and `auth: true`.

- [ ] **Step 3: Add the home composable**

Implement loading/error/data state, locale-safe date/time formatting, opponent fallback `对手待定`, registration labels (`参加`, `请假`, `缺席`, `未报名`), `去报名` only for an open registering group without an attending registration, and a clamped progress ratio using `max_players ?? players_per_team`.

- [ ] **Step 4: Run TypeScript verification**

Run: `bun run type-check`

Expected: PASS.

---

### Task 5: Production Home UI

**Files:**
- Replace: `registration_system_mini_go/src/pages/home/index.vue`
- Create: `registration_system_mini_go/src/pages/home/components/HomeHeader.vue`
- Create: `registration_system_mini_go/src/pages/home/components/HomeHero.vue`
- Create: `registration_system_mini_go/src/pages/home/components/ActionMatchCard.vue`
- Create: `registration_system_mini_go/src/pages/home/components/ActionMatchRow.vue`
- Create: `registration_system_mini_go/src/pages/home/components/EndedMatchList.vue`
- Create: `registration_system_mini_go/src/pages/home/components/HomeBottomNav.vue`
- Modify: `registration_system_mini_go/src/styles/global.scss`

**Interfaces:**
- Consumes: session state and `useHomeMatches` from Task 4.
- Produces: the approved compact green task-desk home page with authenticated, logged-out, loading, error, action-empty, and ended-empty states.

- [ ] **Step 1: Build focused presentational components**

Keep every component input typed with props and emit only semantic commands (`activate`, `retry`, `open-match`, `open-ended`, `open-team-hall`, `open-placeholder`). Use real buttons, 44px targets, inline CSS icons or text where uni-app supports them, visible focus, and no nested cards.

- [ ] **Step 2: Replace the page orchestration**

On logged-in `onShow`, load home data; on pull-to-refresh, refresh session teams and home data. On 401/403, clear the session. Keep H5 logged-out behavior honest: show the WeChat login prompt without fake credentials. Unsupported destination buttons show concise `uni.showToast` messages and do not mutate business state.

- [ ] **Step 3: Apply the visual system**

Use `#13251A`, `#B8F229`, `#F3F5F1`, white surfaces, 10-12px cards, stable image aspect ratio, tabular figures, safe-area bottom spacing, a compact football-field hero, one full action card, up to two action rows, six ended rows, and a fixed five-item bottom navigation.

- [ ] **Step 4: Run mini-app builds**

Run: `bun run type-check && bun run build:h5 && bun run build:mp-weixin`

Expected: all commands PASS.

---

### Task 6: End-to-End Verification and Visual QA

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: completed Go endpoint and mini app.
- Produces: passing backend quality gates and screenshots proving the rendered home page at required mobile widths.

- [ ] **Step 1: Run backend quality gates**

Run from `registration_system_go`:

```bash
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

Expected: all PASS.

- [ ] **Step 2: Start H5 and inspect with mocked user endpoint only in the browser test**

Start `bun run dev:h5` on an available port. Seed a test-only cached user/token in browser storage and intercept only `/go-api/api/matches/home` with the exact production DTO; do not add mock data to product source.

- [ ] **Step 3: Capture and inspect screenshots**

Verify 360x800, 390x844, and 420x900. Check no horizontal overflow, no text overlap, compact hero plus primary action information in the initial viewport, six ended rows reachable above the bottom nav, 44px targets, and nonblank hero imagery.

- [ ] **Step 4: Verify runtime behavior**

Confirm loading/error/retry and logged-out states, pull-to-refresh, toast-only placeholder actions, console cleanliness, and that product requests use `/api/matches/home` rather than `/api/admin/**`.

- [ ] **Step 5: Review the final diff**

Run `git diff --check`, inspect `git status --short`, and confirm unrelated `.agents/`, `.superpowers/`, old untracked plan, and `.turbopack/` files were not staged or modified.
