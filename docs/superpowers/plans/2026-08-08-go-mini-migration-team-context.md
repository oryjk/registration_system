# Go Mini Migration And Team Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add traceable, idempotent legacy-data mapping and reconciliation, then expose and consume privacy-scoped team details and member identity for the mini program.

**Architecture:** A migration-only mapping table and shared fingerprint package sit outside business domains. Existing team and match importers keep their source adapters and target transactions but resolve every legacy entity through stable mappings, canonical fingerprints, and explicit incremental/full modes. The team module exposes separate app read models guarded by active membership, and the mini session/page layer consumes those DTOs without restoring unsupported team-management behavior.

**Tech Stack:** Go 1.26.5, pgx, PostgreSQL, MySQL read source, SHA-256 canonical JSON, uni-app, Vue 3, TypeScript, Vite, Bun.

## Global Constraints

- Plan 1 must be complete: `/api/v1/app`, active-user authentication, Go envelope parsing, and `/teams/my` session bootstrap are prerequisites.
- Legacy MySQL and Rust PostgreSQL sources are strictly read-only; all mappings and writes occur only in the Go PostgreSQL database.
- Reuse `cmd/importlegacyteams`, `cmd/importlegacymatches`, `internal/migration/legacyteams`, and `internal/migration/legacymatches`; do not create a second generic migration framework.
- Modes are exactly `--dry-run`, `--mode=incremental` (default), and `--mode=full`; full means idempotent upsert, never truncate or destructive replacement.
- Mapping source systems are fixed constants `legacy_mysql` and `legacy_postgres`; callers cannot supply arbitrary source names.
- Mapping priority is existing mapping, version-controlled explicit ID mapping, then deterministic unique match; lower priority never overwrites a higher-priority mapping.
- Fingerprint version is `1`; canonical JSON sorts field names, applies field-specific trim, uses UTC RFC3339Nano, writes null as JSON `null`, and hashes with lowercase SHA-256 hex.
- Existing mapping plus unchanged source/target skips; source-only change updates; target-only change reports `target_modified`; both changed reports conflict and rolls back the domain transaction.
- MySQL and PostgreSQL legacy users map independently by unique non-empty OpenID to the same Go `users.id`; never use a MySQL user ID as a PostgreSQL registration user ID.
- `legacy_import_mappings` is migration infrastructure only and is never exposed through app/admin APIs or business domain types.
- Preserve existing dry-run rollback, `VITE_USE_MOCK`, and all user-created Go entities without a legacy mapping.
- Do not modify `registration_system_rs/` or delete/mutate its database data.

---

## File Structure

- `registration_system_go/db/migrations/00005_legacy_import_mappings.sql`: migration-only mapping schema and indexes.
- `registration_system_go/internal/migration/mapping/`: mapping model, canonical fingerprinting, target store, resolution and conflict outcomes.
- `registration_system_go/internal/migration/legacyteams/`: MySQL users/teams/members importer using mapping ownership.
- `registration_system_go/internal/migration/legacymatches/`: PostgreSQL users/matches/registrations importer and terminal-state tracking.
- `registration_system_go/config/legacy-import-mappings.json`: version-controlled, non-sensitive explicit source-ID mappings.
- `registration_system_go/internal/team/application/app_query_service.go`: app membership authorization and privacy-scoped queries.
- `registration_system_go/internal/team/adapters/http/app_handler.go`: app-only detail/member DTOs.
- `registration_system_mini/src/api/team.ts`: atomic app team requests.
- `registration_system_mini/src/pages/teams/`: team tab orchestration, state conversion, and focused components.

### Task 1: Add the legacy mapping schema and canonical fingerprint package

**Files:**
- Create: `registration_system_go/db/migrations/00005_legacy_import_mappings.sql`
- Create: `registration_system_go/internal/migration/mapping/model.go`
- Create: `registration_system_go/internal/migration/mapping/fingerprint.go`
- Create: `registration_system_go/internal/migration/mapping/fingerprint_test.go`

**Interfaces:**
- Consumes: migration field projections only; no domain objects or HTTP types.
- Produces: `mapping.Record`, `mapping.EntityKey`, `mapping.CanonicalFingerprint(fields map[string]any) (string, error)`, source constants, entity constants, and `FingerprintVersion = 1`.

- [ ] **Step 1: Write fixed fingerprint test vectors**

Cover key ordering, null, strings, integers, booleans, UTC timestamps, and deterministic repeat output:

```go
func TestCanonicalFingerprintVersionOne(t *testing.T) {
    value := map[string]any{
        "updated_at": time.Date(2026, 8, 8, 8, 9, 10, 123, time.FixedZone("CST", 8*3600)),
        "name": "王睿", "description": nil, "active": true,
    }
    canonical, digest, err := mapping.CanonicalJSONAndFingerprint(value)
    if err != nil { t.Fatal(err) }
    const wantJSON = `{"active":true,"description":null,"name":"王睿","updated_at":"2026-08-08T00:09:10.000000123Z"}`
    const wantSHA256 = "6acd25b01fcf710f51baf2d49a774b1557fe2b6dc06d0b5e6f52a6b5a78ab366"
    if string(canonical) != wantJSON || digest != wantSHA256 { t.Fatalf("json=%s digest=%s", canonical, digest) }
}
```

Independently verify the literal with `printf %s '{"active":true,"description":null,"name":"王睿","updated_at":"2026-08-08T00:09:10.000000123Z"}' | shasum -a 256`. The implementation must not derive the expected digest at runtime.

- [ ] **Step 2: Run the package test and verify it fails**

Run: `cd registration_system_go && go test ./internal/migration/mapping`

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Add mapping schema with immutable ownership key**

Create:

```sql
CREATE TABLE legacy_import_mappings (
    source_system TEXT NOT NULL CHECK (source_system IN ('legacy_mysql', 'legacy_postgres')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'team', 'membership', 'match', 'registration')),
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    source_updated_at TIMESTAMPTZ,
    source_fingerprint TEXT NOT NULL CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'),
    target_fingerprint TEXT NOT NULL CHECK (target_fingerprint ~ '^[0-9a-f]{64}$'),
    fingerprint_version INTEGER NOT NULL DEFAULT 1 CHECK (fingerprint_version > 0),
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_system, entity_type, source_id)
);
CREATE INDEX legacy_import_mappings_target_idx
    ON legacy_import_mappings (entity_type, target_id);
```

Do not add foreign keys from this table to business tables because `target_id` can hold BIGINT or UUID text.

- [ ] **Step 4: Implement restricted keys and canonical serialization**

Use typed constants:

```go
const FingerprintVersion = 1
const (SourceLegacyMySQL SourceSystem = "legacy_mysql"; SourceLegacyPostgres SourceSystem = "legacy_postgres")
const (EntityUser EntityType = "user"; EntityTeam EntityType = "team"; EntityMembership EntityType = "membership"; EntityMatch EntityType = "match"; EntityRegistration EntityType = "registration")
```

Reject unsupported map value types; normalize `time.Time` to UTC RFC3339Nano; use `encoding/json` after sorting keys explicitly. Trimming belongs in each importer projection, not in the generic fingerprint function.

- [ ] **Step 5: Verify migration and package**

Run: `cd registration_system_go && gofmt -w internal/migration/mapping && go test ./internal/migration/mapping && go test ./internal/testsupport -run TestMigrations`

Expected: PASS; a test database applies migration `00005` cleanly.

- [ ] **Step 6: Commit mapping foundations**

```bash
git add registration_system_go/db/migrations/00005_legacy_import_mappings.sql registration_system_go/internal/migration/mapping
git commit -m "feat(go): add legacy import mapping foundation"
```

### Task 2: Implement mapping resolution, conflict classification, and explicit overrides

**Files:**
- Create: `registration_system_go/internal/migration/mapping/store.go`
- Create: `registration_system_go/internal/migration/mapping/store_test.go`
- Create: `registration_system_go/internal/migration/mapping/resolver.go`
- Create: `registration_system_go/internal/migration/mapping/resolver_test.go`
- Create: `registration_system_go/internal/migration/mapping/config.go`
- Create: `registration_system_go/internal/migration/mapping/config_test.go`
- Create: `registration_system_go/config/legacy-import-mappings.json`

**Interfaces:**
- Consumes: a caller-owned `pgx.Tx`, exact `EntityKey`, current source fingerprint, and target fingerprint loader.
- Produces: `Store.Find`, `Store.Upsert`, `Resolver.Resolve`, and `Decision{Action, TargetID, Reason}` where actions are `insert`, `update`, `skip`, `target_modified`, or `conflict`.

- [ ] **Step 1: Write the decision matrix tests**

Test all four double-fingerprint outcomes and version mismatch:

```go
tests := []struct{ sourceChanged, targetChanged bool; want mapping.Action }{
    {false, false, mapping.ActionSkip},
    {true, false, mapping.ActionUpdate},
    {false, true, mapping.ActionTargetModified},
    {true, true, mapping.ActionConflict},
}
```

Also prove an existing mapping with a missing target is a conflict, an override cannot replace an existing different target, a deterministic match must be exactly one target, and lower-priority resolution cannot write over higher-priority state.

- [ ] **Step 2: Run tests and verify missing implementation fails**

Run: `cd registration_system_go && go test ./internal/migration/mapping`

Expected: FAIL on undefined store/resolver/config types.

- [ ] **Step 3: Implement transaction-scoped mapping storage**

Define:

```go
type Store struct { tx pgx.Tx }
func NewStore(tx pgx.Tx) Store
func (s Store) Find(ctx context.Context, key EntityKey) (Record, bool, error)
func (s Store) Upsert(ctx context.Context, record Record) error
func (s Store) ListOwnedTargetIDs(ctx context.Context, source SourceSystem, entity EntityType) ([]string, error)
```

`Upsert` may refresh fingerprints/timestamps for the same target, but returns `ErrMappingConflict` when the key already points elsewhere.

- [ ] **Step 4: Implement a non-sensitive explicit mapping file**

Use version-controlled JSON containing only legacy and target IDs. Seed the already audited team mapping used by the existing importer command; leave other sections empty until a reconciliation report identifies a specific audited mapping:

```json
{
  "legacy_mysql": {
    "users": {},
    "teams": { "1": "11" }
  },
  "legacy_postgres": {
    "users": {},
    "matches": {}
  }
}
```

Reject unknown sections, empty/non-positive BIGINT IDs, invalid UUID target IDs, duplicate source keys, and any field resembling `openid`, `phone`, `token`, `url`, or `password`.

- [ ] **Step 5: Verify and commit resolver behavior**

Run: `cd registration_system_go && gofmt -w internal/migration/mapping && go test ./internal/migration/mapping`

Expected: PASS.

```bash
git add registration_system_go/internal/migration/mapping registration_system_go/config/legacy-import-mappings.json
git commit -m "feat(go): resolve legacy mappings safely"
```

### Task 3: Upgrade the legacy team importer to mapped incremental/full reconciliation

**Files:**
- Modify: `registration_system_go/internal/migration/legacyteams/model.go`
- Modify: `registration_system_go/internal/migration/legacyteams/mysql_source.go`
- Modify: `registration_system_go/internal/migration/legacyteams/importer.go`
- Modify: `registration_system_go/internal/migration/legacyteams/importer_test.go`
- Modify: `registration_system_go/cmd/importlegacyteams/main.go`

**Interfaces:**
- Consumes: `mapping.Store`, MySQL snapshot with stable source IDs and `UpdatedAt`, optional explicit mappings, and `RunOptions`.
- Produces: `Importer.Run(ctx, RunOptions) (Report, error)` with per-entity created/updated/skipped/target-modified/conflict/unmapped counts.

- [ ] **Step 1: Define execution types and write failing reconciliation tests**

Add:

```go
type Mode string
const (ModeIncremental Mode = "incremental"; ModeFull Mode = "full")
type RunOptions struct { DryRun bool; Mode Mode; Explicit mapping.Config }
type EntityReport struct { Source, Inserted, Updated, Skipped, TargetModified, Conflicts, Unmapped int }
type Report struct { Users, Teams, Memberships EntityReport; InactivatedMemberships int }
```

Tests must cover first import, identical rerun -> all skipped, source-only update, target-only edit preserved, double edit rollback, explicit user/team mapping, duplicate OpenID abort, deterministic team matching, mapping/business write rollback together, dry-run rollback, and full-only inactivation of missing source-owned membership.

- [ ] **Step 2: Run importer tests and confirm the old signature fails**

Run: `cd registration_system_go && go test ./internal/migration/legacyteams`

Expected: FAIL because `RunOptions`, mappings, fingerprints, and ownership rules do not exist.

- [ ] **Step 3: Enrich source projections without source writes**

Ensure models include stable IDs:

```go
type LegacyUser struct { SourceID int64; OpenID string; Nickname string; AvatarURL *string; RealName *string; PhoneNumber *string; Status int; UpdatedAt time.Time }
type LegacyTeam struct { SourceID int64; Name string; CaptainSourceID *int64; Description *string; LogoURL *string; Status int; UpdatedAt time.Time }
type LegacyMembership struct { TeamSourceID, UserSourceID int64; Role string; Status int; JoinedAt, UpdatedAt time.Time }
```

Change the source contract to `Load(context.Context, SourceLoadOptions) (Snapshot, error)`, where incremental options carry the last successfully mapped `source_updated_at` per entity type and full mode requests the complete snapshot. The MySQL adapter must execute only `SELECT`; add a fake/spy source test that rejects non-read operations. Normalize source rows before hashing.

Fingerprint fields are fixed for version 1: user `{openid,nickname,avatar_url,real_name,phone_number,status}`, team `{name,description,logo_url,captain_source_id,status}`, and membership `{team_source_id,user_source_id,role,status,joined_at}`. Target fingerprints use the corresponding Go columns after mapping source IDs to target IDs.

- [ ] **Step 4: Resolve users, teams, then memberships inside one target transaction**

Implement exact natural keys:

```text
user: unique normalized non-empty OpenID
team: normalized name + mapped captain + mapped active member set, otherwise explicit mapping required
membership source_id: `{team_source_id}:{user_source_id}`
membership target_id: team_members.id
```

Write the business upsert and `legacy_import_mappings` row in the same `pgx.Tx`. Captain/leader must resolve to an active member in that team or the team domain transaction aborts.

- [ ] **Step 5: Implement authoritative full membership inactivation**

After importing the complete team snapshot in `ModeFull`, compare present source membership keys with `legacy_mysql/membership` mapping rows. Set only missing mapped target relations to `inactive`; leave Go-native rows with no mapping unchanged. Do not physically delete members.

- [ ] **Step 6: Update CLI flags and safe reporting**

Parse:

```go
mode := flag.String("mode", "incremental", "incremental or full")
dryRun := flag.Bool("dry-run", false, "validate and roll back target writes")
mappingFile := flag.String("mapping-file", "config/legacy-import-mappings.json", "non-sensitive explicit ID mapping JSON")
```

Reject other modes. Output counts only; never output OpenID, phone, DSN, or mapping-file contents.

- [ ] **Step 7: Verify and commit team migration**

Run: `cd registration_system_go && gofmt -w internal/migration/legacyteams cmd/importlegacyteams && go test ./internal/migration/legacyteams ./cmd/importlegacyteams && go test ./...`

Expected: PASS.

```bash
git add registration_system_go/internal/migration/legacyteams registration_system_go/cmd/importlegacyteams
git commit -m "feat(go): reconcile legacy teams with stable mappings"
```

### Task 4: Upgrade the legacy match source for PostgreSQL user IDs and terminal-state tracking

**Files:**
- Modify: `registration_system_go/internal/migration/legacymatches/model.go`
- Modify: `registration_system_go/internal/migration/legacymatches/source.go`
- Create: `registration_system_go/internal/migration/legacymatches/source_test.go`

**Interfaces:**
- Consumes: read-only PostgreSQL source and already mapped match source IDs supplied by the importer.
- Produces: `Source.Load(ctx, LoadOptions) (Snapshot, error)` carrying PostgreSQL user primary keys, OpenIDs, match states, and complete in-scope registrations.

- [ ] **Step 1: Write source query tests against a recording DB adapter**

Define:

```go
type LoadOptions struct { Mode Mode; Since *time.Time; TrackedMatchSourceIDs []string }
type LegacyRegistration struct {
    ActivitySourceID string
    UserSourceID int64
    OpenID string
    Stand int
    RegistrationCount int
    UpdatedAt time.Time
}
```

Assert initial discovery includes only status `0/1`, tracked mapped activities are fetched regardless of `2/3`, registrations include `rs_user_info.id` and OpenID, and source access begins a read-only transaction. A filter-excluded activity must not be classified as deleted.

- [ ] **Step 2: Run source tests and verify the current snapshot contract fails**

Run: `cd registration_system_go && go test ./internal/migration/legacymatches -run 'TestPostgresSource'`

Expected: FAIL because source users currently have only OpenID and tracked IDs are not accepted.

- [ ] **Step 3: Implement the read-only source snapshot**

Begin the source transaction with `pgx.TxOptions{AccessMode: pgx.ReadOnly}`. Query all mapped/tracked IDs plus new `0/1` activities. Preserve status `0/1/2/3`, source `updated_at`, registration source identity, and source user ID. Never issue `INSERT`, `UPDATE`, `DELETE`, DDL, or advisory locks against the source.

- [ ] **Step 4: Verify and commit source boundaries**

Run: `cd registration_system_go && gofmt -w internal/migration/legacymatches && go test ./internal/migration/legacymatches -run 'TestPostgresSource'`

Expected: PASS.

```bash
git add registration_system_go/internal/migration/legacymatches/model.go registration_system_go/internal/migration/legacymatches/source.go registration_system_go/internal/migration/legacymatches/source_test.go
git commit -m "feat(go): load tracked legacy match snapshots"
```

### Task 5: Upgrade match and registration import reconciliation

**Files:**
- Modify: `registration_system_go/internal/migration/legacymatches/importer.go`
- Modify: `registration_system_go/internal/migration/legacymatches/importer_test.go`
- Modify: `registration_system_go/cmd/importlegacymatches/main.go`

**Interfaces:**
- Consumes: `mapping.Store`, `RunOptions`, PostgreSQL source users, mapped `legacy_mysql` teams, and explicit mapping config.
- Produces: mapped offline-confirmed matches and host-team registrations with incremental/full/dry-run reports and conflict outcomes.

- [ ] **Step 1: Write failing dual-source and lifecycle tests**

Cover:

```text
legacy_postgres:user `{postgres_user_id}` -> existing Go user by unique OpenID
legacy_postgres:match `{rs_activity.id}` -> Go match UUID
legacy_postgres:registration `{activity_id}:{postgres_user_id}` -> match_registrations UUID
```

Test MySQL user ID differs from PostgreSQL user ID but both map to Go user `37`; no registration key may contain the MySQL ID. Also cover match status `0/1/2/3 -> registering/ongoing/ended/cancelled`, mapped match tracking to terminal state, existing historical match backfill, full-only cancellation of missing mapped registrations, preservation of Go-native registrations, source-only updates, target-only preservation, double-change rollback, dry-run, and idempotent rerun.

- [ ] **Step 2: Run importer tests and verify old natural-key updates fail**

Run: `cd registration_system_go && go test ./internal/migration/legacymatches`

Expected: FAIL because the importer currently matches by name/start/host and lacks stable mapping and conflict behavior.

- [ ] **Step 3: Resolve PostgreSQL users and matches by fixed priority**

For each source user, resolve existing mapping, explicit mapping, then unique normalized OpenID. For a first-time match, use explicit mapping or unique `(mapped host team, exact start_time, normalized name)`; abort zero/ambiguous automatic matches when a new target must not be created under the configured import policy. Existing mappings always win and their target must exist.

Map activity facts only to `offline_confirmed`; keep opponent text/“待定” compatibility and never infer online team/individual modes.

Fingerprint fields are fixed for version 1: PostgreSQL user `{openid,nickname,avatar_url,real_name,phone_number,status}`, match `{name,opposing,status,players_per_team,start_time,end_time,location,latitude,longitude,description,home_team_source_id}`, and registration `{activity_source_id,user_source_id,stand,registration_count,operation_time}`. Target fingerprints use the matching Go user/Match/registration columns and mapped target IDs.

- [ ] **Step 4: Reconcile registrations and full-snapshot disappearance**

Use source key `{activity_source_id}:{postgres_user_source_id}`. Resolve the mapped match host group and mapped user. Store the target registration UUID. In authoritative full mode, set missing source-owned registration rows to `cancelled` and `cancelled_at=NOW()`; do not touch unmapped Go-native rows or rows omitted only by a range filter.

- [ ] **Step 5: Update CLI options and remove identity assumptions**

Keep `--host-team-id`, `--captain-user-id`, and `--legacy-team-id` only as explicit audited bootstrap inputs where mappings do not yet establish them; validate that they agree with existing mappings. Add `--mode` and `--mapping-file`. The report includes source, inserted, updated, skipped, target-modified, conflicts, unmapped, orphan references, and post-write count differences.

- [ ] **Step 6: Verify and commit match migration**

Run: `cd registration_system_go && gofmt -w internal/migration/legacymatches cmd/importlegacymatches && go test ./internal/migration/legacymatches ./cmd/importlegacymatches && go test -race ./internal/migration/...`

Expected: PASS.

```bash
git add registration_system_go/internal/migration/legacymatches registration_system_go/cmd/importlegacymatches
git commit -m "feat(go): reconcile legacy matches and registrations"
```

### Task 6: Add privacy-scoped app team detail and members APIs

**Files:**
- Create: `registration_system_go/internal/team/application/app_query_service.go`
- Create: `registration_system_go/internal/team/application/app_query_service_test.go`
- Create: `registration_system_go/internal/team/adapters/http/app_handler.go`
- Create: `registration_system_go/internal/team/adapters/http/app_handler_test.go`
- Modify: `registration_system_go/internal/team/ports/repository.go`
- Modify: `registration_system_go/internal/team/adapters/postgres/repository.go`
- Modify: `registration_system_go/db/queries/team.sql`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`

**Interfaces:**
- Consumes: authenticated active user and existing team/member repository facts.
- Produces: `GET /api/v1/app/teams/:id` as `AppTeamDetail` and `GET /api/v1/app/teams/:id/members` as `AppTeamMember[]`; both require active membership.

- [ ] **Step 1: Write application authorization and privacy tests**

Define:

```go
type AppTeamDetail struct { Team domain.Team; MyRole domain.Role }
type AppTeamMember struct { UserID int64; Nickname string; AvatarURL *string; RealName *string; Role domain.Role; Status domain.MemberStatus; JoinedAt time.Time }
type AppQueryService interface {
    GetTeam(context.Context, sharedauth.Actor, int64) (AppTeamDetail, error)
    ListMembers(context.Context, sharedauth.Actor, int64) ([]AppTeamMember, error)
}
```

Test active member success, inactive/non-member `403`, nonexistent team `404`, frozen team not exposed as active context, and returned members omit phone/OpenID/member-row ID.

- [ ] **Step 2: Run team tests and confirm app service is missing**

Run: `cd registration_system_go && go test ./internal/team/...`

Expected: FAIL on missing app query service and handlers.

- [ ] **Step 3: Implement membership-scoped queries**

Add repository methods that fetch the requester membership and privacy projection. Do not reuse admin `MemberDetails` at the HTTP boundary because it includes `PhoneNumber` and `Member.ID`. Keep authorization in application, not handler.

- [ ] **Step 4: Implement exact app DTOs and routes**

Use:

```go
type AppTeamDetailResponse struct {
    ID int64 `json:"id"`; Name string `json:"name"`; Description *string `json:"description"`; LogoURL *string `json:"logo_url"`
    CaptainID *int64 `json:"captain_id"`; Status domain.TeamStatus `json:"status"`; MyRole domain.Role `json:"my_role"`
}
type AppTeamMemberResponse struct {
    UserID int64 `json:"user_id"`; Nickname string `json:"nickname"`; AvatarURL *string `json:"avatar_url"`; RealName *string `json:"real_name"`
    Role domain.Role `json:"role"`; Status domain.MemberStatus `json:"status"`; JoinedAt time.Time `json:"joined_at"`
}
```

Register only on the protected app group; do not change admin member DTOs.

- [ ] **Step 5: Generate, verify, and commit**

Run: `cd registration_system_go && sqlc generate && gofmt -w internal/team internal/bootstrap && go test ./internal/team/... ./internal/bootstrap && go test ./...`

Expected: PASS.

```bash
git add registration_system_go/db/queries/team.sql registration_system_go/internal/team registration_system_go/internal/bootstrap
git commit -m "feat(go): expose app team context"
```

### Task 7: Adapt mini team identity state and the Team tab

**Files:**
- Modify: `registration_system_mini/src/types/app.ts`
- Modify: `registration_system_mini/src/api/team.ts`
- Modify: `registration_system_mini/src/stores/appSession.ts`
- Modify: `registration_system_mini/src/stores/currentIdentity.ts`
- Modify: `registration_system_mini/src/stores/__tests__/appSession.test.ts`
- Modify: `registration_system_mini/src/stores/__tests__/currentIdentity.test.ts`
- Create: `registration_system_mini/src/pages/teams/teamContextState.ts`
- Create: `registration_system_mini/src/pages/teams/components/TeamProfileSummary.vue`
- Create: `registration_system_mini/src/pages/teams/components/TeamMemberList.vue`
- Modify: `registration_system_mini/src/pages/teams/index.vue`
- Modify: `registration_system_mini/src/mock/handlers.ts`
- Modify: `registration_system_mini/src/mock/data/` team fixtures

**Interfaces:**
- Consumes: `MyTeam[]`, `AppTeamDetail`, and `AppTeamMember[]` from app APIs.
- Produces: selected personal/team identity, lazy team detail/member loading, and a read-only Team tab with empty state.

- [ ] **Step 1: Add frontend types and focused state tests**

Define exact DTOs matching Task 6 and test:

```ts
export interface AppTeamDetail { id: number; name: string; description: string | null; logo_url: string | null; captain_id: number | null; status: "active" | "frozen"; my_role: MyTeamRole }
export interface AppTeamMember { user_id: number; nickname: string; avatar_url: string | null; real_name: string | null; role: MyTeamRole; status: "active" | "inactive"; joined_at: string }
```

Tests cover cached selected team still present, missing cached team -> personal identity or first valid team, no teams -> personal identity, role comes from backend, details loaded once per selected team, and `403` removes stale team context after `/teams/my` refresh.

Replace the legacy identity union with `type CurrentIdentityKind = "personal" | "team"`. Treat any cached `{ kind: "venue" }` value from the Rust version as personal identity during storage restore, then persist the new shape; never expose `venue` as a selectable app identity.

- [ ] **Step 2: Run focused tests and confirm old Rust team shapes fail**

Run: `cd registration_system_mini && bun test src/stores/__tests__/appSession.test.ts src/stores/__tests__/currentIdentity.test.ts`

Expected: FAIL because current state depends on `BackendTeamDetail` and management-oriented fields.

- [ ] **Step 3: Implement atomic team API functions**

Keep only first-stage app reads in the live Go path:

```ts
export const getMyTeams = () => requestApi<MyTeam[]>({ url: "/teams/my", auth: true });
export const getTeamDetail = (teamId: number) => requestApi<AppTeamDetail>({ url: `/teams/${teamId}`, auth: true });
export const getTeamMembers = (teamId: number) => requestApi<AppTeamMember[]>({ url: `/teams/${teamId}/members`, auth: true });
```

Do not expose create/join/update/member-write/attendance/credit functions to newly converted pages.

- [ ] **Step 4: Build a read-only Team tab by responsibility**

`index.vue` owns lifecycle, loading/error state, selected team, and child events. `teamContextState.ts` maps RFC3339 dates/roles to display labels. `TeamProfileSummary.vue` and `TeamMemberList.vue` are presentation-only and emit no write operations. No-team state links only to supported app tabs; remove team management, attendance, points, and recharge entry points.

- [ ] **Step 5: Adapt mock data to the real contract**

Provide at least user `37` as captain, one regular member, and a no-team user. Return `403` for a user requesting a team they do not belong to. Mock DTOs must omit phone/OpenID/member-row IDs.

- [ ] **Step 6: Verify and commit mini team context**

Run: `cd registration_system_mini && bun test src/stores/__tests__/appSession.test.ts src/stores/__tests__/currentIdentity.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5 && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin`

Expected: PASS.

```bash
git add registration_system_mini/src/types/app.ts registration_system_mini/src/api/team.ts registration_system_mini/src/stores registration_system_mini/src/pages/teams registration_system_mini/src/mock
git commit -m "feat(mini): show Go team identity context"
```

### Task 8: Execute migration rehearsal and reconciliation gates

**Files:**
- Create: `docs/runbooks/go-legacy-incremental-migration.md`
- Modify: `registration_system_go/README.md`

**Interfaces:**
- Consumes: both enhanced import commands, read-only source credentials, Go target credentials, and optional audited mapping JSON.
- Produces: repeatable dry-run/formal/re-dry-run evidence without changing the Rust/legacy sources.

- [ ] **Step 1: Document the exact safe execution sequence**

The runbook must use non-secret example paths and this order:

```bash
go run ./cmd/importlegacyteams --mode=incremental --dry-run --mapping-file=config/legacy-import-mappings.json
go run ./cmd/importlegacyteams --mode=incremental --mapping-file=config/legacy-import-mappings.json
go run ./cmd/importlegacyteams --mode=incremental --dry-run --mapping-file=config/legacy-import-mappings.json

go run ./cmd/importlegacymatches --mode=incremental --dry-run --mapping-file=config/legacy-import-mappings.json --host-team-id=11 --captain-user-id=37 --legacy-team-id=1
go run ./cmd/importlegacymatches --mode=incremental --mapping-file=config/legacy-import-mappings.json --host-team-id=11 --captain-user-id=37 --legacy-team-id=1
go run ./cmd/importlegacymatches --mode=incremental --dry-run --mapping-file=config/legacy-import-mappings.json --host-team-id=11 --captain-user-id=37 --legacy-team-id=1
```

Explain when `--mode=full` is allowed for authoritative membership/registration reconciliation and that it never deletes business rows.

- [ ] **Step 2: Add source read-only preflight and target postflight queries**

Document how to verify the PostgreSQL source transaction is read-only and the source account has no writes; for MySQL, require a read-only account. Provide target-only count queries for mapping totals and orphan target IDs. Queries and reports must not select OpenID, phone, or secrets.

- [ ] **Step 3: Run automated migration and app-team gates**

Run:

```bash
cd registration_system_go
gofmt -w .
go test -race ./internal/migration/... ./internal/team/... ./internal/bootstrap
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
go build -o /tmp/importlegacyteams ./cmd/importlegacyteams
go build -o /tmp/importlegacymatches ./cmd/importlegacymatches

cd ../registration_system_mini
bun run type-check
VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5
VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin
```

Expected: all commands exit `0`.

- [ ] **Step 4: Rehearse against a disposable Go target**

Using production-like read-only source accounts and a disposable target copy, run team then match dry-runs, formal imports, and repeat dry-runs. Require zero unexplained conflicts, zero orphan references, second dry-run zero inserts/updates, user `37` mapping from both source systems to the same Go ID, memberships/roles matching source facts, and mapped statuses continuing to `ended/cancelled`.

- [ ] **Step 5: Commit the migration runbook**

```bash
git add docs/runbooks/go-legacy-incremental-migration.md registration_system_go/README.md
git commit -m "docs: add legacy migration reconciliation runbook"
```

## Plan Completion Gate

- [ ] Existing partially migrated rows have stable mappings or an explicit audited conflict; reruns are idempotent.
- [ ] MySQL and PostgreSQL source-user ID spaces remain distinct and converge only through unique OpenID to Go user IDs.
- [ ] Full mode inactivates/cancels only source-owned mapped relationships and never deletes Go-native data.
- [ ] Rust/legacy data sources were read only and received no code/schema/data changes.
- [ ] App team details/members enforce active membership and expose no phone, OpenID, or `team_members.id`.
- [ ] User `37`, a regular member, and a no-team user pass Team-tab acceptance.
- [ ] All required Go and mini commands pass before Plan 3 begins.
