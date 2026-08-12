# Match Publication Mode Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display and create all three Go match publication modes consistently in the React admin and uni-app mini program.

**Architecture:** Keep `publication_mode` as the source of truth from the Go match domain. Add it only to the compact Go home response where it is currently missing, then map the same three values through shared client label helpers into create controls, list tags, and detail metadata. Preserve the existing page structure and all unrelated dirty-worktree changes.

**Tech Stack:** Go 1.26.5, Gin, OpenAPI YAML, React, TypeScript, Umi Max, Ant Design 6, Vue 3, uni-app, Wot UI, Bun.

## Global Constraints

- Canonical values are exactly `offline_confirmed`, `online_team`, and `online_individual`.
- Canonical Chinese labels are exactly `线下已约`, `线上约队`, and `散人对手`.
- Do not modify the Rust backend or add database fields or migrations.
- Unknown read-only values render as `其他类型`; create controls expose only the three canonical values.
- Keep match type next to identity/status metadata, never in registration, check-in, or action areas.
- Preserve existing uncommitted changes and inspect each touched-file diff before verification.
- The mini program must keep H5 and WeChat mini-program compatibility and must not use browser DOM APIs.

---

### Task 1: Add Publication Mode to the Go Home Response

**Files:**
- Modify: `registration_system_go/internal/match/adapters/http/user_handler.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler_test.go`
- Modify: `registration_system_go/docs/openapi.yaml`
- Modify: `registration_system_go/docs/openapi_test.go`

**Interfaces:**
- Consumes: `domain.Match.PublicationMode domain.PublicationMode`.
- Produces: `publication_mode` on both `UserHomeActionMatchResponse` and `UserHomeEndedMatchResponse` JSON objects.

- [ ] **Step 1: Write failing handler assertions**

Extend `TestUserMatchHomeReturnsUserScopedSummary` fixtures so action and ended matches use different publication modes, then require these fragments in the response:

```go
`"publication_mode":"online_team"`
`"publication_mode":"offline_confirmed"`
```

- [ ] **Step 2: Run the focused handler test and confirm failure**

Run: `go test ./internal/match/adapters/http -run TestUserMatchHomeReturnsUserScopedSummary -count=1`

Expected: FAIL because the compact home DTO does not serialize `publication_mode`.

- [ ] **Step 3: Map the domain value into both compact DTOs**

Add the typed field to both response structs:

```go
PublicationMode domain.PublicationMode `json:"publication_mode"`
```

Set `PublicationMode: match.PublicationMode` in both branches of `mapUserHome`.

- [ ] **Step 4: Update and validate the OpenAPI contract**

Add `publication_mode` to the required lists and properties of `UserHomeActionMatch` and `UserHomeEndedMatch`, both referencing `#/components/schemas/PublicationMode`. Extend `docs/openapi_test.go` contract assertions to cover the field where the existing home-schema tests are defined.

- [ ] **Step 5: Run focused Go verification**

Run:

```bash
gofmt -w internal/match/adapters/http/user_handler.go internal/match/adapters/http/user_handler_test.go docs/openapi_test.go
go test ./internal/match/adapters/http ./docs -count=1
```

Expected: PASS.

### Task 2: Refine React Admin Type Presentation

**Files:**
- Modify: `registration_system_backend_fe_go/src/pages/matchLabels.ts`
- Modify: `registration_system_backend_fe_go/src/pages/MatchFormPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx`
- Modify only if needed for existing selectors: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

**Interfaces:**
- Consumes: `PublicationMode` and `MatchItem.publication_mode` from `src/types/match.ts`.
- Produces: `publicationModeLabels`, `publicationModeDescriptions`, and a read-only label helper with the fallback `其他类型`.

- [ ] **Step 1: Add the shared presentation metadata**

Keep the current labels and add descriptions keyed by `PublicationMode`:

```ts
export const publicationModeDescriptions: Record<PublicationMode, string> = {
  offline_confirmed: "已线下确定对手，无需线上招募",
  online_team: "在线招募一支球队作为对手",
  online_individual: "在线招募个人组成对手阵容",
};

export function getPublicationModeLabel(value: string): string {
  return publicationModeLabels[value as PublicationMode] || "其他类型";
}
```

- [ ] **Step 2: Make the create choice explicit**

Rename the form label from `发布模式` to `比赛类型`. Render the three options with label plus description using Ant Design `Select` option labels or `options[].label` content, while preserving `disabled={editing}` and the existing `publication_mode` payload.

- [ ] **Step 3: Put a compact type tag in the list identity cell**

Under the match name, render a small neutral `Tag` containing `getPublicationModeLabel(item.publication_mode)`. Do not add a new column, so narrow screens retain the information.

- [ ] **Step 4: Make type explicit in detail metadata**

Use a `Tag` in `detail-status-line` next to match status, and add a `Descriptions.Item` labeled `比赛类型`. Retain opponent state as secondary text.

- [ ] **Step 5: Run admin checks**

Run:

```bash
bun run type-check
bun run lint
```

Expected: both exit 0. Update the existing E2E selector only if the label change makes its assertion fail; do not add static visual tests.

### Task 3: Establish a Shared Mini-Program Publication Mode Model

**Files:**
- Modify: `registration_system_mini/src/types/match.ts`
- Create: `registration_system_mini/src/utils/matchPublicationMode.ts`
- Create: `registration_system_mini/src/utils/__tests__/matchPublicationMode.test.ts`

**Interfaces:**
- Produces: `AppMatchPublicationMode`, `MATCH_PUBLICATION_MODE_OPTIONS`, and `getMatchPublicationModeLabel(value: string): string`.
- Consumed by: create payload, home/user view models, and detail UI in later tasks.

- [ ] **Step 1: Write the failing mapping test**

```ts
expect(getMatchPublicationModeLabel("offline_confirmed")).toBe("线下已约");
expect(getMatchPublicationModeLabel("online_team")).toBe("线上约队");
expect(getMatchPublicationModeLabel("online_individual")).toBe("散人对手");
expect(getMatchPublicationModeLabel("future_mode")).toBe("其他类型");
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `bun test src/utils/__tests__/matchPublicationMode.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the canonical mini-program type and helper**

Define:

```ts
export type AppMatchPublicationMode =
  | "offline_confirmed"
  | "online_team"
  | "online_individual";
```

Use it for `AppMatchSummary.publication_mode`, and add `publication_mode: AppMatchPublicationMode` to both compact home item interfaces. Export the three create options with `value`, `label`, and `description`.

- [ ] **Step 4: Run the mapping test**

Run: `bun test src/utils/__tests__/matchPublicationMode.test.ts`

Expected: PASS.

### Task 4: Make Mini-Program Match Creation a True Three-Way Choice

**Files:**
- Modify: `registration_system_mini/src/components/matchPublishForm.ts`
- Modify: `registration_system_mini/src/components/MatchPublishForm.vue`
- Modify: `registration_system_mini/src/pages/matches/create/index.vue`
- Modify: `registration_system_mini/src/pages/matches/create/createMatchPayload.ts`
- Modify: `registration_system_mini/src/pages/matches/create/__tests__/createMatchPayload.test.ts`

**Interfaces:**
- Consumes: `AppMatchPublicationMode` and `MATCH_PUBLICATION_MODE_OPTIONS` from Task 3.
- Produces: `MatchPublishFormModel.publicationMode` and a payload whose `publication_mode` exactly matches the selected value.

- [ ] **Step 1: Replace legacy payload tests with three canonical cases**

Cover these assertions:

```ts
expect(offline.publication_mode).toBe("offline_confirmed");
expect(offline.opponent_name).toBe("周末联队");
expect(team.publication_mode).toBe("online_team");
expect("opponent_name" in team).toBe(false);
expect(individual.publication_mode).toBe("online_individual");
expect("opponent_name" in individual).toBe(false);
```

Also assert that `offline_confirmed` with a blank opponent throws `线下已约比赛必须填写对手名称`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `bun test src/pages/matches/create/__tests__/createMatchPayload.test.ts`

Expected: FAIL because the form still exposes legacy `matchKind` semantics.

- [ ] **Step 3: Update the form model and payload builder**

Replace `matchKind?: "external" | "internal"` with required `publicationMode: AppMatchPublicationMode`. In `buildGoCreateMatchPayload`, validate the offline opponent and set:

```ts
publication_mode: form.publicationMode,
...(form.publicationMode === "offline_confirmed"
  ? { opponent_name: form.opposing.trim() }
  : {}),
```

- [ ] **Step 4: Replace the two-option segmented UI**

Render all three `MATCH_PUBLICATION_MODE_OPTIONS` in the existing type section. Each option shows its short label and description. On selection, set `publicationMode`; when selecting a non-offline mode, clear `opposing`. Render the opponent input only for `offline_confirmed`.

- [ ] **Step 5: Initialize and validate the create page**

Default new matches to `online_team`. Require a non-empty opponent only for `offline_confirmed`, and keep edit compatibility by mapping any loaded legacy activity into the closest canonical value without changing unrelated activity-edit behavior.

- [ ] **Step 6: Run the focused payload test**

Run: `bun test src/pages/matches/create/__tests__/createMatchPayload.test.ts`

Expected: PASS.

### Task 5: Display Type in Mini-Program Lists and Home Cards

**Files:**
- Modify: `registration_system_mini/src/types/viewModels.ts`
- Modify: `registration_system_mini/src/pages/home/homeMatchState.ts`
- Modify: `registration_system_mini/src/pages/home/components/HomeMatchCard.vue`
- Modify: `registration_system_mini/src/pages/home/__tests__/homeMatchState.test.ts`
- Modify: `registration_system_mini/src/pages/user/matches/userMatchesState.ts`
- Modify: `registration_system_mini/src/pages/user/matches/components/UserMatchList.vue`
- Modify: `registration_system_mini/src/pages/user/matches/__tests__/userMatchesState.test.ts`
- Modify fixtures as required: `registration_system_mini/src/mock/data/matches.ts`, `registration_system_mini/src/mock/handlers.ts`

**Interfaces:**
- Consumes: compact and full match `publication_mode` values plus `getMatchPublicationModeLabel`.
- Produces: `publicationModeLabel` on both `HomeMatchCardViewModel` and `UserMatchCard`.

- [ ] **Step 1: Add failing view-model expectations**

Require `toGoHomeMatchCard(...)` to return the correct `publicationModeLabel` for compact home data and full list summaries. Require `buildUserMatchCards(...)` to preserve the mapped label.

- [ ] **Step 2: Run focused view-model tests and confirm failure**

Run:

```bash
bun test src/pages/home/__tests__/homeMatchState.test.ts
bun test src/pages/user/matches/__tests__/userMatchesState.test.ts
```

Expected: FAIL because the view models lack `publicationModeLabel`.

- [ ] **Step 3: Map the label in both view-model builders**

Add `publicationModeLabel: getMatchPublicationModeLabel(match.publication_mode)` to each card model. Ensure compact home test fixtures and mock responses include the new required API field.

- [ ] **Step 4: Render list tags near the title/status**

In `HomeMatchCard.vue`, render the type as a compact tag in `home-match-tags`, beside the stage tag. In `UserMatchList.vue`, use `publicationModeLabel` for `match-kind-badge`; keep status, format, and time labels in the same metadata row.

- [ ] **Step 5: Run focused tests**

Run the two commands from Step 2 again.

Expected: PASS.

### Task 6: Display Type in the Mini-Program Detail

**Files:**
- Modify: `registration_system_mini/src/pages/matches/detailData.ts`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
- Modify one or more presentation components selected by the existing mode branch: `registration_system_mini/src/pages/matches/components/IndividualMatchupHero.vue`, `registration_system_mini/src/pages/matches/components/TeamRegistrationHero.vue`, `registration_system_mini/src/pages/matches/components/MatchInfoCard.vue`
- Modify: `registration_system_mini/src/pages/matches/__tests__/detailData.test.ts`

**Interfaces:**
- Consumes: `AppMatchDetailResponse.match.publication_mode` and the shared label helper.
- Produces: `publicationModeLabel` in the detail presentation state and visible first-screen/detail metadata for every mode branch.

- [ ] **Step 1: Add a failing detail-data expectation**

Extend the existing detail fixture and assert the built detail state exposes `publicationModeLabel: "散人对手"` for `online_individual`.

- [ ] **Step 2: Run the focused detail test and confirm failure**

Run: `bun test src/pages/matches/__tests__/detailData.test.ts`

Expected: FAIL because the detail presentation state does not expose the label.

- [ ] **Step 3: Map and wire the label once**

Derive the label in `detailData.ts` or `useMatchDetailPage.ts`, then pass it as a prop into the active hero/info components. Do not duplicate publication-mode string switches in templates.

- [ ] **Step 4: Render in first-screen and base metadata positions**

Show one compact type tag beside the existing status/title metadata and one labeled `比赛类型` item in the shared information area. Ensure both team and individual detail branches receive the same value without putting it inside registration controls.

- [ ] **Step 5: Run the focused detail test**

Run: `bun test src/pages/matches/__tests__/detailData.test.ts`

Expected: PASS.

### Task 7: Full Verification and Visual QA

**Files:**
- Inspect only: all files changed by Tasks 1-6 and all pre-existing dirty files they overlap.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: fresh evidence that backend contracts compile and both clients build.

- [ ] **Step 1: Inspect scoped diffs for accidental overwrite**

Run `git diff --` with the exact Task 1-6 file paths. Confirm no unrelated local changes were removed and no Rust files changed.

- [ ] **Step 2: Run full Go verification**

Run:

```bash
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

Expected: every command exits 0.

- [ ] **Step 3: Run full React admin verification**

Run:

```bash
bun run type-check
bun run lint
bun run build
```

Expected: every command exits 0.

- [ ] **Step 4: Run full mini-program verification**

Run:

```bash
bun test
bun run type-check
bun run build:mp-weixin
```

Expected: every command exits 0.

- [ ] **Step 5: Run browser visual checks**

Start the existing development servers on free ports. Check admin create/list/detail at desktop and narrow viewports, plus mini H5 publish/home/my-matches/detail at mobile viewport. Confirm all three labels fit, tags do not overlap titles/status, and the create descriptions remain readable.

- [ ] **Step 6: Report exact verification evidence and residual limits**

Summarize commands, pass/fail counts, build outcomes, and any visual path that could not be reached due to unavailable fixture/auth state. Do not claim unrun checks passed.
