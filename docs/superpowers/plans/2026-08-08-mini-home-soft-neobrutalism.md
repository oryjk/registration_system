# Mini Home Soft Neo-Brutalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle only the mini-program home page to the approved Soft Neo-Brutalism direction while preserving all data and interactions.

**Architecture:** Keep the existing home page component tree. Add a visual-only `variant` to the reused match list so the home page can opt into the new style while the all-matches page remains unchanged; apply the remaining styles inside home-only scoped components.

**Tech Stack:** uni-app, Vue 3, TypeScript, scoped CSS, Wot UI v2 project conventions

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-08-mini-home-soft-neobrutalism-design.md`.
- Do not modify API, Mock, stores, routes, view models, `AppTabHeader.vue`, or `BottomTabBar.vue`.
- Do not add dependencies or replace the custom segmented progress bar with `wd-progress`.
- Use `rpx`; preserve H5 and WeChat mini-program compilation.
- Compare final changes against `/tmp/registration-system-wot-home-baseline-status.txt` and `/tmp/registration-system-wot-home-baseline.diff`.

---

### Task 1: Isolate the Home Match Visual Variant

**Files:**
- Modify: `registration_system_mini/src/pages/home/index.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeMatchList.vue`

**Interfaces:**
- Consumes: existing `HomeMatchList` props and `matchTap` emit
- Produces: optional `variant?: "default" | "brutalist"` with default `default`; root class `match-list-brutalist` only on home

- [ ] Add `withDefaults(defineProps(...), { variant: "default" })` without changing existing prop types or events.
- [ ] Bind the root class to `variant` and pass `variant="brutalist"` from the home page only.
- [ ] Add brutalist overrides under `.match-list-brutalist` for card, date panel, tags, progress, avatars, status, button, and press state; leave existing default selectors intact.
- [ ] Run `bun run type-check` and confirm the all-matches call site requires no change.

### Task 2: Apply the Approved Home Visual System

**Files:**
- Modify: `registration_system_mini/src/pages/home/index.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeHeroSection.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeOpportunityList.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeSkeleton.vue`

**Interfaces:**
- Consumes: existing props, emits, runtime banner data, challenge cards, and loading states
- Produces: visual-only warm white, black outline, hard shadow, low-radius, lime-accent rendering

- [ ] Restyle the page background, refresh chip, section headings, links, hot marker, and empty state using fixed design tokens from the spec.
- [ ] Restyle Hero with `3rpx` black border, `8rpx` hard shadow, `6rpx` radius, fixed 78%-to-30% mask, rectangular lime CTA, and press feedback while preserving banner/image behavior.
- [ ] Restyle opportunity cards with the same component family, including rectangular state tags and bordered progress track; preserve card-body and primary-button event separation.
- [ ] Restyle skeleton surfaces with low radii and fine outlines while preserving shimmer and dimensions.
- [ ] Run `bun run type-check`.

### Task 3: Verify Rendering and Cross-Platform Health

**Files:**
- Verify only: the five approved home files and generated ignored build output

**Interfaces:**
- Consumes: running H5 server at `http://localhost:5174/#/`
- Produces: browser screenshots and build evidence

- [ ] Run `bun run type-check`, `bun run build:h5`, and `bun run build:mp-weixin`.
- [ ] Reload the in-app Browser and verify page identity, meaningful DOM, no framework overlay, and relevant console health.
- [ ] Capture and inspect screenshots at `390x844` and `1280x900`; compare against the supplied reference image and the pre-change screenshot.
- [ ] Exercise only non-submitting navigation: Hero, first match card, first opportunity card body, and all-matches link; return after each.
- [ ] Confirm all-matches retains the default `HomeMatchList` style.
- [ ] Run `git diff --check`, compare target-file changes to the saved baseline, and confirm no new diff in API, Mock, stores, routes, or shared navigation.
