# Go Player Profile and Legacy Team Import Implementation Plan

> **Archive note (2026-08-08):** This plan records the former two-mini-project structure. `registration_system_mini_go/` has been removed; current mini/H5 work belongs in `registration_system_mini/`. Paths below are retained as implementation history, not current instructions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real name and phone number as maintained player profile fields, expose them in team management, and transactionally import the legacy team, users, memberships, and captain.

**Architecture:** The user module owns profile validation and updates; the team module joins profile fields read-only for member workflows. A separate `internal/migration/legacyteams` service reads MySQL and writes PostgreSQL in one transaction, while `cmd/importlegacyteams` handles configuration and dry-run selection.

**Tech Stack:** Go 1.26.5, Gin, PostgreSQL 16, pgx, sqlc, goose, MySQL driver, React 19, TypeScript, Ant Design, Bun.

---

### Task 1: PostgreSQL schema and user domain

**Files:**
- Create: `registration_system_go/db/migrations/00003_user_profile.sql`
- Modify: `registration_system_go/internal/testsupport/schema_test.go`
- Modify: `registration_system_go/internal/user/domain/user.go`
- Create: `registration_system_go/internal/user/domain/user_test.go`

- [x] **Step 1: Write failing schema and domain tests**

Add schema assertions for nullable `users.real_name` and `users.phone_number`. Add domain tests that call `UpdateProfile("  王小明  ", " 13800138000 ")`, expect trimmed pointers, normalize blanks to nil, and reject a 121-rune name or 33-character phone.

- [x] **Step 2: Verify red**

Run: `go test ./internal/user/domain ./internal/testsupport -run 'TestUserProfile|TestUserProfileColumns' -v`

Expected: FAIL because `UpdateProfile` and both columns do not exist.

- [x] **Step 3: Add migration and domain behavior**

Migration up SQL:

```sql
ALTER TABLE users
    ADD COLUMN real_name VARCHAR(120) NULL,
    ADD COLUMN phone_number VARCHAR(32) NULL;
```

Migration down drops both columns. Extend `domain.User` with `RealName *string` and `PhoneNumber *string`; implement trimming, blank-to-nil normalization, and rune-length checks in `UpdateProfile`.

- [x] **Step 4: Verify green**

Run the focused test command and expect PASS.

### Task 2: User persistence and administrator profile API

**Files:**
- Modify: `registration_system_go/db/queries/auth.sql`
- Modify: `registration_system_go/internal/user/ports/repository.go`
- Modify: `registration_system_go/internal/user/adapters/postgres/repository.go`
- Modify: `registration_system_go/internal/user/adapters/postgres/repository_test.go`
- Create: `registration_system_go/internal/user/application/profile_service.go`
- Create: `registration_system_go/internal/user/application/profile_service_test.go`
- Create: `registration_system_go/internal/user/adapters/http/handler.go`
- Create: `registration_system_go/internal/user/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`

- [x] **Step 1: Write failing repository, service, and HTTP tests**

Repository test seeds a user, updates profile, and reads back both fields. Service tests require an admin actor, return not-found for an absent user, and reject overlong values. HTTP test sends:

```json
{"real_name":"王小明","phone_number":"13800138000"}
```

to `PATCH /users/7/profile` and expects both fields in the success envelope.

- [x] **Step 2: Verify red**

Run: `go test ./internal/user/... -run 'Test.*Profile' -v`

Expected: FAIL because repository update, service, and handler are missing.

- [x] **Step 3: Implement persistence and use case**

Select and return `real_name` and `phone_number` from all user queries. Add:

```go
UpdateProfile(context.Context, domain.User) (domain.User, error)
```

The service loads by ID, checks `actor.IsAdmin()`, calls `user.UpdateProfile`, persists, and maps missing users to the shared not-found error.

- [x] **Step 4: Implement HTTP and bootstrap wiring**

Create `PATCH /api/admin/users/:id/profile`, accepting nullable strings and returning `id`, `nickname`, `avatar_url`, `real_name`, `phone_number`, and `status`. Register the handler behind `RequireAdmin()`.

- [x] **Step 5: Generate sqlc and verify green**

Run: `make generate && go test ./internal/user/... ./internal/bootstrap -v`

Expected: PASS.

### Task 3: Login and team member contracts

**Files:**
- Modify: `registration_system_go/internal/auth/adapters/http/handler.go`
- Modify: `registration_system_go/internal/auth/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/team/domain/team.go`
- Modify: `registration_system_go/db/queries/team.sql`
- Modify: `registration_system_go/internal/team/adapters/postgres/repository.go`
- Modify: `registration_system_go/internal/team/adapters/postgres/repository_test.go`
- Modify: `registration_system_go/internal/team/adapters/http/member_handler.go`
- Modify: `registration_system_go/internal/team/adapters/http/member_handler_test.go`
- Modify: generated sqlc files under `registration_system_go/internal/auth/adapters/postgres/sqlc/` and `internal/team/adapters/postgres/sqlc/`
- Modify: `registration_system_mini_go/src/types/api.ts`

- [x] **Step 1: Write failing contract tests**

Assert login JSON, member JSON, and candidate JSON contain `real_name` and `phone_number`. Extend the PostgreSQL member test to search a candidate once by real name and once by phone.

- [x] **Step 2: Verify red**

Run: `go test ./internal/auth/adapters/http ./internal/team/adapters/http ./internal/team/adapters/postgres -run 'Test.*(Login|Member|Candidate)' -v`

Expected: FAIL because the fields and search predicates are absent.

- [x] **Step 3: Implement contract changes**

Add profile pointers to `MemberDetails` and `MemberCandidate`, select them in team queries, and expand candidate filtering with:

```sql
OR u.real_name ILIKE '%' || sqlc.arg('search')::text || '%'
OR u.phone_number ILIKE '%' || sqlc.arg('search')::text || '%'
```

Map fields through repository and HTTP response DTOs. Add the same nullable fields to login response and the mini-program `User` type.

- [x] **Step 4: Generate and verify green**

Run: `make generate && go test ./internal/auth/... ./internal/team/... -v`

Expected: PASS.

### Task 4: Go admin profile display and editing

**Files:**
- Modify: `registration_system_backend_fe_go/src/types/team.ts`
- Modify: `registration_system_backend_fe_go/src/api/teams.ts`
- Modify: `registration_system_backend_fe_go/src/components/TeamMemberManager.tsx`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

- [x] **Step 1: Extend types and API client**

Add nullable `real_name` and `phone_number` to member and candidate types. Add:

```ts
updatePlayerProfile(userID, { real_name, phone_number })
```

which calls `PATCH /users/${userID}/profile`.

- [x] **Step 2: Update the member UI**

Prefer real name as the primary label, keep nickname and user ID as secondary context, show phone when present, and change candidate placeholder to “输入姓名、昵称、手机号或用户 ID”. Add real-name and phone inputs to the existing edit modal; submit profile first and membership second, retaining a clear error if either request fails.

- [x] **Step 3: Extend E2E fixtures and assertions**

Mock enriched member/profile responses, edit one member, and assert the profile PATCH payload and rendered real name/phone.

- [x] **Step 4: Verify frontend**

Run: `bun run type-check && bun run lint && bun run build`

Expected: all commands exit 0.

### Task 5: Transactional legacy importer

**Files:**
- Create: `registration_system_go/internal/migration/legacyteams/model.go`
- Create: `registration_system_go/internal/migration/legacyteams/importer.go`
- Create: `registration_system_go/internal/migration/legacyteams/importer_test.go`
- Create: `registration_system_go/cmd/importlegacyteams/main.go`
- Modify: `registration_system_go/go.mod`
- Modify: `registration_system_go/go.sum`
- Modify: `registration_system_go/.env.example`
- Modify: `registration_system_go/README.md`

- [x] **Step 1: Write failing mapping and import tests**

Test role/status mappings, nil phone normalization, exact-name duplicate rejection, idempotent upserts, membership state, and captain assignment. Use test PostgreSQL and a fake source port so tests never contact the real MySQL.

- [x] **Step 2: Verify red**

Run: `go test ./internal/migration/legacyteams -v`

Expected: FAIL because importer types do not exist.

- [x] **Step 3: Implement source and transactional target**

Use `github.com/go-sql-driver/mysql` for read-only source queries and pgx for target writes. Match users by openid, require at most one exact-name target team, upsert memberships by `(team_id,user_id)`, then update `captain_id`. Return only aggregate counts:

```go
type Report struct {
    UsersInserted, UsersUpdated int
    TeamsInserted, TeamsUpdated int
    MembershipsInserted, MembershipsUpdated int
}
```

Rollback dry-run and all failures; commit only a successful non-dry run.

- [x] **Step 4: Add command configuration and docs**

Require `LEGACY_MYSQL_HOST`, `LEGACY_MYSQL_PORT`, `LEGACY_MYSQL_USER`, `LEGACY_MYSQL_PASSWORD`, `LEGACY_MYSQL_DATABASE`, and `DATABASE_URL`. Never log DSNs or personal fields. Document `go run ./cmd/importlegacyteams --dry-run` and the non-dry command.

- [x] **Step 5: Verify green**

Run: `go test -race ./internal/migration/legacyteams ./cmd/importlegacyteams -v`

Expected: PASS.

### Task 6: Apply, import, reconcile, and verify

**Files:**
- Modify: `registration_system_go/task_plan.md`
- Modify: `registration_system_go/findings.md`
- Modify: `registration_system_go/progress.md`

- [x] **Step 1: Run complete local verification**

Run: `gofmt -w . && go test -race ./... && go vet ./... && go build -o /tmp/registration-system-go-api ./cmd/api && go build -o /tmp/importlegacyteams ./cmd/importlegacyteams`

Expected: exit 0 with no test failures or vet errors.

- [x] **Step 2: Apply migration 3**

Run: `make migrate-up`, then query goose status and `information_schema.columns` to prove both nullable fields exist.

- [x] **Step 3: Run dry-run**

Provide source credentials only through process environment and run `/tmp/importlegacyteams --dry-run`.

Expected from the current snapshot: 21 users inserted, 1 team inserted, 21 memberships inserted, with no target writes after rollback.

- [x] **Step 4: Recheck target drift and execute import**

Recount target users, teams, and memberships. If counts still match the audited baseline, run `/tmp/importlegacyteams`; otherwise stop and reconcile the reported drift before writing.

- [x] **Step 5: Reconcile post-import state**

Verify without printing PII: target totals, exactly 21 memberships for the imported team, 20 active and 1 inactive membership, role counts of 1 captain/1 vice captain/19 members, non-null captain reference, 21 non-null real names, and 9 non-null phones.

- [x] **Step 6: Update records and final checks**

Mark migration phases complete in the three working files. Run `git diff --check`, inspect `git status`, and report any test or browser verification not run.
