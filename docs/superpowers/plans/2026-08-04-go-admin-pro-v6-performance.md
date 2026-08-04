# Go Admin Pro v6 Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Pro v6 admin login entry smaller and faster than the measured V5 baseline while preserving all routes, permissions, behavior, design, and deployment modes.

**Architecture:** Keep Umi's already-lazy ProLayout route, remove ProComponents and admin-only runtime UI from the public login dependency graph, and let utoopack transform supported public Ant Design imports. Enforce the initial-entry size with a gzip budget derived from `dist/stats.json`; verify the login dependency boundary by mapping browser-requested chunks back to stats modules, then record cold-context browser timing with a reusable Playwright script.

**Tech Stack:** Bun 1.3, Node.js 20+, Umi Max 4.6.51, utoopack 1.4.3, React 19, Ant Design 6.4.5, ProComponents 3.1.12-0, Jest 30, Node test runner, Playwright 1.61, Biome 2, TypeScript 6.

## Global Constraints

- Preserve Bun for package management and scripts; Node.js 20+ remains the Umi/CLI runtime.
- Preserve every current URL, access declaration, API request, redirect, menu rule, root build, and `/registration-admin/` build.
- Keep the Umi ProLayout plugin and authenticated ProComponents pages.
- Do not modify Go or Rust backend code.
- Do not stage pre-existing `AGENTS.md`, `CLAUDE.md`, README, architecture-doc, or `.turbopack/` changes.
- The optimized login entry must be below the V5 baseline of 229,128 gzip bytes.
- The seven-run cold-context median FCP must be no worse than the V5 baseline of 388 ms on the same machine and harness.

---

### Task 1: Add a deterministic entry-asset budget

**Files:**
- Create: `registration_system_backend_fe_go/scripts/entry-budget.mjs`
- Create: `registration_system_backend_fe_go/scripts/entry-budget.test.mjs`
- Modify: `registration_system_backend_fe_go/package.json`

**Interfaces:**
- Consumes: utoopack `dist/stats.json` with `entrypoints.<name>.assets` entries and generated files under `dist/`.
- Produces: `readEntrypointAssets({ statsPath, entryName }): string[]`, `measureEntrypointGzip({ distPath, assets }): { assetBytes, gzipBytes }`, and CLI command `bun run perf:budget`.

- [ ] **Step 1: Write failing Node tests for stats validation and gzip totals**

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  measureEntrypointGzip,
  readEntrypointAssets,
} from "./entry-budget.mjs";

test("reads named utoopack entry assets and measures each gzip stream", async () => {
  const root = await mkdtemp(join(tmpdir(), "entry-budget-"));
  const distPath = join(root, "dist");
  await mkdir(distPath);
  await writeFile(join(distPath, "umi.js"), "const answer = 42;");
  await writeFile(join(distPath, "umi.css"), ".root{display:block}");
  await writeFile(
    join(distPath, "stats.json"),
    JSON.stringify({
      entrypoints: { umi: { assets: [{ name: "umi.js" }, { name: "umi.css" }] } },
    }),
  );

  const assets = await readEntrypointAssets({
    statsPath: join(distPath, "stats.json"),
    entryName: "umi",
  });
  const result = await measureEntrypointGzip({ distPath, assets });

  assert.deepEqual(assets, ["umi.js", "umi.css"]);
  assert.equal(
    result.gzipBytes,
    gzipSync("const answer = 42;").length + gzipSync(".root{display:block}").length,
  );
});
```

- [ ] **Step 2: Run the test and verify the missing module fails**

Run: `node --test scripts/entry-budget.test.mjs`

Expected: FAIL because `entry-budget.mjs` does not exist.

- [ ] **Step 3: Implement structured stats reading, gzip measurement, and the CLI budget failure**

```js
export async function readEntrypointAssets({ statsPath, entryName }) {
  const stats = JSON.parse(await readFile(statsPath, "utf8"));
  const entry = stats.entrypoints?.[entryName];
  if (!entry?.assets?.length) {
    throw new Error(`Entrypoint ${entryName} has no generated assets in ${statsPath}`);
  }
  return entry.assets.map((asset) =>
    typeof asset === "string" ? asset : asset.name,
  );
}

export async function measureEntrypointGzip({ distPath, assets }) {
  let assetBytes = 0;
  let gzipBytes = 0;
  for (const asset of assets) {
    const content = await readFile(join(distPath, asset));
    assetBytes += content.length;
    gzipBytes += gzipSync(content, { level: 9 }).length;
  }
  return { assetBytes, gzipBytes };
}
```

The CLI uses defaults `--dist dist`, `--stats dist/stats.json`, `--entry umi`, and `--max-gzip 220000`, prints JSON, and exits nonzero when `gzipBytes > maxGzipBytes`.

- [ ] **Step 4: Add package scripts and verify red/green behavior**

```json
{
  "test:performance": "node --test scripts/*.test.mjs",
  "perf:budget": "node scripts/entry-budget.mjs --max-gzip 220000"
}
```

Run: `bun run test:performance`

Expected: PASS.

Run: `bun run build && bun run perf:budget`

Expected before optimization: FAIL and report approximately 462,183 gzip bytes.

- [ ] **Step 5: Commit the budget harness**

```bash
git add registration_system_backend_fe_go/package.json \
  registration_system_backend_fe_go/scripts/entry-budget.mjs \
  registration_system_backend_fe_go/scripts/entry-budget.test.mjs
git commit -m "test(admin): enforce Pro v6 entry budget"
```

### Task 2: Adopt the Ant Design public import contract

**Files:**
- Modify: `registration_system_backend_fe_go/src/app.tsx`
- Modify: `registration_system_backend_fe_go/src/components/AuthBootstrapError.tsx`
- Modify: `registration_system_backend_fe_go/src/components/TeamMemberManager.tsx`
- Modify: `registration_system_backend_fe_go/src/components/team-members/*.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/*.tsx`

**Interfaces:**
- Consumes: Ant Design 6 public exports and `@ant-design/icons` public exports.
- Produces: identical component values and types with no `antd/es/*` or `@ant-design/icons/es/*` source imports.

- [ ] **Step 1: Record the failing CLI performance gate**

Run: `bunx antd lint ./src --only performance --format json`

Expected: 88 performance findings across 15 files.

- [ ] **Step 2: Replace deep imports with grouped named imports**

Example transformation:

```tsx
import Button from "antd/es/button";
import Tooltip from "antd/es/tooltip";
```

becomes:

```tsx
import { Button, Tooltip } from "antd";
```

Icon imports become grouped public imports:

```tsx
import { LockOutlined, UserOutlined } from "@ant-design/icons";
```

Preserve type-only imports with `type`, including `FormProps`, table columns,
and component prop types.

- [ ] **Step 3: Verify CLI, TypeScript, and Jest**

Run: `bunx antd lint ./src --only performance --format json`

Expected: `summary.performance` is 0.

Run: `bun run type-check && bun run test -- --runInBand`

Expected: 9 suites and 37 tests pass.

- [ ] **Step 4: Commit the import contract**

```bash
git add registration_system_backend_fe_go/src
git commit -m "perf(admin): use public Ant Design imports"
```

### Task 3: Remove ProComponents and admin-only UI from the public entry

**Files:**
- Create: `registration_system_backend_fe_go/src/components/AdminLayoutRuntime.tsx`
- Modify: `registration_system_backend_fe_go/src/app.tsx`
- Modify: `registration_system_backend_fe_go/src/pages/LoginPage.tsx`
- Modify: `registration_system_backend_fe_go/config/config.ts`

**Interfaces:**
- Consumes: `RuntimeInitialState`, `@@initialState`, React Query client, existing token/session helpers, `AuthBootstrapError`, and `ForbiddenPage`.
- Produces: lazy exports `AdminLayoutChildren`, `AdminLayoutSessionActions`, and `AdminLayoutForbidden`; login form values remain `{ username: string; password: string }`.

- [ ] **Step 1: Add a failing E2E assertion for the login dependency boundary**

Extend `e2e/admin-routing.spec.ts` production-dist coverage to record script
URLs requested before the first login render. Read `dist/stats.json`, map the
requested script basenames to `modules[].chunks`, and assert that the resulting
login module graph contains no `node_modules/@ant-design/pro-components/`
module. Use the production build server so source maps and dev chunks do not
affect the assertion.

Run: `bun run build && bun run test:e2e:nginx`

Expected before implementation: FAIL because the login route loads
ProComponents `LoginForm`.

- [ ] **Step 2: Replace ProComponents login controls with Ant Design Form**

```tsx
<Form<LoginFormValue> layout="vertical" onFinish={submit} requiredMark={false}>
  <Form.Item
    name="username"
    label="账号"
    rules={[{ required: true, message: "请输入管理员账号" }]}
  >
    <Input
      prefix={<UserOutlined />}
      autoComplete="username"
      placeholder="管理员账号"
    />
  </Form.Item>
  <Form.Item
    name="password"
    label="密码"
    rules={[{ required: true, message: "请输入密码" }]}
  >
    <Input.Password
      prefix={<LockOutlined />}
      autoComplete="current-password"
      placeholder="密码"
    />
  </Form.Item>
  <Button
    block
    htmlType="submit"
    loading={loginMutation.isPending}
    size="large"
    type="primary"
  >
    登录
  </Button>
</Form>
```

- [ ] **Step 3: Move admin-only layout UI into one lazy module**

Move `AuthSessionBridge` and `SessionActions` from `src/app.tsx` into
`AdminLayoutRuntime.tsx`. Add `AdminLayoutForbidden` that renders the existing
`ForbiddenPage`. In `src/app.tsx`, define all three with `React.lazy(() =>
import("./components/AdminLayoutRuntime").then(...))` and render them inside
`Suspense fallback={null}` from the existing `layout()` callbacks.

Keep `getInitialState`, menu filtering, safe navigation, and page-change
redirects in `src/app.tsx` because they are runtime contracts rather than UI
dependencies.

- [ ] **Step 4: Make route prefetch behavior explicit**

```ts
routePrefetch: {
  defaultPrefetch: "none",
},
```

- [ ] **Step 5: Verify behavior and the budget**

Run: `bun run type-check && bun run lint && bun run test -- --runInBand`

Expected: all commands pass.

Run: `bun run build && bun run perf:budget`

Expected: entry gzip is below 220,000 bytes.

Run: `bun run test:e2e:nginx`

Expected: root/subpath login, static image, deep link, access, and lazy-boundary checks pass.

- [ ] **Step 6: Commit the public-entry boundary**

```bash
git add registration_system_backend_fe_go/config/config.ts \
  registration_system_backend_fe_go/e2e/admin-routing.spec.ts \
  registration_system_backend_fe_go/src/app.tsx \
  registration_system_backend_fe_go/src/components/AdminLayoutRuntime.tsx \
  registration_system_backend_fe_go/src/pages/LoginPage.tsx
git commit -m "perf(admin): isolate the public login entry"
```

### Task 4: Add a reproducible cold-login measurement tool

**Files:**
- Create: `registration_system_backend_fe_go/scripts/measure-login-performance.mjs`
- Create: `registration_system_backend_fe_go/scripts/measure-login-performance.test.mjs`
- Modify: `registration_system_backend_fe_go/package.json`

**Interfaces:**
- Consumes: one or more CLI targets in `name=url` form and an optional `--runs` integer.
- Produces: JSON containing per-target samples and medians for DOMContentLoaded, FCP, load, request count, and transfer bytes.

- [ ] **Step 1: Write failing unit tests for argument parsing and median selection**

```js
test("median returns the middle sorted sample", () => {
  assert.equal(median([416, 388, 400, 420, 396]), 400);
});

test("parseTargets accepts explicit name=url pairs", () => {
  assert.deepEqual(parseTargets(["v5=http://127.0.0.1:5191/login"]), [
    { name: "v5", url: "http://127.0.0.1:5191/login" },
  ]);
});
```

- [ ] **Step 2: Run the tests and verify missing exports fail**

Run: `node --test scripts/measure-login-performance.test.mjs`

Expected: FAIL because the measurement module does not exist.

- [ ] **Step 3: Implement the seven-run alternating cold-context harness**

Use Playwright Chromium. Create a new browser context per sample, respond to
`/api/*` and `/health` with the same 401 JSON, alternate target order each run,
wait for `networkidle`, collect Navigation Timing and Paint Timing entries,
close each context, then print JSON medians and samples.

- [ ] **Step 4: Add and verify the package command**

```json
{
  "perf:measure": "node scripts/measure-login-performance.mjs"
}
```

Run: `bun run test:performance`

Expected: budget and measurement utility tests pass.

- [ ] **Step 5: Commit the measurement tool**

```bash
git add registration_system_backend_fe_go/package.json \
  registration_system_backend_fe_go/scripts/measure-login-performance.mjs \
  registration_system_backend_fe_go/scripts/measure-login-performance.test.mjs
git commit -m "test(admin): add cold login performance harness"
```

### Task 5: Run full verification, document results, and update the PR

**Files:**
- Modify: `registration_system_backend_fe_go/README.md`
- Modify: `docs/superpowers/specs/2026-08-04-go-admin-pro-v6-performance-design.md`

**Interfaces:**
- Consumes: optimized build output, V5 baseline build, budget JSON, and performance harness JSON.
- Produces: documented commands, measured before/after table, final thresholds, commits, and updated remote PR.

- [ ] **Step 1: Build clean V5 and optimized V6 copies**

Export `c16fc1892d26977dd86ddfcfce0b606e8bed1eb7` and current `HEAD` into
separate `mktemp -d` directories, run `bun install --frozen-lockfile`, and run
their production builds sequentially with `/usr/bin/time -lp`.

- [ ] **Step 2: Serve both production builds and measure seven cold contexts**

Serve both with `scripts/serve-dist.mjs` on separate ports. Run:

```bash
bun run perf:measure -- \
  v5=http://127.0.0.1:5191/login \
  v6=http://127.0.0.1:5192/login \
  --runs 7
```

Expected: optimized V6 entry gzip is below 229,128 bytes and median FCP is no
worse than 388 ms. Record actual results without rounding away regressions.

- [ ] **Step 3: Run the complete project verification**

```bash
bun install
bun run test:performance
bun run test -- --runInBand
bun run type-check
bun run lint
bun run build
bun run perf:budget
bun run build:nginx
bun run test:e2e
bun run test:e2e:nginx
bunx antd lint ./src --only performance --format json
git diff --check
```

Expected: all commands pass, CLI performance findings are 0, normal E2E has
16 passes plus environment-gated skips, and Nginx E2E passes both projects.

- [ ] **Step 4: Document startup, budget, benchmark method, and measured result**

Update the subproject README with `bun run perf:budget`, `bun run
perf:measure`, the same-machine comparison rules, and the final before/after
table. Replace the design document's provisional 220,000-byte value with the
final enforced threshold and measured margin.

- [ ] **Step 5: Commit documentation and verification evidence**

```bash
git add registration_system_backend_fe_go/README.md \
  docs/superpowers/specs/2026-08-04-go-admin-pro-v6-performance-design.md
git commit -m "docs(admin): record Pro v6 performance results"
```

- [ ] **Step 6: Push and verify the existing pull request**

```bash
git push origin codex/admin-pro-v6
```

Verify GitHub PR #1 remains open, targets `main`, points to the new HEAD, and
is mergeable.
