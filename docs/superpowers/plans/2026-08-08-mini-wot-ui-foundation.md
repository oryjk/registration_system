# Mini Wot UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the mini-program workspace for incremental Wot UI adoption without changing existing page visuals or business behavior.

**Architecture:** Keep Wot UI as the mini-program runtime component dependency, and place the Open Wot MCP configuration at the monorepo root where Codex loads project tooling. Keep the Wot UI Skill and managed instructions inside `registration_system_mini`, where the uni-app code and component conventions live.

**Tech Stack:** uni-app, Vue 3, TypeScript, Bun, Wot UI v2, Open Wot CLI/MCP, Codex

## Global Constraints

- Preserve all existing Mock, authentication, environment, and documentation changes in the dirty worktree.
- Do not change page templates, page styles, API behavior, or business logic in this preparation task.
- Pin `@wot-ui/ui` to `2.3.0`, the newest release with an exact offline dataset in `@wot-ui/cli@1.0.6`.
- Pin the Open Wot MCP launcher to `@wot-ui/cli@1.0.6`.
- Keep existing MCP servers and existing `AGENTS.md` content intact.
- Verify both H5 and WeChat mini-program builds.

---

### Task 1: Upgrade the Runtime Component Dependency

**Files:**
- Modify: `registration_system_mini/package.json`
- Modify: `registration_system_mini/bun.lock`

**Interfaces:**
- Consumes: existing npm-based Wot UI easycom mapping in `registration_system_mini/src/pages.json`
- Produces: installed `@wot-ui/ui@2.3.0` dependency for later page-by-page migration

- [ ] **Step 1: Install the pinned Wot UI version**

Run: `bun add --exact @wot-ui/ui@2.3.0`

Expected: `package.json` and `bun.lock` resolve `@wot-ui/ui` to `2.3.0` without changing unrelated dependencies. Version `2.3.1` is intentionally deferred because Open Wot CLI `1.0.6` has no `2.3.1` dataset and the project does not use the QR Code component changed by that patch.

- [ ] **Step 2: Diagnose the runtime integration**

Run: `npx -y @wot-ui/cli@1.0.6 doctor .`

Expected: Wot UI, Vue, uni-app, TypeScript, and `node_modules` checks pass.

### Task 2: Integrate Version-Accurate AI Tooling

**Files:**
- Modify: `.codex/config.toml`
- Modify: `registration_system_mini/AGENTS.md`
- Verify: `registration_system_mini/.agents/skills/wot-ui-v2/SKILL.md`

**Interfaces:**
- Consumes: Open Wot `agent init` safe merge behavior
- Produces: root-level `mcp_servers.wot-ui`, mini-project Wot UI Skill, and managed Agent instructions

- [ ] **Step 1: Add the pinned MCP server at monorepo root**

Run: `npx -y @wot-ui/cli@1.0.6 agent init --client codex --scope project --with mcp --pin 1.0.6 --yes`

Expected: `.codex/config.toml` retains existing servers and adds only `mcp_servers.wot-ui` using `npx -y @wot-ui/cli@1.0.6 mcp`.

- [ ] **Step 2: Install or refresh mini-project Skill and instructions**

Run from `registration_system_mini`: `npx -y @wot-ui/cli@1.0.6 agent init --client codex --scope project --with skill,instructions --pin 1.0.6 --yes`

Expected: the existing Skill remains version-matched and `AGENTS.md` gains one managed Open Wot instruction block without altering existing guidance.

- [ ] **Step 3: Verify project tooling configuration**

Run from the monorepo root: `npx -y @wot-ui/cli@1.0.6 agent doctor --client codex --scope project --with mcp --timeout 30000`

Run from `registration_system_mini`: `npx -y @wot-ui/cli@1.0.6 agent doctor --client codex --scope project --with skill,instructions --timeout 30000`

Expected: files and MCP handshake pass; a restart or project trust requirement may remain as an explicit client action.

### Task 3: Verify Cross-Platform Build Health

**Files:**
- Verify only: `registration_system_mini/src/**`

**Interfaces:**
- Consumes: upgraded Wot UI runtime dependency and unchanged application code
- Produces: evidence that the preparation does not break H5 or WeChat builds

- [ ] **Step 1: Run Wot UI usage lint**

Run: `npx -y @wot-ui/cli@1.0.6 lint .`

Expected: no unknown Wot components or invalid basic usage.

- [ ] **Step 2: Run TypeScript validation**

Run: `bun run type-check`

Expected: exit code `0`.

- [ ] **Step 3: Build H5**

Run: `bun run build:h5`

Expected: exit code `0` and H5 output under `dist/build/h5`.

- [ ] **Step 4: Build WeChat mini-program**

Run: `bun run build:mp-weixin`

Expected: exit code `0` and mini-program output under `dist/build/mp-weixin`.

- [ ] **Step 5: Review the final diff**

Run: `git diff -- registration_system_mini/package.json registration_system_mini/bun.lock registration_system_mini/AGENTS.md .codex/config.toml`

Expected: only the pinned dependency, Wot MCP server, and managed Wot instructions are added; existing user edits remain intact.
