# Go Admin Pro v6 Performance Design

## Context

The Go admin frontend has migrated from Ant Design 5, ProComponents 2, and
Vite to Ant Design 6, ProComponents 3, Umi Max, and utoopack. The migration
improved design consistency and application structure, but the first
production measurement did not show an end-to-end performance improvement.

The reproducible pre-optimization comparison on the same machine was:

| Metric | V5 baseline | Current Pro v6 |
| --- | ---: | ---: |
| Clean production build | 3.95 s | 6.98 s |
| Initial gzip assets | 229,128 B | 462,183 B |
| Median login FCP | 388 ms | 416 ms |
| Median login transfer | 921,281 B | 1,986,755 B |

The Ant Design CLI also reports 88 performance errors across 15 source files.
All findings are default imports from `antd/es/*`; the CLI requires public
named imports from `antd`.

## Goals

1. Preserve all existing routes, permissions, API behavior, visual design,
   Bun commands, root deployment, and `/registration-admin/` deployment.
2. Clear all Ant Design CLI performance findings.
3. Keep ProLayout and ProComponents out of the public login route's initial
   dependency graph.
4. Keep authenticated business pages route-lazy and load their dependencies
   only when needed.
5. Add a deterministic production asset budget that prevents the login entry
   from regressing unnoticed.
6. Beat the V5 login baseline for initial gzip assets and match or improve its
   median FCP under the same local measurement harness.

## Non-goals

- Replacing Ant Design Pro, ProComponents, Umi Max, utoopack, React Query, or
  Bun.
- Changing backend APIs, DTOs, permissions, authentication semantics, routes,
  or page design.
- Introducing a separate login application or MPA deployment.
- Claiming that production build time must be faster than Vite; the primary
  performance target is user-visible loading.

## Chosen Approach

Use four layers of optimization.

### 1. Public Ant Design imports

Replace `antd/es/*` default imports with public named imports from `antd`.
Keep icon imports aligned with the public `@ant-design/icons` entry. This makes
the source conform to the CLI's supported optimization contract and lets the
configured bundler own module transformation and tree shaking.

### 2. Public-route dependency boundary

Umi already generates the ProLayout route as a lazy route component, and
`/login` correctly declares `layout: false`. The remaining public-entry
coupling comes from two application-owned sources:

- `/login` imports ProComponents `LoginForm` and `ProFormText` even though its
  UI only needs standard Form, Input, and Button behavior.
- global `src/app.tsx` statically imports admin-only session actions,
  bootstrap-error UI, and forbidden-page UI for the layout runtime config.

Keep the Umi ProLayout plugin and its generated lazy route. Replace the login
form with equivalent Ant Design Form controls, preserving its validation,
loading, autocomplete, redirect, and error behavior. Move admin-only runtime
UI behind lazy component boundaries so those modules load with the admin
layout rather than with every public route.

Public routes remain outside the admin layout:

- `/login`
- `/403`
- `/404`

Authenticated routes remain children of the generated admin layout and retain
their existing paths, access declarations, menu metadata, session-expiry
behavior, and redirect behavior. The existing layout runtime contract keeps
menu filtering and navigation while lazy admin-only components own current
admin display, logout, bootstrap error handling, and forbidden rendering.

`routePrefetch` already defaults to `none`; keep that behavior explicit rather
than introducing eager route downloads.

### 3. Remove unused global runtime payload

The application does not use Umi locale APIs, but the locale plugin injects
react-intl, Moment, Moment locales, and EventEmitter dependencies into every
route. Disable that plugin and preserve Ant Design's Chinese component copy by
returning `zh_CN` from the existing Ant Design runtime hook.

The empty global `antd.appConfig` also enables Ant Design's App provider and
loads message, modal, and notification runtime code on the public route. No
page uses `App.useApp`, so remove the provider. Keep each page's existing
context-safe APIs such as `Modal.useModal` unchanged.

Ant Design 6 supports modern browsers. Set `BABEL_POLYFILL=none` in the shared
dev and build commands so Umi does not inject its broad core-js entry. This is
an explicit browser-support boundary; supporting older browsers requires
restoring targeted polyfills and recalibrating the budget.

### 4. Measured asset budget

Add a small Node script that reads the generated production entry assets,
calculates gzip size with the standard `zlib` API, prints a structured summary,
and fails when the public entry exceeds its budget. The script must use
generated build metadata or generated HTML as the source of truth, rather than
hard-coded chunk names.

The enforced budget is 220,000 gzip bytes, below the measured V5 value of
229,128 bytes. The optimized clean build is 175,345 bytes, leaving 44,655
bytes (20.3%) of headroom.

The Nginx production E2E test records the scripts requested before the login
page settles, maps those chunk basenames back through `dist/stats.json`, and
asserts that the resulting module graph contains no ProComponents module.

## Runtime Flow

1. Umi loads the minimal application runtime and the matched public page.
2. `/login` renders with Ant Design Form controls, without importing
   ProComponents or business-page components.
3. A successful login navigates to the requested sanitized admin route.
4. Umi loads the existing generated ProLayout chunk, lazy admin-runtime UI,
   and then the matched business-page chunk.
5. The layout runtime reads `@@initialState`, enforces session behavior, and
   configures ProLayout using the existing route metadata.
6. Session expiry clears React Query and initial state, then redirects to the
   login page using the existing safe redirect utility.

## Error Handling

- Initial admin bootstrap failures continue to render the retryable bootstrap
  error view for authenticated routes.
- HTTP 401 continues to expire the local session and redirect safely.
- Public routes never require the admin layout chunk to display an error.
- The asset-budget command fails with an actionable message when build output
  or metadata is missing, malformed, or over budget.

## Verification

The implementation is complete only when all of the following pass:

- `bun run type-check`
- `bun run lint`
- `bun run test -- --runInBand`
- `bun run build`
- `bun run build:nginx`
- `bun run test:e2e`
- `bun run test:e2e:nginx`
- `bunx antd lint ./src --only performance --format json` reports 0 findings
- the production asset-budget command passes
- root and subpath login routes render and load their image assets
- authenticated routes preserve menus, access control, logout, and redirects
- the same seven-run cold-context benchmark shows initial gzip below the V5
  baseline and median FCP no worse than the V5 baseline

## Measured Result

Both versions were exported to separate temporary directories, installed from
their own lock files, built sequentially, served on separate local ports, and
measured by alternating targets across seven fresh Chromium contexts.

| Metric | V5 baseline | Optimized Pro v6 | Delta |
| --- | ---: | ---: | ---: |
| Clean production build | 3.88 s | 5.96 s | +2.08 s |
| Initial uncompressed assets | 709,001 B | 519,722 B | -189,279 B |
| Initial gzip assets | 229,128 B | 175,345 B | -53,783 B |
| Median DOMContentLoaded | 28 ms | 38 ms | +10 ms |
| Median FCP | 388 ms | 380 ms | -8 ms |
| Median load | 28 ms | 52 ms | +24 ms |
| Median request count | 10 | 16 | +6 |
| Median transfer | 921,281 B | 931,062 B | +9,781 B |

The phase meets its two user-visible gates: initial gzip is 23.5% below V5
and median FCP is 8 ms faster. It does not make utoopack's production build
faster than Vite, and DCL, load, request count, and transfer remain regressions
that must be stated rather than hidden.

## Rollout

The work stays on `codex/admin-pro-v6` and updates the existing migration pull
request. Changes are committed in reviewable steps: design/plan, import
contract, runtime boundary, performance budget, and final verification.
