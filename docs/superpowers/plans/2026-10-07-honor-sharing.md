# Honor Sharing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline. User explicitly authorized complete implementation and publication; no repeat approval is needed.

**Goal:** Ship own annual honor sharing, three free poster backgrounds, album export and team acquisition landing.
**Architecture:** A persisted consent-to-share UUID identifies team/user/year; additive team-module application, ports, PostgreSQL/sqlc and HTTP adapters provide authoritative public fields. A WeChat/MinIO adapter generates actual mini codes. Mini page/composables compose images and expose existing join/create flows.
**Tech Stack:** Go 1.26.5, Gin, pgx/sqlc, MinIO, uni-app Vue 3 TypeScript.
**Spec:** docs/superpowers/specs/2026-10-07-honor-sharing.md

## Global Constraints

- Preserve all old routes/DTOs and existing invite permissions.
- UTC timestamps; year from Beijing time; free presets only.
- No formula or personal contact data in honor responses.
- Follow current mini design tokens and review-mode creation gate.
- Isolated schema integration tests only; publish exact origin/main.

## Review Focus

- Forged/invalid share UUID and another user's code generation must fail.
- Removed members/frozen teams/users must not leak an old honor view.
- Rapid background changes or account changes must not export stale posters.
- Real QR code generation errors and denied album permission must have recoverable feedback.
- Long names, missing avatar, zero score, and midnight Beijing New Year must render valid output.

### Task 1: Authoritative share routes and mini codes

**Files:** team ports/application/adapters, db migration 41 + team.sql, bootstrap, new shared/adapters/wechatcode.
**Interfaces:** Issue(actor,teamID) → share view; Resolve(actor,code) → view; MiniCode(actor,code,environment) → public PNG URL. View contains team/user IDs, names/avatar, year/points/rank/member flags/share code.

- [ ] Write application tests for own issue, nonmember refusal, invalid code, recipient membership, wrong-owner code generation and Beijing year rollover; run RED.
- [ ] Add additive schema/query and sqlc adapter; implement use case and thin authenticated handler.
- [ ] Write WeChat HTTP response tests, implement stable-token cache, error handling, code generation/storage.
- [ ] Add isolated-schema repository and HTTP tests; run related race tests, vet, API build.
- [ ] Commit backend after checks pass; record evidence in ledger.

### Task 2: Share entry, poster picker and landing

**Files:** mini src/api/honors.ts, pages/honors (page/state/composable/components), poster backgrounds/composition utility, pages.json, AvatarPreviewDialog + home/match contexts and team stats.
**Interfaces:** Consume Task 1 routes; native share path `/pages/honors/index?code=...`; QR homepage scene redirects to same page. Self source `teamId` issues share; visitor source `code` resolves it.

- [ ] Implement separate share composition and page state; keep backgrounds out of mini bundle.
- [ ] Add both self-entry points and precise team context on own avatars; backend remains final membership check.
- [ ] Wire native friend share, theme preview, real code canvas export, save-to-album handling, join password/profile flow, create gate.
- [ ] Test meaningful shared state/routing utilities; run type check and production mini/H5 build; verify mobile design.
- [ ] Commit front end, asset originals, prompts and design documents; record checks.

### Task 3: Review and release

- [ ] Fresh whole-change review; fix significant issues with covering tests.
- [ ] Merge/push main preserving unrelated files; apply migration 41 and deploy exact commit through jd script after check.
- [ ] Verify live health/new routes/schema and uploaded image checksums.
- [ ] Run mp:release; commit/push allocated version files if needed, then repeat upload.
- [ ] Report actual backend deployment, mini upload version and formal-publication limitations.
