# MinIO Image Cache Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. User explicitly requested implementation; continue through verification and existing authorized release workflow.

**Goal:** All first-party MinIO images in the mini program reuse persisted local files with bounded downloads and cache storage.

**Architecture:** Generalize the existing honor cache into a URL policy and shared file cache. A render composable resolves dynamic native image sources; share and canvas callers use the same resolver. Preserve native image elements and compiled native sharing hooks.

**Tech Stack:** uni-app, Vue 3, TypeScript, Bun tests.

**Spec:** docs/superpowers/specs/2026-10-09-minio-image-cache.md

## Global Constraints

- Download timeout 15000 ms; ordinary TTL 7 days; content hash URLs remain until eviction.
- Maximum 8 MiB / 128 persisted files, LRU eviction; never delete another feature's saved files.
- Preserve published APIs, native image geometry, external/local URL behavior and H5 HTTP caching.

## Review Focus

- Deleted files must redownload; quota errors must retain usable temporary files.
- Expired ordinary images refresh; failed refresh retains an existing stale file.
- Concurrent URLs cannot overwrite cache index or defeat storage limits.
- Late download callbacks and changed/unmounted views cannot replace current sources.
- External images and packaged assets must bypass cache; old honor files migrate without another download.

### Task 1: Cache policy and persistent cache

**Files:** utils/minioImagePolicy.ts, utils/minioImageCache.ts, utils/honorBackgroundCache.ts, utils/__tests__/minioImageCache.test.ts

**Interfaces:** resolveMinioImage(url: string): Promise<string>; retainMinioImage(url): release callback; createMinioImageCache(options?) with get(url) and retain(url).

- [x] Add meaningful tests for persistence, TTL/hash, coalescing, timeout/abort, failed refresh, quota, URL changes, migration and LRU.
- [x] Implement cache policy, bounded file cache and legacy facade; run related tests.

### Task 2: Display, share and canvas integration

**Files:** composables/useMinioImages.ts, composables/useShareCover.ts, native dynamic-image SFCs, utils/shareCompose.ts, utils/honorPosterCompose.ts.

**Interfaces:** useMinioImages().minioImageSrc(src); useShareCover exposes cached shareImageUrl in addition to original shareCoverUrl.

- [x] Test source-change/unload guards and sharing stale callback guards.
- [x] Connect dynamic images while retaining native elements, styles and existing events; canvas loaders resolve the same cache.
- [x] Audit all dynamic src and compiled native share callbacks.

### Task 3: Verify and release

- [x] Run focused cache/composable/share/honor tests, type check, MP and H5 builds.
- [x] Inspect diff and concurrency/storage failure behavior; document actual device limitations.
Release sequence after the verified implementation commit: commit/push clean main, preflight/deploy frontend H5 and upload MP using the unified release script. Record actual commit and release results in the existing release ledger.

**Verification:** 109 related tests / 666 assertions pass. Type check and production MP/H5 test builds pass; all five compiled share pages retain native friend/timeline hooks. H5 bundle excludes the filesystem-cache index. Final independent review found two issues, both fixed with failing-then-passing regressions: mounted image leases prevent removal of paths still in use, and failed index writes cannot leave untracked persisted files. Share and canvas paths acquire the same leases. Physical-device filesystem persistence, WeChat preview/sharing and measured loading time have not been verified.
