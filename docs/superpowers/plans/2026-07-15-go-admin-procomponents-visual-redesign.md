# Go Admin ProComponents Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Go admin frontend into a consistent, dense, responsive operations console using ProComponents without changing API, auth, routing, or business behavior.

**Architecture:** Keep Vite, React Router, the current auth provider, and all `src/api` contracts. Add ProComponents only at the presentation layer, centralize Ant Design 5.29 tokens in a focused theme module, preserve the custom navigation shell, and migrate pages incrementally so server-paged and local-data tables retain their real data semantics.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Ant Design 5.29.3, `@ant-design/pro-components` 2.8.10, Bun, Playwright.

---

### Task 1: Install and Inspect the Exact Ant Design Surface

**Files:**
- Modify: `registration_system_backend_fe_go/package.json`
- Modify: `registration_system_backend_fe_go/bun.lock`
- Create: `registration_system_backend_fe_go/src/theme.ts`
- Modify: `registration_system_backend_fe_go/src/App.tsx`

- [ ] **Step 1: Install tooling and the supported ProComponents version**

Run:

```bash
npm install -g @ant-design/cli@6.5.1
cd registration_system_backend_fe_go
bun add @ant-design/pro-components@2.8.10
```

Expected: `package.json` contains `@ant-design/pro-components` and Bun updates the lockfile without upgrading antd to v6.

- [ ] **Step 2: Query exact APIs before writing component code**

Run:

```bash
antd info ConfigProvider --version 5.29.3 --format json
antd token Button --version 5.29.3 --format json
antd token Table --version 5.29.3 --format json
antd info Table --version 5.29.3 --format json
```

Expected: JSON output for antd 5.29.3; no v6-only API assumptions.

- [ ] **Step 3: Add the theme module**

Create `src/theme.ts` exporting one `ThemeConfig` with global tokens and component tokens for Button, Table, Form, Input, Select, Modal, Drawer, Menu, Tag, and Layout. Use the approved dark green, neutral surface, and restrained lime accent palette. Do not include selectors or business state.

- [ ] **Step 4: Apply the theme at the root**

Update `src/App.tsx` to import `appTheme` and pass it to the single root `ConfigProvider`. Preserve locale, BrowserRouter, AuthProvider, lazy routes, and the React 19 patch.

- [ ] **Step 5: Verify and commit the foundation**

Run:

```bash
bun run type-check
bun run lint
bun run build
antd lint src/App.tsx src/theme.ts --format json
```

Expected: all commands exit 0 and the CLI reports no invalid/deprecated antd usage.

Commit:

```bash
git add registration_system_backend_fe_go/package.json registration_system_backend_fe_go/bun.lock registration_system_backend_fe_go/src/App.tsx registration_system_backend_fe_go/src/theme.ts
git commit -m "feat(admin): add ProComponents theme foundation"
```

### Task 2: Refine the Application Shell and Login Experience

**Files:**
- Modify: `registration_system_backend_fe_go/src/components/AppShell.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/LoginPage.tsx`
- Modify: `registration_system_backend_fe_go/src/styles.css`

- [ ] **Step 1: Query public Layout, Menu, Drawer, and Form APIs**

Run:

```bash
antd info Layout --version 5.29.3 --format json
antd info Menu --version 5.29.3 --format json
antd info Drawer --version 5.29.3 --format json
antd info Form --version 5.29.3 --format json
```

- [ ] **Step 2: Simplify AppShell**

Keep permission-based menu construction and responsive Drawer behavior. Reduce the header to navigation control, current page context, account identity, and logout; make collapsed and mobile states stable. Preserve all existing accessible labels.

- [ ] **Step 3: Refine LoginPage**

Keep the real football image, login request, error Alert, and single primary action. Remove nonessential English labels, strengthen image/text contrast, and keep the form width and controls stable at desktop and mobile sizes.

- [ ] **Step 4: Rebuild global layout CSS around variables**

Define palette and spacing variables in `:root`. Keep only business/layout selectors, remove obsolete broad `.ant-*` overrides where tokens or documented component props cover the behavior, and add responsive rules for 1440x1000 and 390x844.

- [ ] **Step 5: Verify and commit shell changes**

Run type-check, lint, build, and:

```bash
antd lint src/components/AppShell.tsx src/pages/LoginPage.tsx --format json
```

Commit:

```bash
git add registration_system_backend_fe_go/src/components/AppShell.tsx registration_system_backend_fe_go/src/pages/LoginPage.tsx registration_system_backend_fe_go/src/styles.css
git commit -m "feat(admin): refine console shell and login"
```

### Task 3: Migrate List Pages to PageContainer and ProTable

**Files:**
- Create: `registration_system_backend_fe_go/src/components/PageScaffold.tsx`
- Create: `registration_system_backend_fe_go/src/utils/list-query.ts`
- Modify: `registration_system_backend_fe_go/src/pages/MatchListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/TeamListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/AdminListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/styles.css`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

- [ ] **Step 1: Query ProTable and PageContainer APIs**

Use the installed package type declarations plus Ant Design CLI queries for the underlying Table, Input, Select, Modal, Drawer, and Dropdown APIs. Confirm every used ProTable prop against `node_modules/@ant-design/pro-table` types before editing.

- [ ] **Step 2: Add query parsing helpers and E2E expectations first**

Add pure helpers that read/write `search`, `status`, `page`, and `page_size` through `URLSearchParams`. Extend Playwright expectations so changing match filters updates the URL and a reload restores them.

- [ ] **Step 3: Add PageScaffold**

Wrap `PageContainer` in a small component that accepts title, description, extra actions, back navigation, and children. It must not know API, permissions, table columns, or business state.

- [ ] **Step 4: Convert MatchListPage**

Use ProTable request mode mapped to `listMatches({ page, page_size, status, search })`. Keep server pagination, permission-aware destructive actions, double-click navigation, error retry, and mobile column reduction. Synchronize filters and pagination with the URL.

- [ ] **Step 5: Convert TeamListPage**

Use ProTable with local `dataSource`, because the API returns a full list. Keep client-side keyword/status filtering, CRUD calls, detail Drawer, delete constraints, and existing accessible action labels. Replace create/edit Modal + Form with `ModalForm` while preserving payloads.

- [ ] **Step 6: Convert AdminListPage**

Use static ProTable data, keep super-admin enforcement, and replace create Modal + Form with `ModalForm`. Preserve password confirmation and existing create payload.

- [ ] **Step 7: Verify and commit list pages**

Run type-check, lint, build, `antd lint` on changed TSX files, and the relevant Playwright flows with configured admin credentials.

Commit:

```bash
git add registration_system_backend_fe_go/src/components/PageScaffold.tsx registration_system_backend_fe_go/src/utils/list-query.ts registration_system_backend_fe_go/src/pages/MatchListPage.tsx registration_system_backend_fe_go/src/pages/TeamListPage.tsx registration_system_backend_fe_go/src/pages/AdminListPage.tsx registration_system_backend_fe_go/src/styles.css registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts
git commit -m "feat(admin): unify management list workflows"
```

### Task 4: Migrate Match Form, Detail, Dashboard, and Access Pages

**Files:**
- Modify: `registration_system_backend_fe_go/src/pages/MatchFormPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/DashboardPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/AccessPage.tsx`
- Modify: `registration_system_backend_fe_go/src/styles.css`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

- [ ] **Step 1: Query Form, DatePicker, Descriptions, and Result APIs**

Run exact-version CLI queries and inspect ProForm type declarations for `ProForm`, `ProFormText`, `ProFormSelect`, `ProFormDigit`, and `ProFormDateTimeRangePicker` before editing.

- [ ] **Step 2: Convert MatchFormPage**

Keep the dedicated route and current submit functions. Use ProForm field components while preserving mode-dependent fields, team search, quick-create confirmation, date serialization, coordinate validation, editing restrictions, and payload shape.

- [ ] **Step 3: Convert MatchDetailPage**

Use PageScaffold, a compact status summary, documented Descriptions styling, and ProTable for registration groups. Keep update, cancellation, deletion, and permission behavior unchanged.

- [ ] **Step 4: Refocus DashboardPage**

Show only metrics derivable from existing health, match, and team APIs. If an aggregate requires unavailable data, omit it rather than inventing values. Move raw route information to AccessPage.

- [ ] **Step 5: Refine AccessPage**

Keep authenticated identity and API contract information, but use the same PageScaffold, spacing, status treatment, and responsive layout as operational pages.

- [ ] **Step 6: Verify and commit remaining pages**

Run type-check, lint, build, exact-path `antd lint`, and existing Playwright flows.

Commit:

```bash
git add registration_system_backend_fe_go/src/pages/MatchFormPage.tsx registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx registration_system_backend_fe_go/src/pages/DashboardPage.tsx registration_system_backend_fe_go/src/pages/AccessPage.tsx registration_system_backend_fe_go/src/styles.css registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts
git commit -m "feat(admin): complete ProComponents page refresh"
```

### Task 5: Visual QA and Cleanup

**Files:**
- Modify: `registration_system_backend_fe_go/src/styles.css`
- Modify: `registration_system_backend_fe_go/progress.md`
- Modify: `registration_system_backend_fe_go/findings.md`
- Modify: `registration_system_backend_fe_go/task_plan.md`

- [ ] **Step 1: Run the full quality gate**

```bash
cd registration_system_backend_fe_go
bun run type-check
bun run lint
bun run build
antd doctor --format json
antd usage ./src --format json
antd lint ./src --format json
```

- [ ] **Step 2: Run Playwright at desktop and mobile sizes**

Use the existing Playwright projects with valid admin credentials. Capture login, dashboard, match list/form/detail, team list, and admin list screenshots. Confirm no overflow, overlap, blank page, inaccessible action, or broken modal/drawer.

- [ ] **Step 3: Inspect browser console and network failures**

Require zero uncaught browser exceptions. Distinguish expected mocked/API errors from rendering failures and fix only regressions introduced by this work.

- [ ] **Step 4: Remove obsolete CSS**

Search for unused class names and broad `.ant-*` selectors. Keep only selectors required for documented layout behavior that cannot be expressed through tokens or component props.

- [ ] **Step 5: Re-run the quality gate and commit cleanup**

```bash
git diff --check
bun run type-check
bun run lint
bun run build
```

Commit:

```bash
git add registration_system_backend_fe_go
git commit -m "chore(admin): finalize responsive visual QA"
```
