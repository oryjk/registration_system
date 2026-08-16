# Match Registration Window Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and consistently enforce match registration windows across Go, the mini app, and the Go admin console.

**Architecture:** Put validation and time-window policy in the Go match domain, call it from user-facing application services, and keep frontend logic limited to transport and presentation. Preserve nullable legacy bounds at every adapter boundary.

**Tech Stack:** Go 1.26.5, Gin, PostgreSQL/pgx/sqlc, React/TypeScript/Ant Design 6, uni-app/Vue 3/TypeScript, Bun.

## Global Constraints

- Do not modify the frozen Rust backend or legacy Vue admin.
- Follow TDD for Go behavior and focused behavior tests for frontend shared logic.
- Keep legacy partial registration bounds readable and enforce every configured bound independently.
- Do not introduce new dependencies.
- Changing the match start time in the Go admin form intentionally resets the registration deadline to two hours before the new start, in create and edit flows.
- The Go admin form uses minute precision for match time; preserving seconds or milliseconds is outside the form contract.

---

### Task 1: Match Domain Window Policy

**Files:**
- Modify: `registration_system_go/internal/match/domain/match.go`
- Test: `registration_system_go/internal/match/domain/match_test.go`

**Interfaces:**
- Produces: `func (m Match) RegistrationOpenAt(now time.Time) bool`
- Produces: `NewMatch` and `UpdateDetails` preserving validated nullable bounds.

- [x] Add failing tests for constructor preservation, invalid ordering, partial bounds, and exact start/end boundaries.
- [x] Run `go test ./internal/match/domain -run 'Test(NewMatchRegistrationWindow|MatchRegistrationOpenAt)'` and confirm behavior failures.
- [x] Assign both bounds in `NewMatch`, pass them into update validation, validate ordering, and implement `RegistrationOpenAt`.
- [x] Re-run the focused tests and the full domain package.

### Task 2: Application Enforcement

**Files:**
- Modify: `registration_system_go/internal/match/application/user_registration_service.go`
- Modify: `registration_system_go/internal/match/application/team_application_service.go`
- Test: `registration_system_go/internal/match/application/user_registration_service_test.go`
- Test: `registration_system_go/internal/match/application/team_application_service_test.go`

**Interfaces:**
- Consumes: `domain.Match.RegistrationOpenAt(time.Time) bool`
- Produces: conflict errors for user mutations outside configured bounds.

- [x] Add failing table tests for registration put/delete and team apply/withdraw before and after the window.
- [x] Run focused application tests and confirm they fail because no window guard exists.
- [x] Guard user registration mutations and pending team application submission/withdrawal with the domain policy.
- [x] Keep admin selection and selected-opponent rollback available after the deadline.
- [x] Re-run focused and full application tests.

### Task 3: Go Admin Update Contract

**Files:**
- Modify: `registration_system_go/internal/match/adapters/http/admin_handler.go`
- Modify: `registration_system_go/internal/match/application/admin_service.go`
- Test: `registration_system_go/internal/match/adapters/http/admin_handler_test.go`
- Test: `registration_system_go/internal/match/application/admin_service_test.go`

**Interfaces:**
- Produces: three-state optional timestamp updates: omitted preserves, `null` clears, and a value replaces.
- Consumes: the match domain's nullable registration-window validation.

- [x] Add failing handler and service tests for populated, partial, omitted, explicitly cleared, and invalid bounds.
- [x] Implement protocol-level omitted/null/value decoding without moving business validation into the handler.
- [x] Pass optional timestamp commands through the application service and preserve omitted values.
- [x] Run focused handler and application tests.

### Task 4: Go Admin Form

**Files:**
- Modify: `registration_system_backend_fe_go/src/types/match.ts`
- Modify: `registration_system_backend_fe_go/src/utils/match-form-payload.ts`
- Modify: `registration_system_backend_fe_go/src/utils/match-form-payload.test.ts`
- Modify: `registration_system_backend_fe_go/src/pages/MatchFormPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx`

**Interfaces:**
- Produces: `registration_start_at` and `registration_end_at` on match items and create/update payloads.
- Produces: independent optional `registration_start_at` and `registration_end_at` form values mapped to nullable API fields.
- Preserves: product behavior that changing the match start resets the registration deadline to two hours before start.
- Preserves: minute-level match time and duration editing.

- [x] Add failing payload tests for populated and cleared bounds.
- [x] Run the payload test and confirm the new fields are absent.
- [x] Extend types and payload conversion, hydrate two independent fields, render optional `DatePicker` controls, apply the confirmed two-hour default/reset rule, and display the window on detail.
- [x] Run focused tests, TypeScript checks, source-scoped Biome, Ant Design lint, and build.

### Task 5: Mini Shared Window State and Detail Actions

**Files:**
- Add: `registration_system_mini/src/utils/registrationWindow.ts`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`
- Modify: `registration_system_mini/src/pages/matches/detailState.ts`
- Modify: `registration_system_mini/src/pages/matches/useMatchRegistration.ts`
- Test: `registration_system_mini/src/pages/__tests__/matchDetailRegistrationDesign.test.ts`
- Test: `registration_system_mini/src/pages/matches/__tests__/detailState.test.ts`

**Interfaces:**
- Produces: shared half-open `not_started`, `open`, and `closed` resolver.
- Produces: pre-open/closed presentation, countdown target selection, and action-level guards for user registration.

- [x] Add failing tests for exact boundaries, nullable bounds, pre-open presentation, and guarded registration actions.
- [x] Run focused Bun tests and confirm expected failures.
- [x] Implement the shared resolver and make detail presentation and mutation actions consume it.
- [x] Re-run focused tests.

### Task 6: Mini Hall, Team Application, and Mock Fidelity

**Files:**
- Modify: `registration_system_mini/src/pages/activities/hallMatchState.ts`
- Modify: `registration_system_mini/src/pages/activities/useHallPage.ts`
- Modify: `registration_system_mini/src/pages/activities/index.vue`
- Modify: `registration_system_mini/src/pages/matches/apply-team/useApplyTeamPage.ts`
- Modify: `registration_system_mini/src/pages/matches/apply-team/index.vue`
- Modify: `registration_system_mini/src/pages/matches/apply-team/components/ApplyTeamStatusCard.vue`
- Modify: `registration_system_mini/src/mock/data/matches.ts`
- Modify: `registration_system_mini/src/mock/handlers.ts`
- Test: `registration_system_mini/src/pages/activities/__tests__/hallMatchState.test.ts`
- Test: `registration_system_mini/src/pages/activities/__tests__/useHallPage.test.ts`
- Test: `registration_system_mini/src/api/__tests__/matchApi.test.ts`

**Interfaces:**
- Produces: hall CTAs that degrade to detail-only outside the window and update reactively at time boundaries.
- Produces: team application submission and pending withdrawal guards while leaving selected rollback unrestricted.
- Produces: mock match summaries that echo submitted bounds and mock mutations that evaluate one captured clock value.

- [x] Add failing tests for hall actions, reactive boundary updates, mock timestamp preservation, mutation guards, and single-clock evaluation.
- [x] Pass the reactive hall clock into card mapping and clean its timer up on page hide/unload.
- [x] Gate team application submission and pending withdrawal, while retaining existing application visibility and selected rollback.
- [x] Preserve and enforce mock bounds with one clock read per operation.
- [x] Run focused mini tests.

### Task 7: Full Verification

**Files:**
- Verify all files above; no additional production files expected.

- [x] Run `gofmt -w` on changed Go files.
- [x] Run `go test -race ./...`, `go vet ./...`, and build `./cmd/api`.
- [x] Run mini type-check, all tests, and `build:mp-weixin`.
- [x] Run admin tests, type-check, source-scoped Biome, Ant Design lint, and build.
- [x] Run `git diff --check` and inspect the final diff for unrelated changes.

Verification note: repository-wide `bun run lint` is blocked only by formatting in the unrelated untracked file `registration_system_backend_fe_go/scripts/verify-reg-window.mjs`. The tracked `src` tree passes `bunx biome check src`; the unrelated file was preserved unchanged.
