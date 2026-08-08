# Go Mini Match Registration Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Go-backed match browsing, personal registration, team-candidate flows, remove Rust-only mini-program entry points, and execute the forward-only production cutover.

**Architecture:** Existing Match remains the sole aggregate root and existing team-application behavior is reused. A focused registration application service executes all registration state changes inside a repository transaction that locks the match/group and recalculates capacity/opponent state atomically. The mini program maps Go DTOs into page view models, keeps pages as orchestration layers, and finishes with a static/runtime audit proving no registered page calls Rust or unversioned business APIs.

**Tech Stack:** Go 1.26.5, Gin, pgx/sqlc, PostgreSQL, uni-app, Vue 3, TypeScript, Vite, Bun, WeChat Developer Tools.

## Global Constraints

- Plans 1 and 2 must pass their completion gates before this plan begins.
- Match is the only match aggregate; do not recreate Rust `activity` or `challenge` domain models in Go.
- App endpoints remain under `/api/v1/app`; mini domain clients use paths relative to a base already ending in `/api/v1/app`.
- `GET /matches` supports `scope=all|mine`, defaults to `all`, combines with status/search/page/page_size, and returns `422` for any other scope.
- `scope=mine` is the union of non-cancelled personal registration and active-team host/selected-away relationships, deduplicated before existing pagination.
- User registration writes are exactly `PUT /matches/:id/groups/:group_id/my-registration` and `DELETE` on the same path.
- First-version user writes always use `registration_count=1`; allowed request statuses are `attending`, `leave`, and `absent` subject to group rules.
- Match/group locks, cross-group uniqueness, capacity calculation, registration write, group status, and opponent-state recalculation occur in one target transaction.
- Team application routes and service are reused; app pages may list/apply/select/withdraw only according to backend permissions.
- First version excludes bills, payments, recharge, check-in, notifications, points, settlement, team writes, and match publishing.
- Preserve `VITE_USE_MOCK`; mocks use exact Go routes, DTOs, state transitions, and error codes.
- Keep four tabs named `首页 / 比赛 / 球队 / 我的`; remove the center create action.
- Do not implement rollback, dual write, reverse migration, or Rust/Go runtime switching; failures pause the cutover and are fixed forward on Go.
- Do not modify `registration_system_rs/` or its data.

---

## File Structure

- `registration_system_go/internal/match/application/user_registration_service.go`: personal registration commands and business orchestration.
- `registration_system_go/internal/match/ports/user_registration_repository.go`: transaction boundary and locked operations.
- `registration_system_go/internal/match/adapters/postgres/user_registration_repository.go`: pgx transaction and SQL error mapping.
- `registration_system_go/internal/match/adapters/http/user_registration_handler.go`: app request/response protocol only.
- `registration_system_go/internal/match/application/user_query_service.go`: validates and passes match list scope.
- `registration_system_mini/src/types/match.ts`: exact app Match DTOs.
- `registration_system_mini/src/api/match.ts`: atomic app match and registration calls.
- `registration_system_mini/src/utils/matchViewModels.ts`: DTO-to-display mapping shared by pages.
- `registration_system_mini/src/pages/matches/`: detail orchestration and registration/application components.
- `registration_system_mini/src/pages/{home,activities,user}/`: Go home/list/mine pages.
- `registration_system_mini/src/pages.json` and `src/components/BottomTabBar.vue`: final supported navigation surface.

### Task 1: Add `scope=mine` to match listing

**Files:**
- Modify: `registration_system_go/internal/match/application/user_query_service.go`
- Modify: `registration_system_go/internal/match/application/user_query_service_test.go`
- Modify: `registration_system_go/internal/match/ports/repository.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler_test.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository_test.go`
- Modify: `registration_system_go/db/queries/match.sql`

**Interfaces:**
- Consumes: current `UserMatchListQuery`, `MatchListFilter`, active user ID, match status/search/pagination.
- Produces: `MatchScope` enum (`all`, `mine`), repository filters carrying `UserID`, and correctly deduplicated `scope=mine` pages.

- [ ] **Step 1: Write application and handler scope tests**

Add:

```go
type MatchScope string
const (MatchScopeAll MatchScope = "all"; MatchScopeMine MatchScope = "mine")
type UserMatchListQuery struct {
    Scope MatchScope
    Status *domain.MatchStatus
    Search string
    Page, PageSize int
}
```

Test omitted scope -> `all`, explicit `mine`, `mine` passed with `actor.ID`, invalid scope -> validation error/HTTP `422`, and status/search/page values preserved.

- [ ] **Step 2: Run application/HTTP tests and confirm missing scope fails**

Run: `cd registration_system_go && go test ./internal/match/application ./internal/match/adapters/http`

Expected: FAIL because scope is absent from query/filter parsing.

- [ ] **Step 3: Write repository tests for the union semantics**

Seed separate matches for: non-cancelled personal registration, cancelled-only registration, active host-team membership, inactive host membership, active selected-away membership, candidate-but-not-selected team, unrelated match, and one match related by both registration/team. Assert the related match appears once, `total` counts distinct matches, filters combine, and pagination occurs after deduplication.

- [ ] **Step 4: Implement one SQL predicate for `mine`**

Extend `MatchListFilter`:

```go
type MatchListFilter struct {
    Scope MatchScope
    UserID int64
    Status *domain.MatchStatus
    Search string
    Limit, Offset int
}
```

Use `EXISTS` predicates rather than joins that duplicate rows:

```sql
AND (
  sqlc.arg('scope')::text = 'all'
  OR EXISTS (
    SELECT 1 FROM match_registration_groups g
    JOIN match_registrations r ON r.group_id = g.id
    WHERE g.match_id = m.id AND r.user_id = sqlc.arg('user_id') AND r.status <> 'cancelled'
  )
  OR EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = sqlc.arg('user_id') AND tm.status = 'active'
      AND (tm.team_id = m.host_team_id OR tm.team_id = m.away_team_id)
  )
)
```

Apply identical predicates to list and count queries.

- [ ] **Step 5: Generate, verify, and commit**

Run: `cd registration_system_go && sqlc generate && gofmt -w internal/match && go test ./internal/match/... && go test ./...`

Expected: PASS.

```bash
git add registration_system_go/db/queries/match.sql registration_system_go/internal/match
git commit -m "feat(go): filter app matches by user scope"
```

### Task 2: Define personal registration domain transitions and application rules

**Files:**
- Modify: `registration_system_go/internal/match/domain/registration.go`
- Modify: `registration_system_go/internal/match/domain/registration_group.go`
- Modify: `registration_system_go/internal/match/domain/match.go`
- Create: `registration_system_go/internal/match/domain/user_registration_test.go`
- Create: `registration_system_go/internal/match/application/user_registration_service.go`
- Create: `registration_system_go/internal/match/application/user_registration_service_test.go`
- Create: `registration_system_go/internal/match/ports/user_registration_repository.go`
- Modify: `registration_system_go/internal/match/ports/team_access.go`

**Interfaces:**
- Consumes: authenticated user actor, match/group IDs, requested status, current registration/capacity, team membership, and clock.
- Produces: `UserRegistrationService.Put(ctx, actor, matchID, groupID, command) (domain.Registration, error)` and `Delete(ctx, actor, matchID, groupID) (domain.Registration, error)` within a repository transaction.

- [ ] **Step 1: Write domain transition tests**

Cover `attending <-> leave <-> absent`, cancelled reactivation, individual groups accepting only attending, idempotent same-status updates, cancellation timestamps, group close/reopen at max capacity, and match opponent recruiting/confirmed around `min_players`.

Add explicit methods rather than mutating exported fields in application code:

```go
func (r *Registration) ApplyUserStatus(status RegistrationStatus, now time.Time) error
func (r *Registration) Cancel(now time.Time)
func (r Registration) OccupiesCapacity() bool
func (g *RegistrationGroup) RecalculateIndividualStatus(attending int, now time.Time) error
func (m *Match) RecalculateIndividualOpponent(attending, minPlayers int, now time.Time) error
```

- [ ] **Step 2: Run domain tests and verify missing transitions fail**

Run: `cd registration_system_go && go test ./internal/match/domain -run UserRegistration`

Expected: FAIL because transition APIs and timestamp updates are incomplete.

- [ ] **Step 3: Define the transactional port**

Create:

```go
type UserRegistrationRepository interface {
    WithinUserRegistrationTransaction(context.Context, func(UserRegistrationTransaction) error) error
}
type UserRegistrationTransaction interface {
    FindMatchForUpdate(context.Context, uuid.UUID) (domain.Match, bool, error)
    FindGroupForUpdate(context.Context, uuid.UUID, uuid.UUID) (domain.RegistrationGroup, bool, error)
    FindUserRegistrationForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
    FindActiveUserRegistrationInMatchForUpdate(context.Context, uuid.UUID, int64) (domain.Registration, bool, error)
    CountAttendingForGroup(context.Context, uuid.UUID) (int, error)
    SaveRegistration(context.Context, domain.Registration) error
    UpdateGroup(context.Context, domain.RegistrationGroup) error
    UpdateMatchOpponent(context.Context, domain.Match) error
}
```

Extend team access with `EnsureActiveMember(ctx, teamID, userID) error` for team-group authorization and `IsActiveMember(ctx, teamID, userID) (bool, error)` for excluding host-team members from the individual-opponent group; both are distinct from manager checks.

- [ ] **Step 4: Write application tests for every fixed rule**

Test:

```text
only user actor; match must be registering; group belongs to match
host/guest group requires active member of group team
guest group exists only after selected candidate creates it
individual group accepts attending only and rejects host team members
one non-cancelled registration per user per match across groups
registration_count is always one
attending capacity only; leave/absent/cancelled do not occupy capacity
closed/cancelled/full/new-write conflicts are 409
identity failure is 403; invalid status/count is 422
repeat PUT is idempotent; cancelled row can reactivate
repeat DELETE returns same cancelled row; never-existing row is 404
lost membership can cancel owned registration but cannot create/update
```

Use a fake transactional repository that records whether all writes happen inside the callback and whether no partial write survives an injected error.

- [ ] **Step 5: Implement the minimal application orchestration**

Use:

```go
type PutMyRegistrationCommand struct {
    Status domain.RegistrationStatus
    RegistrationCount int
}
```

Validate `RegistrationCount == 1` before the transaction. Inside it, lock match then group, load current/cross-group registrations, authorize the group, compute capacity excluding/replacing the caller's previous attending count, apply/save the registration, then recalculate individual group and match state. Delete checks ownership but deliberately does not call team membership access.

For a guest-team group, also require `match.opponent_state=confirmed`, `match.away_team_id != nil`, and `group.team_id == match.away_team_id`; otherwise return conflict. For an individual group, call `IsActiveMember` against the host team and return `403` when true.

- [ ] **Step 6: Verify domain/application behavior and commit**

Run: `cd registration_system_go && gofmt -w internal/match/domain internal/match/application internal/match/ports && go test ./internal/match/domain ./internal/match/application`

Expected: PASS.

```bash
git add registration_system_go/internal/match/domain registration_system_go/internal/match/application/user_registration_service.go registration_system_go/internal/match/application/user_registration_service_test.go registration_system_go/internal/match/ports
git commit -m "feat(go): define personal match registration rules"
```

### Task 3: Implement atomic PostgreSQL registration writes and app HTTP endpoints

**Files:**
- Modify: `registration_system_go/db/queries/match.sql`
- Create: `registration_system_go/internal/match/adapters/postgres/user_registration_repository.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository_test.go`
- Create: `registration_system_go/internal/match/adapters/http/user_registration_handler.go`
- Create: `registration_system_go/internal/match/adapters/http/user_registration_handler_test.go`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`

**Interfaces:**
- Consumes: application interfaces from Task 2.
- Produces: idempotent `PUT/DELETE /api/v1/app/matches/:id/groups/:group_id/my-registration` and transaction-safe persistence.

- [ ] **Step 1: Write PostgreSQL repository tests including a capacity race**

Seed a registering match with an individual group `max_players=1`, then start two concurrent transactions for different users. Assert exactly one attending write commits and the other returns conflict; attending count remains one. Also test cross-group uniqueness, cancelled-row reactivation, repeat delete, rollback after group update failure, and lock order match -> group -> registration.

- [ ] **Step 2: Run repository tests and verify missing transaction adapter fails**

Run: `cd registration_system_go && TEST_DATABASE_URL="$TEST_DATABASE_URL" go test -race ./internal/match/adapters/postgres -run 'UserRegistration|CapacityRace'`

Expected: FAIL because transaction methods/SQL do not exist. If `TEST_DATABASE_URL` is absent, provision the repository's documented disposable PostgreSQL test database; do not mark the race test complete by skipping it.

- [ ] **Step 3: Add locked SQL and upsert behavior**

Create sqlc queries for match/group/registration `FOR UPDATE`, attending sum, active cross-group registration, registration insert/update, group update, and match opponent update. Map uniqueness/check violations to domain conflict/validation errors. Use the existing `database.Begin` pattern and always rollback on callback error.

- [ ] **Step 4: Write HTTP contract tests**

Use exact DTOs:

```go
type MyRegistrationRequest struct {
    Status domain.RegistrationStatus `json:"status" binding:"required"`
    RegistrationCount int `json:"registration_count" binding:"required"`
}
type MyRegistrationResponse struct {
    GroupID string `json:"group_id"`; UserID int64 `json:"user_id"`; Status domain.RegistrationStatus `json:"status"`
    RegistrationCount int `json:"registration_count"`; UpdatedAt time.Time `json:"updated_at"`
}
```

Test malformed UUID/JSON `422`, unauthenticated `401`, forbidden membership `403`, missing match/group/record `404`, state/capacity conflicts `409`, and successful PUT/DELETE Go envelopes.

- [ ] **Step 5: Register the handlers and verify full behavior**

Register both methods on protected app routes. Ensure error mapping uses existing shared HTTP error writer and does not expose SQL details.

Run: `cd registration_system_go && sqlc generate && gofmt -w internal/match internal/bootstrap && go test -race ./internal/match/... ./internal/bootstrap && go test -race ./...`

Expected: PASS, including concurrent capacity test.

- [ ] **Step 6: Commit persistence and protocol**

```bash
git add registration_system_go/db/queries/match.sql registration_system_go/internal/match/adapters registration_system_go/internal/bootstrap
git commit -m "feat(go): expose atomic personal registration API"
```

### Task 4: Add exact mini Match APIs, types, view models, and mocks

**Files:**
- Create: `registration_system_mini/src/types/match.ts`
- Create: `registration_system_mini/src/api/match.ts`
- Create: `registration_system_mini/src/api/__tests__/matchApi.test.ts`
- Create: `registration_system_mini/src/utils/matchViewModels.ts`
- Create: `registration_system_mini/src/utils/__tests__/matchViewModels.test.ts`
- Modify: `registration_system_mini/src/mock/handlers.ts`
- Create: `registration_system_mini/src/mock/data/matches.ts`

**Interfaces:**
- Consumes: Go match/home/detail/list/group/registration/team-application DTOs from handlers.
- Produces: typed atomic calls and display models shared by home/list/detail pages.

- [ ] **Step 1: Write endpoint construction and mapping tests**

Test exact requests:

```ts
listMatches({ scope: "mine", page: 2, pageSize: 20 })
// GET /matches?scope=mine&page=2&page_size=20
putMyRegistration(matchId, groupId, { status: "attending", registration_count: 1 })
// PUT /matches/:id/groups/:groupId/my-registration
deleteMyRegistration(matchId, groupId)
// DELETE same path
```

View-model tests cover all match/publication/opponent/group/registration states, RFC3339 date formatting, nullable coordinates/description/away team, opponent fallback, capacity label, and current-user registration status.

- [ ] **Step 2: Run focused tests and confirm APIs are absent**

Run: `cd registration_system_mini && bun test src/api/__tests__/matchApi.test.ts src/utils/__tests__/matchViewModels.test.ts`

Expected: FAIL because the Go match client/types do not exist.

- [ ] **Step 3: Define DTOs exactly once**

Create string unions matching Go domain constants and interfaces matching `UserMatchResponse`, `UserGroupResponse`, `UserMatchHomeResponse`, `MyRegistrationResponse`, and existing app team-application handler JSON. IDs for matches/groups/applications are strings; user/team IDs are numbers. Do not reuse Rust numeric activity statuses.

- [ ] **Step 4: Implement domain-relative APIs**

Export:

```ts
getMatchHome(): Promise<AppMatchHome>
listMatches(query: MatchListQuery): Promise<AppMatchListPage>
getMatchDetail(matchId: string): Promise<AppMatchDetail>
putMyRegistration(matchId: string, groupId: string, body: MyRegistrationRequest): Promise<MyRegistrationResponse>
deleteMyRegistration(matchId: string, groupId: string): Promise<MyRegistrationResponse>
listTeamApplications(matchId: string): Promise<TeamApplication[]>
createTeamApplication(matchId: string, body: CreateTeamApplicationRequest): Promise<TeamApplication>
selectTeamApplication(matchId: string, applicationId: string): Promise<TeamApplication>
withdrawTeamApplication(matchId: string, applicationId: string): Promise<TeamApplication>
```

- [ ] **Step 5: Implement stateful mocks for happy/error paths**

Seed registering/ongoing/ended/cancelled matches across offline/team/individual modes. Mock PUT/DELETE updates the detail/home/list state and returns `409` for closed/full/read-only matches, `403` for wrong team identity, and `422` for invalid status/count. Team application mocks enforce pending/selected/withdrawn transitions.

- [ ] **Step 6: Verify and commit Match client foundation**

Run: `cd registration_system_mini && bun test src/api/__tests__/matchApi.test.ts src/utils/__tests__/matchViewModels.test.ts && bun run type-check`

Expected: PASS.

```bash
git add registration_system_mini/src/types/match.ts registration_system_mini/src/api/match.ts registration_system_mini/src/api/__tests__/matchApi.test.ts registration_system_mini/src/utils/matchViewModels.ts registration_system_mini/src/utils/__tests__/matchViewModels.test.ts registration_system_mini/src/mock
git commit -m "feat(mini): add Go match API models"
```

### Task 5: Convert home, match hall, match lists, and detail reads

**Files:**
- Modify: `registration_system_mini/src/pages/home/index.vue`
- Modify: `registration_system_mini/src/pages/home/matches/index.vue`
- Modify: `registration_system_mini/src/pages/activities/index.vue`
- Modify: `registration_system_mini/src/pages/user/matches/index.vue`
- Modify: `registration_system_mini/src/pages/user/matches/userMatchesState.ts`
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
- Replace: `registration_system_mini/src/pages/matches/detailData.ts`
- Replace: `registration_system_mini/src/pages/matches/detailState.ts`
- Modify: relevant presentation components under `registration_system_mini/src/pages/home/components/`, `activities/components/`, `user/matches/components/`, and `matches/components/`
- Modify: `registration_system_mini/src/pages/__tests__/homePageLoading.test.ts`
- Modify: `registration_system_mini/src/pages/__tests__/activitiesPageSections.test.ts`
- Modify: `registration_system_mini/src/pages/__tests__/matchDetailRegistrationDesign.test.ts`

**Interfaces:**
- Consumes: Task 4 atomic APIs and view models.
- Produces: Go-backed home, `scope=all` hall/list, `scope=mine` user list, and Match detail reads without Rust service calls.

- [ ] **Step 1: Replace obsolete static assertions with behavior-focused tests**

Test that home calls only `getMatchHome`, hall/home match list use `scope=all`, user matches uses `scope=mine`, detail calls `getMatchDetail`, and `401/403/404/network` render distinct states. Keep visual tests only where they protect important loading/interaction behavior; remove tests whose sole purpose was to require activity/challenge/payment code.

- [ ] **Step 2: Run page tests and verify Rust imports fail expectations**

Run: `cd registration_system_mini && bun test src/pages/__tests__/homePageLoading.test.ts src/pages/__tests__/activitiesPageSections.test.ts src/pages/__tests__/matchDetailRegistrationDesign.test.ts`

Expected: FAIL because pages still import `activity`, `challenge`, `billing`, or user-activity APIs.

- [ ] **Step 3: Convert each page as an orchestration layer**

Home loads `/matches/home`; hall loads `/matches?scope=all`; home match list paginates `scope=all`; user matches paginates `scope=mine`; detail loads `/matches/:id`. Move DTO conversions into `matchViewModels.ts` or page-local state files. Preserve existing layout where compatible, but delete challenge/runtime-config/notification/payment/check-in requests and controls.

- [ ] **Step 4: Handle direct and unauthenticated access explicitly**

All first-stage Match endpoints are protected. Pages call the shared session bootstrap once, show `FloatingLoginPrompt` on `401`, retain session and show permission state on `403`, show invalid resource on `404`, and expose retry on network failure. They must not loop automatic login.

- [ ] **Step 5: Verify and commit read-only pages**

Run: `cd registration_system_mini && bun test src/pages/__tests__/homePageLoading.test.ts src/pages/__tests__/activitiesPageSections.test.ts src/pages/__tests__/matchDetailRegistrationDesign.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5`

Expected: PASS.

```bash
git add registration_system_mini/src/pages/home registration_system_mini/src/pages/activities registration_system_mini/src/pages/user/matches registration_system_mini/src/pages/matches
git commit -m "feat(mini): browse Go matches"
```

### Task 6: Connect personal registration UI and conflict recovery

**Files:**
- Replace: `registration_system_mini/src/pages/matches/detailActions.ts`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`
- Create: `registration_system_mini/src/pages/matches/components/MyRegistrationControl.vue`
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
- Modify: `registration_system_mini/src/pages/__tests__/matchRegistrationVisibility.test.ts`
- Create: `registration_system_mini/src/pages/__tests__/myRegistrationActions.test.ts`

**Interfaces:**
- Consumes: Match detail group state and Task 4 `putMyRegistration`/`deleteMyRegistration`.
- Produces: attending/leave/absent updates for eligible team groups, attending/cancel for individual groups, idempotent submit lock, and refresh-on-409 behavior.

- [ ] **Step 1: Write visibility and action tests**

Cover registering versus read-only match, group open/closed/cancelled, correct team membership, selected guest group, host member excluded from individual group, existing status, repeated click sharing/ignoring in-flight request, `409` detail refresh and confirmation message, `403` session preservation, `422` field message, and successful response replacing local state.

- [ ] **Step 2: Run tests and confirm old activity registration actions fail**

Run: `cd registration_system_mini && bun test src/pages/__tests__/matchRegistrationVisibility.test.ts src/pages/__tests__/myRegistrationActions.test.ts`

Expected: FAIL because current actions submit Rust activity registration/check-in/settlement flows.

- [ ] **Step 3: Implement a focused action controller**

Expose:

```ts
export function createMyRegistrationActions(deps: {
  put: typeof putMyRegistration;
  remove: typeof deleteMyRegistration;
  refresh: () => Promise<void>;
}) {
  return { submit(groupId: string, status: UserRegistrationWriteStatus): Promise<void>, cancel(groupId: string): Promise<void> };
}
```

Always send `registration_count: 1`. Maintain one in-flight key per group. On `409`, refresh detail before surfacing the prompt; never optimistic-increment capacity. On success, use returned registration then refresh the detail/group count.

- [ ] **Step 4: Build accessible, stable registration controls**

Use a segmented control/menu for team statuses and a clear primary attending action for individual groups; use a confirmation dialog for cancel. Disable while submitting, preserve fixed control dimensions, and use the existing icon library. Do not show controls when backend state says the action is unavailable.

- [ ] **Step 5: Verify and commit personal registration**

Run: `cd registration_system_mini && bun test src/pages/__tests__/matchRegistrationVisibility.test.ts src/pages/__tests__/myRegistrationActions.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5 && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin`

Expected: PASS.

```bash
git add registration_system_mini/src/pages/matches registration_system_mini/src/pages/__tests__
git commit -m "feat(mini): complete personal match registration"
```

### Task 7: Connect existing team-candidate application flows

**Files:**
- Create: `registration_system_mini/src/pages/matches/teamApplicationState.ts`
- Create: `registration_system_mini/src/pages/matches/teamApplicationActions.ts`
- Create: `registration_system_mini/src/pages/matches/components/TeamApplicationPanel.vue`
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`
- Create: `registration_system_mini/src/pages/__tests__/teamApplicationActions.test.ts`

**Interfaces:**
- Consumes: current team identity/role, Match publication/opponent state, and Task 4 team-application APIs.
- Produces: role-scoped list/apply/select/withdraw interactions using existing Go backend behavior.

- [ ] **Step 1: Read and lock the existing backend contract in tests**

Before UI code, inspect `internal/match/adapters/http/team_application_handler.go` and its tests. Mirror its actual JSON request/response fields in `src/types/match.ts`; do not rename or invent fields. Test applicant manager can apply/withdraw, host manager can list/select, ordinary member cannot manage, selected withdrawal reopens recruitment, and `409` triggers a refreshed list/detail.

- [ ] **Step 2: Run focused tests and verify action module is absent**

Run: `cd registration_system_mini && bun test src/pages/__tests__/teamApplicationActions.test.ts`

Expected: FAIL because state/actions/components do not exist.

- [ ] **Step 3: Implement state derivation and API orchestration**

`teamApplicationState.ts` derives allowed controls only from backend Match/application status plus `currentIdentity.role`; it does not guess permission from local team ownership. `teamApplicationActions.ts` serializes each mutation, refreshes applications and Match detail after success or `409`, and preserves session on `403`.

- [ ] **Step 4: Add the candidate panel to online-team details**

Render it only for `publication_mode=online_team`. Candidate teams see their application/status; host managers see pending candidates and selection controls; non-managers see read-only opponent state. Use returned team names and introduction; never fetch private team member details to render a public candidate.

- [ ] **Step 5: Verify and commit team application UI**

Run: `cd registration_system_mini && bun test src/pages/__tests__/teamApplicationActions.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5 && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin`

Expected: PASS.

```bash
git add registration_system_mini/src/pages/matches registration_system_mini/src/pages/__tests__/teamApplicationActions.test.ts registration_system_mini/src/types/match.ts
git commit -m "feat(mini): manage match team applications"
```

### Task 8: Simplify profile, Mine, tabs, and registered pages

**Files:**
- Modify: `registration_system_mini/src/pages/profile/setup/index.vue`
- Modify: `registration_system_mini/src/pages/user/index.vue`
- Modify: relevant `registration_system_mini/src/pages/user/components/`
- Modify: `registration_system_mini/src/pages.json`
- Modify: `registration_system_mini/src/components/BottomTabBar.vue`
- Modify: `registration_system_mini/src/components/__tests__/bottomTabBarAssets.test.ts`
- Modify: `registration_system_mini/src/pages/__tests__/appRouteFallback.test.ts`
- Modify: `registration_system_mini/src/pages/__tests__/userPageBackground.test.ts`
- Delete or de-register references from: `registration_system_mini/src/pages/teams/manage/`, `matches/create/`, `challenges/`, `notifications/`, `billing/`

**Interfaces:**
- Consumes: Go current user/team/match APIs only.
- Produces: four-tab supported surface and no registered route/store/component reference to Rust-only APIs.

- [ ] **Step 1: Write navigation and static boundary tests**

Parse `src/pages.json` as JSONC and assert exactly four tabs:

```text
pages/home/index -> 首页
pages/activities/index -> 比赛
pages/teams/index -> 球队
pages/user/index -> 我的
```

Assert removed route paths are absent, `BottomTabBar` has no center-create action/menu, H5 unknown routes redirect home, and registered page/component dependency traversal contains no imports from `api/activity`, `challenge`, `billing`, `payment`, or `notification`.

- [ ] **Step 2: Run navigation tests and verify current routes fail**

Run: `cd registration_system_mini && bun test src/components/__tests__/bottomTabBarAssets.test.ts src/pages/__tests__/appRouteFallback.test.ts src/pages/__tests__/userPageBackground.test.ts`

Expected: FAIL because old routes/tabs/create menu and Mine payment calls still exist.

- [ ] **Step 3: Reduce profile and Mine to supported facts**

Profile setup edits only nickname and real name through `PATCH /users/me`; remove phone binding/avatar upload controls. Mine shows user, team identity, and a link/summary for `scope=mine` matches; remove wallet, recharge, notifications, attendance, points, payment, and settlement calls/components.

- [ ] **Step 4: Apply the route and tab matrix**

Remove registrations for:

```text
pages/teams/manage/index
pages/matches/create/index
pages/challenges/detail
pages/challenges/create-individual/index
pages/notifications/index
pages/billing/index
```

Delete every navigation entry to them. The source files may be deleted when no longer referenced; if retained temporarily for history, they must not be registered, imported, or present in the built page graph.

- [ ] **Step 5: Audit all active imports and request paths**

Run:

```bash
cd registration_system_mini
rg -n '@/api/(activity|challenge|billing|payment|notification)|"/(wx/login|user/login|user/info|teams/my-teams)|/api/' src/pages src/components src/stores src/api
```

Expected: no result in registered pages/components/stores or live Go API modules. Allow only deliberately unregistered legacy source files after manually proving they are absent from `pages.json` and import graph; prefer deleting them to keep future agent context clean.

- [ ] **Step 6: Verify and commit UI scope closure**

Run: `cd registration_system_mini && bun test && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5 && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin`

Expected: PASS.

```bash
git add -A registration_system_mini/src/pages registration_system_mini/src/components registration_system_mini/src/pages.json registration_system_mini/src/api registration_system_mini/src/stores
git commit -m "feat(mini): close unsupported Rust feature surface"
```

### Task 9: Final verification, migration, and forward-only cutover

**Files:**
- Create: `docs/runbooks/go-mini-production-cutover.md`
- Modify: `README.md`
- Modify: `registration_system_mini/README.md`
- Modify: `registration_system_go/README.md`

**Interfaces:**
- Consumes: completed auth, migration, team, Match, registration, application, and page deliverables.
- Produces: auditable release evidence and Go production configuration; no rollback automation.

- [ ] **Step 1: Document the pause conditions and exact cutover order**

The runbook must stop before traffic switch when any dry-run conflict is unexplained, reconciliation counts/relationships differ, required test/build fails, or H5/WeChat smoke cannot login/browse/register. Use this order:

```text
1. Confirm no new Rust production release/write window is in progress.
2. Run final team incremental dry-run, formal import, and repeat dry-run.
3. Run final match incremental dry-run, formal import, and repeat dry-run.
4. Review mapping, membership, registration, terminal-status, and orphan reports.
5. Deploy Go API with H5 test routes absent in production.
6. Point H5 and mini VITE_API_BASE_URL to the production /api/v1/app root.
7. Deploy admin with /api/v1/admin root.
8. Publish H5/mini and notify users that one fresh login is required.
9. Smoke user 37, ordinary member, and no-team user.
10. On failure, stop further rollout and fix forward on main.
```

- [ ] **Step 2: Run complete automated gates from a clean index**

First confirm unrelated worktree changes are not staged. Then run:

```bash
cd registration_system_go
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
go build -o /tmp/importlegacyteams ./cmd/importlegacyteams
go build -o /tmp/importlegacymatches ./cmd/importlegacymatches

cd ../registration_system_backend_fe_go
bun run type-check
bun run lint
bun run build

cd ../registration_system_mini
bun test
bun run type-check
VITE_API_BASE_URL=https://api.example.com/api/v1/app bun run build:h5
VITE_API_BASE_URL=https://api.example.com/api/v1/app bun run build:mp-weixin
```

Expected: every command exits `0`; the release pipeline supplies the real production origin instead of the documented `api.example.com` example.

- [ ] **Step 3: Inspect build and runtime request surfaces**

Search H5 and MP build output for `/api/` paths and classify each result. Business requests must contain `/api/v1/app`; admin must contain `/api/v1/admin`; `/health` is the only unversioned endpoint. Use browser/network tooling and WeChat Developer Tools to prove login, home, list, detail, registration, cancellation, and candidate application requests hit Go only.

- [ ] **Step 4: Execute the role/state smoke matrix**

Verify user `37`, an ordinary member, and a no-team user across login/restore/logout, home/all/mine/detail, team detail/members, team attending/leave/absent/cancel, individual attending/cancel, full group `409`, read-only match, wrong identity `403`, stale resource `404`, validation `422`, network retry, team apply/select/withdraw, and duplicate submit. Require all users to log in again; do not clear Rust JWT/cache serverside.

- [ ] **Step 5: Record migration/release evidence without secrets**

Record commit/tag or release ID, timestamps, source/target counts, inserted/updated/skipped/conflict summaries, smoke roles, build checksums, and pass/fail. Never record tokens, OpenIDs, phone numbers, connection strings, AppSecret, or explicit mapping file contents.

- [ ] **Step 6: Commit final runbook and documentation**

```bash
git add docs/runbooks/go-mini-production-cutover.md README.md registration_system_mini/README.md registration_system_go/README.md
git commit -m "docs: add Go mini production cutover runbook"
```

## Plan Completion Gate

- [ ] `scope=mine` is correct, deduplicated, filterable, and paginated in PostgreSQL.
- [ ] Personal registration rules, idempotency, cancellation, capacity, and concurrent race behavior are covered by Go tests.
- [ ] Team application UI mirrors the existing Go handler DTO and permissions without private-team data leakage.
- [ ] All four active tabs/pages use Go DTOs and `/api/v1/app`; unsupported pages and create action are absent.
- [ ] H5 and WeChat runtime panels show no Rust or unversioned business request.
- [ ] Final incremental migrations have zero unexplained conflicts and repeat dry-runs have zero writes.
- [ ] Go, Go admin, H5, and MP verification gates pass.
- [ ] Production H5 test-auth routes return `404`, users perform one fresh login, and no Rust JWT/cache deletion is performed.
- [ ] No rollback, reverse migration, dual-write, or Rust modification was introduced.
