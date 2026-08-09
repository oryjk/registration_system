# 小程序资料编辑页 Soft Neo-Brutalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将资料编辑页改造成与“我的”页统一的 Soft Neo-Brutalism 表单页面，保留现有资料业务流程。

**Architecture:** 继续使用 `src/pages/profile/setup/index.vue` 作为页面编排层，复用 `NeoSurface`、`NeoSectionHeader` 和 `NeoButton`。不修改 API 契约；仅在页面展示层增加头像错误回退与统一样式。

**Tech Stack:** `uni-app`、Vue 3、TypeScript、Wot UI 2.3.0、现有 Neo 视觉封装。

## Global Constraints

- 跨端 API 继续使用 `uni.*`，不直接调用 `wx.*`。
- 微信专属头像/手机号能力继续使用条件编译，H5 保留相册降级。
- 样式使用 `rpx`、`hover-class` 和 `--neo-*` token，不使用 DOM API、`:hover` 或新依赖。
- 保留现有 `updateMyProfile`、`uploadMyAvatar`、`bindMyPhoneNumber`、`refreshSessionContext` 调用顺序和错误提示。

### Task 1: 替换资料编辑页视觉结构

**Files:**
- Modify: `registration_system_mini/src/pages/profile/setup/index.vue`

**Interfaces:**
- Consumes: existing `currentUser`, `nicknameInput`, `avatarPreview`, `shouldShowPhoneBinding`, `isSaving`, `isBindingPhone` state and existing handlers.
- Produces: same route, form fields, platform-specific avatar/phone controls and save behavior with Neo-styled rendering.

- [ ] **Step 1: Keep existing page-state and API flow unchanged**

Retain `handleChooseAvatar`, `handlePickAvatarFallback`, `handleSubmit`, `handleGetPhoneNumber`, `onLoad`, and `onShow`; only add `avatarLoadFailed` state and reset it when a new preview is selected or the current user is rehydrated.

- [ ] **Step 2: Build the new template from existing visual primitives**

Use `AppTabHeader showBack`, a dark `NeoSurface` for the profile Hero, an outlined `NeoSurface` for the form, `NeoSectionHeader title="基础资料" marker="01"`, and block `NeoButton` for save. Keep platform conditionals around native WeChat buttons and use a H5 `NeoButton` for `chooseImage`.

- [ ] **Step 3: Replace the old rounded/gradient styles**

Use page background `var(--neo-color-page)`, `2rpx` borders, `var(--neo-shadow-*)`/solid offset shadows, `var(--neo-radius-*)`, and explicit input typography. Ensure the avatar, form controls and action row have stable dimensions and wrap safely at narrow widths.

- [ ] **Step 4: Run the page-level verification**

Run `bun run type-check` and open `http://localhost:5174/#/pages/profile/setup/index?mode=edit`. Verify prefilled nickname, avatar fallback, nickname editing, disabled/enabled save state, and return navigation.

### Task 2: Cross-platform build and final QA

**Files:**
- Modify: `.superpowers/sdd/2026-08-09-mini-profile-setup-soft-neo/progress.md`

- [ ] **Step 1: Run builds and diff checks**

Run `bun run build:h5`, `bun run build:mp-weixin`, and from the workspace root `git diff --check`.

- [ ] **Step 2: Validate desktop and mobile rendering**

Check page identity, nonblank content, no framework overlay, no relevant console errors, no horizontal overflow, and the save/edit flow in Browser/IAB.
