# Mini Soft Neo Visual Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reusable Soft Neo-Brutalism visual primitives, migrate the approved home page to them, and preserve the current rendered design and all business behavior.

**Architecture:** A three-layer CSS token file supplies all shared visual values. Stable `Neo*` components expose visual props and events only; page-local home components continue to own view models, navigation, permissions, and action emits. Wot UI 2.3.0 backs Button and Tag where its custom-style API can reproduce the approved design, while product-specific Surface, Progress, DateRail, and SectionHeader remain custom uni-app components.

**Tech Stack:** uni-app, Vue 3 `script setup`, TypeScript, Wot UI 2.3.0, CSS variables, rpx, Bun.

## Global Constraints

- The approved `390x844` home screenshot is the visual source of truth.
- Wot UI default styling must not leak through `NeoButton` or `NeoTag`.
- If Wot UI cannot reproduce the approved style on H5 and mp-weixin, keep the public `Neo*` API and replace only its internal implementation.
- Do not modify API, Mock, Store, routes, shared `AppTabHeader`, or shared `BottomTabBar`.
- Keep `HomeMatchList` default rendering unchanged for the all-matches page.
- Use `rpx`, `uni.*`, and cross-platform CSS; do not introduce DOM APIs.
- Do not create commits in this task.

---

### Task 1: Add the Soft Neo token foundation

**Files:**
- Create: `registration_system_mini/src/styles/neo-tokens.css`
- Modify: `registration_system_mini/src/App.vue`

**Interfaces:**
- Produces global primitive tokens prefixed `--neo-primitive-*`.
- Produces semantic tokens prefixed `--neo-color-*`, `--neo-border-*`, `--neo-shadow-*`, and `--neo-motion-*`.
- Produces component tokens prefixed `--neo-surface-*`, `--neo-button-*`, `--neo-tag-*`, `--neo-progress-*`, and `--neo-date-*`.

- [ ] **Step 1: Create the three-layer token file**

Define the approved values once:

```css
:root,
page {
  --neo-primitive-ink: #111310;
  --neo-primitive-surface: #fffdf8;
  --neo-primitive-canvas: #f4f0e8;
  --neo-primitive-lime: #b9f24b;
  --neo-primitive-lime-soft: #dff8a8;
  --neo-primitive-danger: #ff6b5f;
  --neo-primitive-blue-soft: #dce6ff;
  --neo-primitive-red-soft: #ffd2cc;
  --neo-primitive-muted: #ece9e1;

  --neo-color-page: var(--neo-primitive-canvas);
  --neo-color-surface: var(--neo-primitive-surface);
  --neo-color-text: var(--neo-primitive-ink);
  --neo-color-accent: var(--neo-primitive-lime);
  --neo-border-strong: 3rpx solid var(--neo-primitive-ink);
  --neo-border-default: 2rpx solid var(--neo-primitive-ink);
  --neo-shadow-raised: 8rpx 8rpx 0 var(--neo-primitive-ink);
  --neo-shadow-pressed: 4rpx 4rpx 0 var(--neo-primitive-ink);
  --neo-motion-press: 120ms ease;
}
```

Add semantic status aliases and component-specific aliases without duplicating raw hex values.

- [ ] **Step 2: Import tokens globally**

Add `@import "./styles/neo-tokens.css";` before `@import "./uni.css";` in the non-scoped App style.

- [ ] **Step 3: Verify token compilation**

Run: `bun run type-check`

Expected: exit 0.

Run: `bun run build:mp-weixin`

Expected: exit 0; the existing Mock circular-chunk warning may remain.

---

### Task 2: Build foundational structural visual components

**Files:**
- Create: `registration_system_mini/src/components/neo/NeoSurface.vue`
- Create: `registration_system_mini/src/components/neo/NeoDateRail.vue`

**Interfaces:**
- `NeoSurface`: `variant`, `interactive`, `disabled`, `flush`, `customClass`; default slot; emits `tap`.
- `NeoDateRail`: `monthDayLabel`, `weekdayLabel`, `timeLabel`, optional `note`.

- [ ] **Step 1: Implement NeoSurface**

Use one root `view`, class variants, `hover-class`, and an event guard:

```ts
type NeoSurfaceVariant = "raised" | "outlined" | "dark";

function handleTap() {
  if (!props.disabled) emit("tap");
}
```

The raised variant uses tokenized hard shadow and 6rpx radius; interactive press moves 4rpx and switches to the pressed shadow.

- [ ] **Step 2: Implement NeoDateRail**

Render the four display-only labels with stable width and flex behavior. Do not parse dates or derive notes.

- [ ] **Step 3: Run the compiler**

Run: `bun run type-check`

Expected: exit 0.

---

### Task 3: Build Wot-backed NeoButton and NeoTag

**Files:**
- Create: `registration_system_mini/src/components/neo/NeoButton.vue`
- Create: `registration_system_mini/src/components/neo/NeoTag.vue`

**Interfaces:**
- `NeoButtonVariant = "dark" | "lime" | "outline" | "danger" | "muted"`.
- `NeoButtonSize = "sm" | "md"`.
- `NeoButton` props: `variant`, `size`, `loading`, `disabled`, `block`, `stopPropagation`; emits `click`.
- `NeoTagTone = "lime" | "green" | "amber" | "red" | "blue" | "dark" | "muted"`.
- `NeoTag` props: `tone`, `size`; default slot.

- [ ] **Step 1: Implement NeoButton with wd-button**

Use the verified Wot 2.3.0 API:

```vue
<wd-button
  type="primary"
  variant="base"
  :size="size === 'sm' ? 'small' : 'medium'"
  :loading="loading"
  :disabled="disabled"
  :block="block"
  custom-class="neo-button-control"
  :custom-style="buttonStyle"
  @click="handleClick"
>
  <slot />
</wd-button>
```

`buttonStyle` sets Wot component variables plus explicit tokenized border, radius, typography, and shadow. The event guard prevents emits while loading or disabled.

- [ ] **Step 2: Implement NeoTag with wd-tag**

Use `variant="plain"`, `size="small" | "medium"`, `color`, `bg-color`, `custom-class`, and `custom-style`. Tone mappings must resolve through component tokens.

- [ ] **Step 3: Verify H5 and mp-weixin compilation**

Run: `bun run build:h5`

Expected: exit 0.

Run: `bun run build:mp-weixin`

Expected: exit 0.

---

### Task 4: Build the segmented NeoProgress and exports

**Files:**
- Create: `registration_system_mini/src/components/neo/NeoProgress.vue`
- Create: `registration_system_mini/src/components/neo/NeoSectionHeader.vue`
- Create: `registration_system_mini/src/components/neo/index.ts`

**Interfaces:**
- `NeoProgress` props: `value: number`, `max: number`, optional `target`, optional `label`, optional `valueText`, `showMeta`.
- `NeoSectionHeader`: `title`, optional `caption`, `marker`, `actionLabel`; emits `action`.
- Export all six components and their public prop union types from `index.ts`.

- [ ] **Step 1: Implement safe progress calculations**

```ts
const safeMax = computed(() => Math.max(Number.isFinite(props.max) ? props.max : 0, 1));
const safeTarget = computed(() => Math.min(Math.max(props.target ?? safeMax.value, 0), safeMax.value));
const safeValue = computed(() => Math.min(Math.max(Number.isFinite(props.value) ? props.value : 0, 0), safeMax.value));
```

Base width ends at target, extra width begins at target, and every CSS width is clamped to `0%..100%`.
Metadata uses `valueText` when supplied and otherwise renders `value/(target ?? max)`, so a 7-player signup against a 6-player target still displays `7/6` while the track can use an 8-player maximum.

- [ ] **Step 2: Render metadata, track, base fill, extra fill, and target split**

Only render the split when `target < max`; render extra fill only when `value > target`.

- [ ] **Step 3: Add stable exports**

Export default components and union types without global registration.

- [ ] **Step 4: Implement NeoSectionHeader**

Render marker only when supplied and use `NeoButton variant="outline" size="sm"` for the optional action. Keep the caption and action optional.

- [ ] **Step 5: Run type-check**

Run: `bun run type-check`

Expected: exit 0.

---

### Task 5: Migrate home-only surfaces

**Files:**
- Modify: `registration_system_mini/src/pages/home/index.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeHeroSection.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeOpportunityList.vue`

**Interfaces:**
- Existing home props and emits remain unchanged.
- Home page continues to own `openTab`, `openChallengeDetail`, and primary action handlers.

- [ ] **Step 1: Capture the pre-migration baseline**

Use the Browser plugin at `390x844` and save the viewport and full-page screenshots under `/tmp`.

- [ ] **Step 2: Replace home section headings**

Use `NeoSectionHeader` for recent matches and opportunities. Pass existing labels verbatim and wire `@action` to the existing navigation methods.

- [ ] **Step 3: Wrap Hero with NeoSurface**

Use a flush interactive surface without changing swiper autoplay, interval, images, copy, or emitted banner tap.

- [ ] **Step 4: Compose opportunity cards from Neo components**

Use `NeoSurface`, `NeoDateRail`, `NeoTag`, `NeoProgress`, and `NeoButton`. Preserve the body-card tap and `@tap.stop` equivalent for the primary action.

- [ ] **Step 5: Remove replaced duplicate CSS**

Keep only business-specific layout and typography in page-local files. Shared colors, borders, shadows, radii, and press motion must come from tokens/components.

- [ ] **Step 6: Compile**

Run: `bun run type-check && bun run build:h5`

Expected: both exit 0.

---

### Task 6: Migrate the brutalist match variant without changing default

**Files:**
- Modify: `registration_system_mini/src/pages/home/components/HomeMatchList.vue`

**Interfaces:**
- Existing `variant?: "default" | "brutalist"` remains unchanged.
- Existing props, emits, progress inputs, avatar rendering, and navigation behavior remain unchanged.

- [ ] **Step 1: Keep default nodes and classes stable**

Do not change the default card/date markup or default CSS. Any conditional Neo component must render only for `variant === "brutalist"`.

- [ ] **Step 2: Use NeoTag, NeoProgress, and NeoButton in the brutalist branch**

Map existing stage/status classes to Neo tones without moving business logic into the visual components. Pass `joinedPlayers`, `maxPlayers`, and `requiredPlayers` to NeoProgress.

- [ ] **Step 3: Tokenize the brutalist card shell and date rail**

Replace raw Soft Neo values in the `.match-list-brutalist` rules with tokens. Retain existing class names to preserve layout.

- [ ] **Step 4: Verify the all-matches default**

Open `#/pages/home/matches/index` and confirm `.match-list-brutalist` is absent, border width remains `0`, and the soft shadow remains.

---

### Task 7: Tokenize skeleton and complete visual QA

**Files:**
- Modify: `registration_system_mini/src/pages/home/components/HomeSkeleton.vue`
- Verify: all files from Tasks 1-6

**Interfaces:**
- Skeleton template and loading behavior remain unchanged.

- [ ] **Step 1: Replace repeated Soft Neo skeleton values with tokens**

Keep shimmer animation and dimensions unchanged.

- [ ] **Step 2: Run full project verification**

Run: `bun run type-check`

Run: `bun run build:h5`

Run: `bun run build:mp-weixin`

Run: `git diff --check -- src/App.vue src/styles/neo-tokens.css src/components/neo src/pages/home`

Expected: all commands exit 0; only the known Mock circular-chunk warning may remain.

- [ ] **Step 3: Run Browser visual checks**

The flow under test is: home loads -> approved Soft Neo first viewport renders -> Hero, first match, first opportunity, and all-matches links navigate correctly without submitting data.

Check:

- page identity and meaningful DOM;
- no framework overlay;
- fresh-home console has no related error/warn;
- `390x844` and `1280x900` have no horizontal overflow;
- current screenshot matches baseline for card geometry, border, shadow, radius, typography, tags, and segmented progress;
- bottom tab does not cover the last opportunity card.

- [ ] **Step 4: Preserve the final H5 handoff**

Confirm `http://localhost:5174/#/` returns HTTP 200 and keep the final Browser tab open for review.
