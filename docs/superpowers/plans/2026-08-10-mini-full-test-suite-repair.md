# Mini Full Test Suite Repair Implementation Plan

> **Goal:** Make the mini-program test suite portable across the main checkout and Git worktrees, update stale structural assertions to the current component boundaries, and restore a fully green verification baseline before merging the home match phase work.

## Scope

- Modify test infrastructure and stale tests under `registration_system_mini`.
- Change production code only if a focused failing test proves a real behavior gap.
- Keep the Rust backend read-only and do not modify the Go backend.
- Preserve the running H5 preview while repairing the suite.

## Task 1: Portable test source paths

1. Add `src/test/sourcePaths.ts` with helpers rooted at `src`, the mini project, and the workspace.
2. Replace hard-coded `/Users/carlwang/registration_system` paths in all affected tests.
3. Run `rg -n '/Users/carlwang/registration_system' src --glob '*test.ts'` and require zero matches.
4. Run `bun test` to expose only genuine stale assertions or behavior failures.

## Task 2: Session and navigation assertions

1. Repair stale assertions in session bootstrap, page fallback, back-button, and bottom-tab tests.
2. Assert current behavior and ownership boundaries rather than old implementation text.
3. Run the affected test files after each focused change.

## Task 3: Domain page integration assertions

1. Update challenge, activities, match creation, team management, team calendar, and user page tests to current component names and extracted modules.
2. Prefer observable behavior tests where modules can be imported without a uni-app runtime.
3. Keep source-level checks only where they validate build-time integration that is not practical to render in Bun.
4. Run each affected test file, then the complete suite.

## Task 4: Full verification

Run from `registration_system_mini`:

```bash
bun test
bun run type-check
bun run build:h5
bun run build:mp-weixin
git diff --check
```

Then verify the H5 preview in the browser at desktop and mobile widths, including console errors and horizontal overflow.

## Task 5: Review, commit, and merge

1. Review the final diff for accidental production changes and path leakage.
2. Commit the test repair separately as `test(mini): make full suite portable and current`.
3. Merge `codex/mini-home-match-phase-sections` into local `main` after all verification passes.
4. Re-run the relevant verification on `main` and report any unverified external state explicitly.
