# 小程序比赛报名详情页 Soft Neo-Brutalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将比赛报名详情页的个人报名主流程迁移到已确认的 Soft Neo-Brutalism 视觉系统，并建立可供后续球队报名和其他页面复用的基础视觉组件。

**Architecture:** 保留 `useMatchDetailPage` 对加载、权限、容量判断、提交和弹窗状态的所有权；详情页和比赛域组件只做展示编排。新增的 `NeoSegmentedControl`、`NeoAvatarStack`、`NeoStickyActionBar` 只负责视觉结构和局部交互，报名状态卡与比赛说明卡留在比赛域内，通过 props/emits 连接业务状态。进度条统一由 `NeoProgress(value, target, max)` 驱动。

**Tech Stack:** `uni-app`、Vue 3、TypeScript、Vite、Wot UI 2.3.0（仅通过现有 `NeoButton` / `NeoTag` 封装使用）。

## Global Constraints

- 不修改 API、Mock、Store、路由、分享路径、权限规则或报名提交契约。
- 所有新增样式使用 `rpx`、`hover-class` 和 uni-app 组件，不使用 DOM API、`:hover` 或仅 H5 可用能力。
- 视觉组件不读取 Store、不请求 API、不执行路由；父页面持有业务状态和异步流程。
- `maxPlayers` 优先取 `match.team_capacity_limit`，缺失或非法时回退到 `requiredPlayers`，且不得小于 `requiredPlayers`。
- `8 人报名 / 6 人成行 / 8 人满员` 必须渲染绿色 `75%`、红色 `25%`、分界线位于 `75%`。
- 不提交代码或文档；所有改动保留在当前 `codex/mini-soft-neo-components` 分支。

---

### Task 1: 统一详情页报名进度数据契约

**Files:**
- Modify: `registration_system_mini/src/pages/matches/detailState.ts:48-61`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts:107-123, 893-904`
- Modify: `registration_system_mini/src/pages/matches/detail.vue:15-75`
- Create: `registration_system_mini/src/pages/matches/__tests__/detailState.test.ts`
- Modify: `registration_system_mini/src/pages/__tests__/matchDetailRegistrationDesign.test.ts:220-245`

**Interfaces:**
- `buildRegistrationProgress(joinedCount: number, requiredPlayers: number, maxPlayers?: number): { baseWidth: string; extraWidth: string; splitLeft: string }`
- `useMatchDetailPage()` exposes `maxPlayers: ComputedRef<number>` alongside `joinedCount` and `requiredPlayers`.

- [ ] **Step 1: Write the failing progress contract test**

Add a real utility test with hand-derived expectations:

```ts
test("uses the maximum capacity as the progress denominator", () => {
  expect(buildRegistrationProgress(8, 6, 8)).toEqual({
    baseWidth: "75%",
    extraWidth: "25%",
    splitLeft: "75%",
  });
});
```

Add a fallback case proving `buildRegistrationProgress(6, 6)` has no overflow width and does not divide by zero.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run from `registration_system_mini`:

```bash
bun test src/pages/matches/__tests__/detailState.test.ts -t "maximum capacity"
```

Expected: FAIL because the current helper hardcodes an `82%` split and has no `maxPlayers` parameter.

- [ ] **Step 3: Implement the minimal capacity-aware calculation**

Replace the fixed split calculation with these rules:

```ts
const target = Math.max(requiredPlayers, 0);
const max = Math.max(maxPlayers ?? target, target, 1);
const baseWidth = `${Math.min(Math.min(joinedCount, target) / max * 100, 100)}%`;
const extraWidth = `${Math.min(Math.max(joinedCount - target, 0) / max * 100, 100)}%`;
const splitLeft = `${Math.min(target / max * 100, 100)}%`;
```

In `useMatchDetailPage`, compute `maxPlayers` from `match.team_capacity_limit`, falling back to `requiredPlayers`; pass it to `buildRegistrationProgress`, expose it from the composable, and pass it through `detail.vue` to the personal registration component.

- [ ] **Step 4: Update stale design assertions**

Update `matchDetailRegistrationDesign.test.ts` so it asserts the capacity-aware contract and `NeoProgress` usage instead of checking for `overflowVisualWidth`, `const splitPercent = 82`, or the old `IndividualCountdownCard` class names. Keep all assertions for registration deadline, current-status cancellation, guest behavior, full-capacity gating, member dialog, and team submission.

- [ ] **Step 5: Run the focused tests**

```bash
bun test src/pages/matches/__tests__/detailState.test.ts -t "maximum capacity"
bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts -t "match detail registration design"
```

Expected: all focused tests pass; the existing absolute-path issue in unrelated legacy tests is not part of this task.

---

### Task 2: Add reusable Neo control primitives

**Files:**
- Modify: `registration_system_mini/src/styles/neo-tokens.css`
- Create: `registration_system_mini/src/components/neo/NeoSegmentedControl.vue`
- Create: `registration_system_mini/src/components/neo/NeoAvatarStack.vue`
- Create: `registration_system_mini/src/components/neo/NeoStickyActionBar.vue`
- Modify: `registration_system_mini/src/components/neo/index.ts`

**Interfaces:**
- `NeoSegmentedControl`: `modelValue: string`, `options: Array<{ label: string; value: string; disabled?: boolean }>`, optional `block`; emits `update:modelValue` and `change`.
- `NeoAvatarStack`: `items: Array<{ id: string | number; name: string; avatarUrl?: string; tone?: string }>`, optional `selectedId`, `maxVisible`, `interactive`, `size`; emits `select`.
- `NeoStickyActionBar`: optional `visible`; default slot and optional `leading` slot; no business emits.

- [ ] **Step 1: Add only the required tokens**

Add component-level tokens for segmented controls, avatar sizes/overlap, and sticky action bar spacing. Reference existing semantic tokens; do not introduce a second palette.

- [ ] **Step 2: Implement `NeoSegmentedControl`**

Render a stable grid from `options`, use `hover-class` for press feedback, keep disabled options inert, and emit the selected value without knowing the business meaning of the option.

- [ ] **Step 3: Implement `NeoAvatarStack`**

Render up to `maxVisible` items, fallback to the first character of `name` when `avatarUrl` is empty, render `+N` for hidden items, and emit `select` only when `interactive` is true.

- [ ] **Step 4: Implement `NeoStickyActionBar` and export all three components**

Use safe-area-aware fixed positioning and a tokenized raised surface. Keep the component content-agnostic so callers provide `NeoButton` and labels.

- [ ] **Step 5: Run type checking**

```bash
bun run type-check
```

Expected: PASS with the new component APIs exported from `src/components/neo/index.ts`.

---

### Task 3: Build the personal registration status card

**Files:**
- Create: `registration_system_mini/src/pages/matches/components/MatchRegistrationStatusCard.vue`
- Modify: `registration_system_mini/src/pages/matches/components/MatchIndividualRegistration.vue`
- Remove from active imports: `registration_system_mini/src/pages/matches/components/IndividualCountdownCard.vue`

**Interfaces:**
- Props: `joinedCount`, `requiredPlayers`, `maxPlayers`, `countdownText`, `participantPreview`, `remainingPlayersLabel`, `submittingStatus`, `individualCtaLabel`, `isGuestMode`, `ctaDisabled`, `showCta`.
- Emits: `selectIndividualSignup`, `selectParticipant`.

- [ ] **Step 1: Add the new card with the existing interaction contract**

Compose `NeoSurface`, `NeoProgress`, `NeoAvatarStack`, `NeoTag`, and `NeoButton`. Pass `value=joinedCount`, `target=requiredPlayers`, `max=maxPlayers`, and `valueText=\`${joinedCount}/${requiredPlayers}\``. Keep participant selection local to the card and emit only intent.

- [ ] **Step 2: Move the CTA to the shared action-bar slot boundary**

Keep the existing disabled/loading/guest labels and submit event. Do not add API calls or confirmation logic to the new card.

- [ ] **Step 3: Wire `MatchIndividualRegistration` to the new card**

Replace the `IndividualCountdownCard` import and template usage. Preserve the member-board visibility condition, `dialog-visibility-change`, location event, and all parent emits.

- [ ] **Step 4: Run the focused component design test**

```bash
bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts -t "individual registration view"
```

Expected: PASS after assertions are updated to the new component name and Neo composition.

---

### Task 4: Migrate match Hero, mode switch, info card, and action bar

**Files:**
- Modify: `registration_system_mini/src/pages/matches/detail.vue`
- Modify: `registration_system_mini/src/pages/matches/components/IndividualMatchupHero.vue`
- Modify: `registration_system_mini/src/pages/matches/components/TeamMemberRegistrationBoard.vue`
- Create: `registration_system_mini/src/pages/matches/components/MatchInfoCard.vue`
- Modify: `registration_system_mini/src/pages/matches/components/IndividualInfoCard.vue`
- Modify: `registration_system_mini/src/pages/matches/components/TeamMatchInfoCard.vue`
- Modify: `registration_system_mini/src/pages/challenges/components/ChallengeIndividualRegistration.vue`
- Modify: `registration_system_mini/src/pages/matches/components/MatchDetailSkeleton.vue`

**Interfaces:**
- `MatchInfoCard`: `title: string`, `items: string[]`, `score: number`, `scoreLabel: string`.
- `IndividualInfoCard` and `TeamMatchInfoCard` remain compatibility wrappers so the challenge page and team page do not lose their existing props.

- [ ] **Step 1: Replace the page-local mode switch with `NeoSegmentedControl`**

Bind `registrationMode` with `v-model`, keep the team option conditional on `canUseTeamRegistration`, and preserve the current page-meta scroll lock.

- [ ] **Step 2: Convert `IndividualMatchupHero` to Neo tokens**

Use `NeoSurface variant="dark"` and `NeoTag`; keep the current team/date/location props and `openLocation` emit. Remove only duplicated visual primitives, not the jersey rendering or location behavior.

- [ ] **Step 3: Add `MatchInfoCard` and preserve wrapper consumers**

Move duplicate info-card layout into `MatchInfoCard`, then make the individual and team info components pass their existing copy and score labels to it. Keep `ChallengeIndividualRegistration` working through `IndividualInfoCard` until its own page migration.

- [ ] **Step 4: Migrate the personal primary action to `NeoStickyActionBar`**

Use the existing `handleSelectIndividualSignup`, `individualCtaLabel`, `submittingStatus`, `isGuestMode`, and `canSubmitIndividualRegistration`. Do not change confirmation dialogs or auth routing. Keep the existing team submit bar behavior, but make its shell consume the same action-bar primitive when mode is `team`.

- [ ] **Step 5: Migrate the member board and skeleton surface styling**

Use `NeoSurface`, `NeoTag`, `NeoAvatarStack`, and `NeoButton` for the existing member groups and custom dialog. Preserve `selectedGroup`, `selectedMember`, all status labels, and every existing emit. Update skeleton colors, borders, radii, and shadows to `neo-tokens.css`.

- [ ] **Step 6: Run type checking after the page wiring**

```bash
bun run type-check
```

Expected: PASS; no direct Wot UI controls are introduced for button/tag visuals.

---

### Task 5: Update design-contract tests and validate the two build targets

**Files:**
- Modify: `registration_system_mini/src/pages/__tests__/matchDetailRegistrationDesign.test.ts`
- Modify: `registration_system_mini/src/pages/matches/__tests__/detailState.test.ts`
- Inspect: `registration_system_mini/src/components/neo/NeoProgress.vue`

- [ ] **Step 1: Replace stale source assertions**

Keep assertions for deadline calculation, holding-date clock, route/share behavior, capacity gating, confirmation dialogs, member dialog scroll lock, and team submission. Replace assertions tied only to removed visual names or the old fixed `82%` algorithm with observable Neo component/data-contract assertions.

- [ ] **Step 2: Run the focused behavior tests**

```bash
bun test src/pages/matches/__tests__/detailState.test.ts
bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts
```

Expected: all relevant tests pass. Report any pre-existing absolute-path failures separately rather than changing unrelated test infrastructure.

- [ ] **Step 3: Run the project checks**

```bash
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

Expected: all three commands exit `0`. The existing Mock circular chunk warning may remain in the WeChat build output.

- [ ] **Step 4: Run whitespace and scope checks**

```bash
git diff --check -- +  src/pages/matches/detail.vue +  src/pages/matches/detailState.ts +  src/pages/matches/useMatchDetailPage.ts +  src/pages/matches/components +  src/components/neo +  src/styles/neo-tokens.css +  src/pages/challenges/components/ChallengeIndividualRegistration.vue
```

Expected: no whitespace errors and no changes outside the approved page/component scope, aside from the uncommitted design/plan documents.

---

### Task 6: Perform browser visual and interaction QA

**Files:**
- No source changes expected; save screenshots outside the repository under `/tmp/`.

- [ ] **Step 1: Start or verify H5 on the requested port**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:5174/
```

Expected: `200`.

- [ ] **Step 2: Verify the target route and first meaningful screen**

Flow under test: `http://localhost:5174/#/pages/matches/detail?id=act-003` -> page loads -> personal registration mode shows Hero, progress, participants, rules, and primary action.

Capture a `390x844` screenshot and verify no framework overlay, no horizontal overflow, no text overlap, and the action bar does not cover content.

- [ ] **Step 3: Verify the capacity-aware progress visually**

Use Mock `act-003` and confirm the page shows `8/6`, green `75%`, red `25%`, and the split at `75%`. The DOM must include the Neo progress split element when `target < max`.

- [ ] **Step 4: Verify interactions without changing business contracts**

Exercise:

- Tap `球队报名`, confirm the team mode renders and the team submit bar remains present.
- Tap `个人报名`, confirm the personal mode returns.
- Tap a participant avatar, confirm its selected-name state appears.
- Tap the location, confirm the existing location handler path is invoked.
- Verify guest/full/submitting labels from existing state paths where available.

- [ ] **Step 5: Verify a 1280px viewport**

Confirm the 375px app canvas remains centered with no horizontal overflow, and the fixed action bar stays aligned with the app canvas rather than the browser window.

- [ ] **Step 6: Leave one user-facing H5 page open**

Keep `http://localhost:5174/#/` or the detail route as the deliverable tab, reset any temporary viewport override, and leave all temporary visual companion artifacts outside source directories.
