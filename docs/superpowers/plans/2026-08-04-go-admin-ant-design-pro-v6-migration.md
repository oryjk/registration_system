# Go Admin Ant Design Pro v6 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unpublished Go admin Vite application with a production-ready Ant Design Pro v6 application while preserving every existing route, API contract, permission, business action, brand direction, and Nginx deployment path.

**Architecture:** Use the official Ant Design Pro `v6.0.2` simple template as a reference, then run the existing project on Umi Max 4 and utoopack. Keep `src/api` as the only HTTP boundary, place React Query hooks above it, render controlled ProComponents from those hooks, and derive Umi initial state and access rules from the existing admin token and `/api/admin/auth/me` contract.

**Tech Stack:** Node.js 20+, Bun, React 19, TypeScript 6, Umi Max 4, utoopack, antd 6.4.5, `@ant-design/pro-components` 3, React Query 5, Tailwind CSS 4, antd-style 4, Biome 2, Jest, Playwright, Ant Design CLI 6.5.3.

## Global Constraints

- Keep the project at `registration_system_backend_fe_go/`; do not create a permanent sibling frontend.
- Pin `antd` to `6.4.5` and `@ant-design/cli` to `6.5.3` so MCP and local metadata match.
- Keep Bun for installs and scripts; require Node.js `>=20.0.0` for Umi and project scripts.
- Keep the Local Storage key `registration-admin-go.token.v1`.
- Preserve `{ code, message, data }`, success `code = 0`, `/api/admin`, and `/health` exactly.
- Preserve `/`, `/login`, `/matches`, `/matches/new`, `/matches/:id`, `/matches/:id/edit`, `/teams`, `/admins`, `/access`, and add explicit `/403` and `/404` pages.
- Preserve development `/go-api`, production same-origin requests, and Nginx `/registration-admin/` routing.
- Do not add Pro demo pages, AI, charts, maps, Cloudflare Worker, Mock, OpenAPI, analytics, or invented business metrics.
- Keep the dark green brand direction and dense operations-console layout.
- Do not overwrite or revert pre-existing README, AGENTS, CLAUDE, or other workspace changes; stage only migration-owned hunks.

---

### Task 1: Replace the Build and Dependency Foundation

**Files:**
- Modify: `registration_system_backend_fe_go/package.json`
- Modify: `registration_system_backend_fe_go/bun.lock`
- Create: `registration_system_backend_fe_go/config/config.ts`
- Create: `registration_system_backend_fe_go/config/defaultSettings.ts`
- Create: `registration_system_backend_fe_go/config/proxy.ts`
- Create: `registration_system_backend_fe_go/config/routes.ts`
- Create: `registration_system_backend_fe_go/biome.json`
- Create: `registration_system_backend_fe_go/postcss.config.js`
- Create: `registration_system_backend_fe_go/src/global.css`
- Modify: `registration_system_backend_fe_go/tsconfig.json`
- Modify: `registration_system_backend_fe_go/.gitignore`
- Delete: `registration_system_backend_fe_go/vite.config.ts`
- Delete: `registration_system_backend_fe_go/tsconfig.app.json`
- Delete: `registration_system_backend_fe_go/tsconfig.node.json`
- Delete: `registration_system_backend_fe_go/index.html`
- Delete: `registration_system_backend_fe_go/eslint.config.js`
- Delete: `registration_system_backend_fe_go/src/main.tsx`
- Delete: `registration_system_backend_fe_go/src/vite-env.d.ts`

**Interfaces:**
- Consumes: Existing page modules under `src/pages`, which remain temporarily routable during staged migration.
- Produces: `ADMIN_API_BASE_URL`, `API_PROXY_TARGET`, `ADMIN_PUBLIC_PATH`, `ADMIN_ROUTE_BASE`; scripts `dev`, `type-check`, `lint`, `build`, `build:nginx`, `test`, and `test:e2e`.

- [ ] **Step 1: Record the official template baseline outside the repository**

Run:

```bash
template_dir=$(mktemp -d)
git clone --depth=1 --branch v6.0.2 https://github.com/ant-design/ant-design-pro.git "$template_dir/ant-design-pro"
cd "$template_dir/ant-design-pro"
node scripts/simple.js
git status --short
```

Expected: the clone is at `v6.0.2`, `simple.js` removes demo page groups, and no file from the temporary directory is copied wholesale over business code.

- [ ] **Step 2: Replace dependency and script definitions**

Set exact runtime dependencies for React 19, antd 6.4.5, icons 6, ProComponents 3, React Query 5, antd-style 4, dayjs, and `@umijs/max` 4. Add Tailwind 4, PostCSS, Biome 2, TypeScript 6, Jest, Playwright, and `@ant-design/cli` 6.5.3 as development dependencies. Remove Vite, React Router, the antd v5 React patch, ESLint, and their plugins after all page imports are migrated in Task 7.

Use these scripts:

```json
{
  "dev": "cross-env UMI_ENV=dev ADMIN_API_BASE_URL=/go-api max dev --host 0.0.0.0",
  "type-check": "tsc --noEmit",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "build": "cross-env NODE_ENV=production ADMIN_PUBLIC_PATH=/ ADMIN_ROUTE_BASE=/ max build",
  "build:nginx": "cross-env NODE_ENV=production ADMIN_PUBLIC_PATH=/registration-admin/ ADMIN_ROUTE_BASE=/registration-admin/ max build",
  "test": "jest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 3: Add Umi, theme, proxy, and route configuration**

Configure browser history, `hash`, `routePrefetch`, `manifest`, `layout`, antd `cssVar`, Chinese locale, and utoopack. Task 2 enables `initialState`, `access`, and `reactQuery` together with their runtime files so Task 1 remains buildable. Do not configure Umi request, Mock, OpenAPI, analytics, or template head scripts.

The proxy must be equivalent to:

```ts
export default {
  dev: {
    '/go-api': {
      target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:18080',
      changeOrigin: true,
      pathRewrite: { '^/go-api': '' },
    },
  },
};
```

- [ ] **Step 4: Add Biome, Tailwind, and global design variables**

Configure PostCSS with `@tailwindcss/postcss`. In `src/global.css`, import Tailwind and define only global page background, font fallback, stable root height, focus visibility, and brand CSS variables:

```css
@import "tailwindcss";

:root {
  --kt-brand: #28704b;
  --kt-brand-dark: #18211c;
  --kt-accent: #b7d93d;
  --kt-page-bg: #f3f6f4;
}

html,
body,
#root {
  min-height: 100%;
}
```

- [ ] **Step 5: Install and prove the new build entry works**

Run:

```bash
cd registration_system_backend_fe_go
bun install
bun run type-check
bun run build
```

Expected: dependencies resolve through `bun.lock`, Umi invokes utoopack, and the build emits `dist/`. If existing pages still require React Router during this staged task, retain that dependency until Task 7 rather than adding adapters.

- [ ] **Step 6: Commit the foundation without unrelated workspace files**

```bash
git add registration_system_backend_fe_go/package.json registration_system_backend_fe_go/bun.lock registration_system_backend_fe_go/config registration_system_backend_fe_go/biome.json registration_system_backend_fe_go/postcss.config.js registration_system_backend_fe_go/src/global.css registration_system_backend_fe_go/tsconfig.json registration_system_backend_fe_go/.gitignore
git add -u registration_system_backend_fe_go/vite.config.ts registration_system_backend_fe_go/tsconfig.app.json registration_system_backend_fe_go/tsconfig.node.json registration_system_backend_fe_go/index.html registration_system_backend_fe_go/eslint.config.js registration_system_backend_fe_go/src/main.tsx registration_system_backend_fe_go/src/vite-env.d.ts
git commit -m "build(admin): migrate frontend foundation to Pro v6"
```

### Task 2: Establish API, Authentication, Access, and Query Boundaries

**Files:**
- Modify: `registration_system_backend_fe_go/src/config/api.ts`
- Modify: `registration_system_backend_fe_go/src/api/client.ts`
- Modify: `registration_system_backend_fe_go/src/api/auth.ts`
- Modify: `registration_system_backend_fe_go/src/auth/token-storage.ts`
- Create: `registration_system_backend_fe_go/src/auth/session-expiry.ts`
- Create: `registration_system_backend_fe_go/src/app.tsx`
- Create: `registration_system_backend_fe_go/src/access.ts`
- Create: `registration_system_backend_fe_go/src/types/runtime.ts`
- Create: `registration_system_backend_fe_go/src/hooks/queries/keys.ts`
- Create: `registration_system_backend_fe_go/src/hooks/queries/useAuthQueries.ts`
- Create: `registration_system_backend_fe_go/src/config/api.test.ts`
- Create: `registration_system_backend_fe_go/src/auth/session-expiry.test.ts`
- Create: `registration_system_backend_fe_go/jest.config.ts`

**Interfaces:**
- Consumes: `AdminUser`, `AdminLoginResult`, `ApiResponse<T>`, existing auth endpoints, Umi `history` and initial state runtime.
- Produces: `AuthMode = "required" | "login" | "none"`; `request<T>(path, { auth, ...RequestInit })`; `RuntimeInitialState`; `access(initialState)`; `queryKeys`; `expireAdminSession()`.

- [ ] **Step 1: Write URL and session-expiry tests first**

Cover these exact assertions:

```ts
expect(buildApiUrl('', 'required', '/matches')).toBe('/api/admin/matches');
expect(buildApiUrl('/go-api/', 'login', '/auth/login')).toBe('/go-api/api/admin/auth/login');
expect(buildApiUrl('https://api.example.com/', 'none', '/health')).toBe('https://api.example.com/health');
expect(() => buildApiUrl('', 'required', '/api/admin/matches')).toThrow();
```

For session expiry, initialize a token, call `expireAdminSession()` twice, and assert the token is removed and the event is dispatched exactly once.

- [ ] **Step 2: Run focused tests and confirm the new interfaces are absent**

Run:

```bash
bun run test -- src/config/api.test.ts src/auth/session-expiry.test.ts --runInBand
```

Expected: FAIL because `buildApiUrl` and `expireAdminSession` do not exist.

- [ ] **Step 3: Implement the sole HTTP client**

Define:

```ts
export type AuthMode = 'required' | 'login' | 'none';

export interface RequestOptions extends RequestInit {
  auth?: AuthMode;
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T>;
```

`required` and `login` append `/api/admin`; `none` does not. Only `required` 401 calls `expireAdminSession`. A login 401 remains a normal `ApiError`. Keep JSON parsing and `code === 0` behavior unchanged.

- [ ] **Step 4: Implement Umi runtime state and access**

Define:

```ts
export interface RuntimeInitialState {
  currentAdmin: AdminUser | null;
  authBootstrapError: string | null;
  fetchCurrentAdmin: () => Promise<AdminUser | null>;
}
```

`getInitialState()` must preserve the token on network, 5xx, timeout, or parse failure, expose a retryable bootstrap error, and clear the token only for `ApiError.status === 401`. `access.ts` returns `isAuthenticated` and `isSuperAdmin` booleans.

Enable `initialState: {}`, `access: {}`, and `reactQuery: {}` in `config/config.ts` in the same step so no configured plugin points at a missing runtime module.

- [ ] **Step 5: Add stable query keys and auth query helpers**

Define keys as factory functions, not mutable arrays:

```ts
export const queryKeys = {
  health: ['health'] as const,
  admins: ['admins'] as const,
  teams: ['teams'] as const,
  team: (id: number) => ['teams', id] as const,
  teamMembers: (id: number) => ['teams', id, 'members'] as const,
  matches: (query: MatchListQuery) => ['matches', query] as const,
  match: (id: string) => ['matches', id] as const,
};
```

- [ ] **Step 6: Run focused and project checks**

```bash
bun run test -- src/config/api.test.ts src/auth/session-expiry.test.ts --runInBand
bun run type-check
bun run build
```

Expected: PASS; no Umi request runtime export exists; auth failures preserve valid tokens unless status is 401.

- [ ] **Step 7: Commit protocol and state boundaries**

```bash
git add registration_system_backend_fe_go/src/config registration_system_backend_fe_go/src/api registration_system_backend_fe_go/src/auth registration_system_backend_fe_go/src/app.tsx registration_system_backend_fe_go/src/access.ts registration_system_backend_fe_go/src/types/runtime.ts registration_system_backend_fe_go/src/hooks registration_system_backend_fe_go/jest.config.ts
git commit -m "feat(admin): establish Pro v6 runtime boundaries"
```

### Task 3: Build ProLayout, Login, Dashboard, and Access Pages

**Files:**
- Modify: `registration_system_backend_fe_go/config/defaultSettings.ts`
- Modify: `registration_system_backend_fe_go/config/routes.ts`
- Modify: `registration_system_backend_fe_go/src/app.tsx`
- Create: `registration_system_backend_fe_go/src/components/BrandMark.tsx`
- Create: `registration_system_backend_fe_go/src/components/AuthBootstrapError.tsx`
- Create: `registration_system_backend_fe_go/src/hooks/queries/useSystemQueries.ts`
- Modify: `registration_system_backend_fe_go/src/pages/LoginPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/DashboardPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/AccessPage.tsx`
- Create: `registration_system_backend_fe_go/src/pages/ForbiddenPage.tsx`
- Create: `registration_system_backend_fe_go/src/pages/NotFoundPage.tsx`
- Delete: `registration_system_backend_fe_go/src/components/AppShell.tsx`
- Delete: `registration_system_backend_fe_go/src/auth/AuthProvider.tsx`
- Delete: `registration_system_backend_fe_go/src/auth/ProtectedLayout.tsx`
- Delete: `registration_system_backend_fe_go/src/auth/auth-context.ts`
- Delete: `registration_system_backend_fe_go/src/auth/useAuth.ts`
- Delete: `registration_system_backend_fe_go/src/App.tsx`

**Interfaces:**
- Consumes: `RuntimeInitialState`, `useModel('@@initialState')`, `queryKeys.health`, `loginAdmin`, `getHealth`, `expireAdminSession`.
- Produces: ProLayout runtime navigation, authenticated redirect handling, `useHealthQuery()`, route-level 403/404 UI.

- [ ] **Step 1: Query exact antd APIs before editing UI**

```bash
bunx -p @ant-design/cli@6.5.3 antd info ConfigProvider --version 6.4.5 --format json
bunx -p @ant-design/cli@6.5.3 antd token Layout --version 6.4.5 --format json
bunx -p @ant-design/cli@6.5.3 antd info Result --version 6.4.5 --format json
```

- [ ] **Step 2: Configure the brand theme and ProLayout**

Use `navTheme: 'realDark'`, `layout: 'mix'` or side layout only if it preserves the dense navigation, `colorPrimary: '#28704b'`, `borderRadius: 6`, CSS variables, and filled controls. Render the `KT` mark, Chinese menu names, current username, and an icon logout action. Do not render SettingDrawer, docs links, version menus, language menus, background illustrations, or a marketing footer.

- [ ] **Step 3: Migrate login and redirect safety**

Read `redirect` from the query string, accept only values starting with `/` but not `//`, strip the route base before internal navigation, and default to `/`. Use `LoginForm`, `ProFormText`, and `ProFormText.Password`; preserve placeholders `管理员账号` and `密码` for E2E stability.

- [ ] **Step 4: Migrate dashboard to one health query**

Implement `useHealthQuery()` with `retry: false` and manual `refetch`. Display only online/offline/checking state, measured latency, last checked time, and retry. Move API base, `/health`, `/api/admin`, Bearer JWT, and route-contract rows to AccessPage.

- [ ] **Step 5: Add bootstrap, 403, and 404 error states**

`AuthBootstrapError` receives `message` and `onRetry`. It must not clear the token. `ForbiddenPage` and `NotFoundPage` use Result with explicit navigation buttons and no nested cards.

- [ ] **Step 6: Verify shell behavior**

```bash
bun run type-check
bun run lint
bun run build
```

Start the dev server and verify `/login`, `/`, `/access`, `/403`, and `/404` render without React Router imports or blank pages.

- [ ] **Step 7: Commit the application shell**

```bash
git add registration_system_backend_fe_go/config registration_system_backend_fe_go/src/app.tsx registration_system_backend_fe_go/src/components registration_system_backend_fe_go/src/hooks/queries/useSystemQueries.ts registration_system_backend_fe_go/src/pages
git add -u registration_system_backend_fe_go/src/App.tsx registration_system_backend_fe_go/src/auth
git commit -m "feat(admin): migrate shell and access pages to Pro v6"
```

### Task 4: Migrate Match Queries, Lists, Forms, and Detail

**Files:**
- Create: `registration_system_backend_fe_go/src/hooks/queries/useMatchQueries.ts`
- Create: `registration_system_backend_fe_go/src/utils/match-list-query.ts`
- Create: `registration_system_backend_fe_go/src/utils/match-list-query.test.ts`
- Modify: `registration_system_backend_fe_go/src/pages/MatchListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchFormPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/matchLabels.ts`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

**Interfaces:**
- Consumes: Existing match API functions and DTOs, `queryKeys.matches`, `queryKeys.match`, Umi `history`, ProTable, ProForm.
- Produces: `parseMatchListQuery(search): MatchListQuery`; `serializeMatchListQuery(query): string`; match query and mutation hooks.

- [ ] **Step 1: Add URL query tests**

Test default `page=1`, `page_size=20`, supported status values, trimmed search text, invalid numeric fallback, and stable serialization that omits defaults.

- [ ] **Step 2: Run the URL tests and verify failure**

```bash
bun run test -- src/utils/match-list-query.test.ts --runInBand
```

Expected: FAIL because the parser and serializer are absent.

- [ ] **Step 3: Implement match queries and mutations**

Provide `useMatchesQuery`, `useMatchQuery`, `useCreateMatchMutation`, `useUpdateMatchMutation`, `useUpdateMatchStatusMutation`, and `useDeleteMatchMutation`. Successful mutations invalidate the exact list and/or detail keys they affect.

- [ ] **Step 4: Convert MatchListPage to controlled ProTable**

Use URL-derived query input, React Query `data`, `isFetching`, `error`, and `refetch`. Pass `data.items`, `data.total`, and controlled pagination to ProTable. Keep create, view, edit, cancel, delete, super-admin restriction, accessible labels, and mobile column reduction. Do not use ProTable `request`.

- [ ] **Step 5: Convert MatchFormPage to ProForm**

Replace React Router hooks with Umi `history` and `useParams`. Preserve all mode-dependent fields, team option search, quick create confirmation, date serialization, coordinates, edit restrictions, and create/update payloads. Confirm ProForm APIs against installed v3 type declarations.

- [ ] **Step 6: Convert MatchDetailPage**

Use PageContainer, Descriptions, and controlled ProTable for groups. Preserve edit, cancel, delete, permission, retry, and route behavior.

- [ ] **Step 7: Extend E2E for URL state and payload preservation**

Add assertions that filters change the query string, reload restores filters, and new/edit submit bodies retain the existing JSON field names and ISO date strings.

- [ ] **Step 8: Verify and commit matches**

```bash
bun run test -- src/utils/match-list-query.test.ts --runInBand
bun run type-check
bun run lint
bun run build
bun run test:e2e -- --grep "比赛"
```

```bash
git add registration_system_backend_fe_go/src/hooks/queries/useMatchQueries.ts registration_system_backend_fe_go/src/utils registration_system_backend_fe_go/src/pages/MatchListPage.tsx registration_system_backend_fe_go/src/pages/MatchFormPage.tsx registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx registration_system_backend_fe_go/src/pages/matchLabels.ts registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts
git commit -m "feat(admin): migrate match workflows to Pro v6"
```

### Task 5: Migrate Team and Member Management

**Files:**
- Create: `registration_system_backend_fe_go/src/hooks/queries/useTeamQueries.ts`
- Modify: `registration_system_backend_fe_go/src/pages/TeamListPage.tsx`
- Modify: `registration_system_backend_fe_go/src/components/TeamMemberManager.tsx`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

**Interfaces:**
- Consumes: Existing team API functions and DTOs, `queryKeys.teams`, `queryKeys.team`, `queryKeys.teamMembers`.
- Produces: Team list/detail/member/candidate query hooks and CRUD/profile/role/captain mutation hooks.

- [ ] **Step 1: Define query and invalidation behavior**

Create hooks for team lists, a single team, members, candidates, create/update/delete, add/update/remove member, update player profile, and set captain. Each mutation invalidates only the team list, team detail, members, or candidates keys changed by the operation.

- [ ] **Step 2: Convert TeamListPage**

Use controlled ProTable with the API's full list, local keyword/status filters, ModalForm for create/edit, and Drawer for detail. Preserve accessible labels and delete constraints. Do not add fake server pagination.

- [ ] **Step 3: Split TeamMemberManager by responsibility while migrating**

Keep `TeamMemberManager.tsx` as orchestration only. Extract focused components if the migrated file would remain over roughly 600 non-declarative lines: member table, add-member form, profile form, and captain actions. Each extracted component receives typed values and callbacks and must not call API functions directly.

- [ ] **Step 4: Preserve member and captain business actions**

Keep profile updates, add/remove, role updates, set/cancel captain, current captain constraints, confirmation prompts, and distinct semantic action colors. Mutations provide loading state per active action and visible real error messages.

- [ ] **Step 5: Run team E2E and verify**

```bash
bun run type-check
bun run lint
bun run build
bun run test:e2e -- --grep "球队|成员|队长"
```

- [ ] **Step 6: Commit team migration**

```bash
git add registration_system_backend_fe_go/src/hooks/queries/useTeamQueries.ts registration_system_backend_fe_go/src/pages/TeamListPage.tsx registration_system_backend_fe_go/src/components registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts
git commit -m "feat(admin): migrate team management to Pro v6"
```

### Task 6: Migrate Administrator Management and Permission Routes

**Files:**
- Create: `registration_system_backend_fe_go/src/hooks/queries/useAdminQueries.ts`
- Modify: `registration_system_backend_fe_go/src/pages/AdminListPage.tsx`
- Modify: `registration_system_backend_fe_go/config/routes.ts`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`

**Interfaces:**
- Consumes: `listAdmins`, `createAdmin`, `queryKeys.admins`, Umi access `isSuperAdmin`.
- Produces: `useAdminsQuery()`, `useCreateAdminMutation()`, route-level super-admin enforcement.

- [ ] **Step 1: Add admin hooks and controlled ProTable**

Use the full list API as controlled data. Use ModalForm for username, password, and confirm-password; omit confirm-password from the API payload. Invalidate `queryKeys.admins` after create.

- [ ] **Step 2: Enforce permission at route and component boundaries**

Set the `/admins` route access rule to `isSuperAdmin`, hide its menu item for ordinary admins, and keep the page-level Result fallback for direct component testing. Never rely on menu hiding as authorization.

- [ ] **Step 3: Add permission E2E**

Mock ordinary and super admins separately. Assert ordinary admins cannot navigate to admin management and receive 403 on a direct URL; assert super admins can create an administrator with the unchanged `{ username, password }` payload.

- [ ] **Step 4: Verify and commit administrators**

```bash
bun run type-check
bun run lint
bun run build
bun run test:e2e -- --grep "管理员|权限"
```

```bash
git add registration_system_backend_fe_go/src/hooks/queries/useAdminQueries.ts registration_system_backend_fe_go/src/pages/AdminListPage.tsx registration_system_backend_fe_go/config/routes.ts registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts
git commit -m "feat(admin): migrate administrator access to Pro v6"
```

### Task 7: Integrate Ant Design MCP and Remove the Old Stack

**Files:**
- Create: `.codex/config.toml`
- Preserve/verify: `registration_system_backend_fe_go/.agents/skills/antd/SKILL.md`
- Modify: `registration_system_backend_fe_go/AGENTS.md`
- Modify: `registration_system_backend_fe_go/README.md`
- Modify: `registration_system_backend_fe_go/.env.example`
- Modify: `README.md`
- Modify: `registration_system_backend_fe_go/package.json`
- Modify: `registration_system_backend_fe_go/bun.lock`
- Delete: `registration_system_backend_fe_go/src/styles.css`

**Interfaces:**
- Consumes: Final installed antd 6.4.5, Bun `bunx`, Codex project config.
- Produces: MCP server `antd`; current project documentation; no Vite, React Router, antd v5 patch, or ESLint references in active frontend files.

- [ ] **Step 1: Add project-scoped MCP configuration**

Write:

```toml
[mcp_servers.antd]
command = "bunx"
args = ["-p", "@ant-design/cli@6.5.3", "antd", "mcp", "--version", "6.4.5", "--lang", "zh"]
startup_timeout_sec = 30
```

Merge with an existing project `.codex/config.toml` if one appears; do not overwrite unrelated settings.

- [ ] **Step 2: Verify the skill and update durable instructions**

Keep the generated Ant Design skill and its managed AGENTS block. Update the active technology stack to Umi Max, antd 6, ProComponents 3, React Query, Tailwind, antd-style, Biome, utoopack, Node 20+, and Bun. Replace the React Router lazy-loading instruction with Umi route/access guidance.

- [ ] **Step 3: Update environment and README contracts**

Replace Vite variables with:

```dotenv
ADMIN_API_BASE_URL=/go-api
API_PROXY_TARGET=http://127.0.0.1:18080
ADMIN_PUBLIC_PATH=/
ADMIN_ROUTE_BASE=/
```

Document production same-origin API behavior, `build:nginx`, route base, and the required Nginx fallback.

- [ ] **Step 4: Remove final old-stack dependencies and imports**

Search:

```bash
rg -n "react-router-dom|@ant-design/v5-patch|import\.meta\.env|VITE_|vite|eslint|src/styles\.css" registration_system_backend_fe_go --glob '!bun.lock'
```

Remove active-code hits, React Router, the v5 patch, Vite, and ESLint dependencies. Historical specs/plans may retain historical text.

- [ ] **Step 5: Verify CLI and MCP startup**

```bash
cd registration_system_backend_fe_go
bunx -p @ant-design/cli@6.5.3 antd list --version 6.4.5 --format json
bunx -p @ant-design/cli@6.5.3 antd doctor --format json
bunx -p @ant-design/cli@6.5.3 antd usage ./src --format json
bunx -p @ant-design/cli@6.5.3 antd lint ./src --format json
cd ..
codex mcp list
```

Expected: CLI commands exit 0, report antd 6.4.5, and `codex mcp list` shows enabled server `antd`. A running Codex client may require restart before tools appear in the current task.

- [ ] **Step 6: Commit only migration-owned documentation hunks**

Stage `.codex/config.toml`, package files, skill files, `.env.example`, and clean source deletions normally. For already-dirty README/AGENTS files, stage only the migration hunks; do not include unrelated user changes.

```bash
git commit -m "chore(admin): integrate antd MCP and remove Vite stack"
```

### Task 8: Verify Root and Nginx Builds, E2E, and Visual Quality

**Files:**
- Modify: `registration_system_backend_fe_go/playwright.config.ts`
- Modify: `registration_system_backend_fe_go/e2e/admin-match-flow.spec.ts`
- Create: `registration_system_backend_fe_go/e2e/admin-routing.spec.ts`
- Create: `registration_system_backend_fe_go/scripts/serve-dist.mjs`
- Modify: `registration_system_backend_fe_go/package.json`

**Interfaces:**
- Consumes: Final root and Nginx builds, all application routes and mocked API contracts.
- Produces: Repeatable root-path and `/registration-admin/` verification, desktop/mobile screenshots, zero known uncaught browser errors.

- [ ] **Step 1: Add a deterministic history-fallback dist server**

`serve-dist.mjs` must serve files below a supplied route base and fall back to that base's `index.html` for extensionless browser routes. It must reject paths outside the dist root and accept `--port` and `--base` arguments.

- [ ] **Step 2: Add Nginx-equivalent routing E2E**

Build with `bun run build:nginx`, start the dist server at `/registration-admin/`, then directly open and reload `/registration-admin/matches/11111111-1111-4111-8111-111111111111?tab=groups#roster`. Mock auth and match APIs, assert the detail heading renders after both loads, asset requests remain under the route base, and an unknown path renders 404.

- [ ] **Step 3: Run the complete quality gate**

```bash
cd registration_system_backend_fe_go
bun install
bun run test -- --runInBand
bun run type-check
bun run lint
bun run build
bun run build:nginx
bun run test:e2e
bunx -p @ant-design/cli@6.5.3 antd doctor --format json
bunx -p @ant-design/cli@6.5.3 antd usage ./src --format json
bunx -p @ant-design/cli@6.5.3 antd lint ./src --format json
git diff --check
```

- [ ] **Step 4: Inspect desktop and mobile screenshots**

Capture login, dashboard, matches list/form/detail, teams/member management, administrators, access, 403, and 404 at `1440x1000` and `390x844`. Check for blank rendering, horizontal overflow, clipped text, inaccessible operations, unstable tables, oversized drawers/modals, and inconsistent status colors.

- [ ] **Step 5: Inspect browser runtime evidence**

Require zero uncaught page exceptions. Review console errors and failed requests; distinguish expected mocked failures from application regressions. Verify ProLayout collapse, mobile drawer, login redirect, token restoration, auth expiry, query retry, and all mutation payloads.

- [ ] **Step 6: Run the final old-stack and demo-code audit**

```bash
rg -n "react-router-dom|@ant-design/v5-patch|import\.meta\.env|VITE_|@ant-design/plots|@ant-design/x|cloudflare|mock/|openAPI|SettingDrawer" registration_system_backend_fe_go --glob '!bun.lock'
```

Expected: no active source, config, package, README, or AGENTS hits. Historical migration documents outside the subproject are allowed.

- [ ] **Step 7: Commit verification infrastructure and final fixes**

```bash
git add registration_system_backend_fe_go/playwright.config.ts registration_system_backend_fe_go/e2e registration_system_backend_fe_go/scripts/serve-dist.mjs registration_system_backend_fe_go/package.json registration_system_backend_fe_go/bun.lock
git commit -m "test(admin): verify Pro v6 migration"
```

## Self-Review Results

- Spec coverage: every architecture, auth, API, route, design, MCP, documentation, build, E2E, and visual requirement maps to Tasks 1-8.
- Placeholder scan: the plan contains no deferred implementation markers; conditional file splitting in Task 5 has an explicit threshold and component boundaries.
- Type consistency: `AuthMode`, `RuntimeInitialState`, `request<T>`, `queryKeys`, URL query helpers, and query hooks are defined before consumers.
- Scope: all tasks contribute to one independently deployable Go management frontend migration; no Go backend or unrelated frontend work is included.
