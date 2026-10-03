# 移动管理 App 首版代码审查归档

最终产品代码评审已完成。全分支初审发现的 F1–F4 在一个修复波次内处理，随后独立 scoped review 确认 **全部 ADDRESSED、未发现新增破坏或越界变更、无开放发现项**。最终通过的产品源码为 `445a426ad49b39482872d3db9bdfc81fa7b0eae5`；初审的 **With fixes** 是历史结论，已由修复后的通过结论取代。

本文件归档全分支初审、唯一修复波次的 scoped verdict 和实现验证报告。scoped review 针对初审发现及修复 diff 的潜在破坏，不表示重新逐行评审未变化的全分支代码。下方原文保留各阶段事实，其中的 `With fixes`、`pending SCOPED REVIEW` 与建议处理事项只描述当时阶段，不是当前待办。

| 最终发现项 | 状态 | 修复与验证 |
| --- | --- | --- |
| F1 系统返回绕过未保存/提交保护 | ADDRESSED | nested maybePop；真实 AdminApp 的 dirty 取消/确认、进行中 POST、普通弹窗/干净页/root 回归。 |
| F2 明确 422 拒绝永久锁住资金 scope | ADDRESSED | 只识别完整、确定未写入的校验拒绝；submit/retry 在 expectedKey 安全删除成功后解锁，其他不确定响应仍保留原请求；新收款不得晚于北京时间今天。 |
| F3 登录失败清空输入 | ADDRESSED | 表单 teardown epoch 与请求 generation 分离；失败保留输入，退出/环境切换清空，旧响应隔离保持。 |
| F4 候选输入逐字请求 | ADDRESSED | 300ms 可取消 debounce，立即搜索取消 timer，dispose 不发延迟请求，输入立即清除选择。 |

验证基线：完整测试 **251/251**、analyze 无问题、140 文件格式检查 0 改动；最终真实入口 APK/iOS simulator 构建通过（8.3s/12.6s），已保存、安装启动并核对身份/版本。scoped reviewer 独立核对日志、产物 SHA 与两张最终 main 登录截图；并未重跑套件或把离线证据当作真实账号验收。

当前交付仍为 Android debug APK 与 iOS simulator App。真实管理员登录/恢复、受保护线上读请求/权限/业务写入、真实账户 token 生命周期、未遮挡的 iOS 普通文字键盘、商店签名/发行及真机性能矩阵仍未验证；未来 Kotlin 升级按已记录裁定另行迁移。构建、截图、产物最新大小/hash、15 条裁定及全部限制见 [验收记录](admin-app-v1-acceptance.md)。范围依据 [设计](superpowers/specs/2026-10-03-admin-app-v1-design.md) 与 [已完成实施计划](superpowers/plans/2026-10-03-admin-app-v1.md)。未合并、push 或发布。

## 修复后独立 scoped review 原文（当前通过结论）

- **F1 — System back bypasses every nested form's unsaved/submitting guard** — **ADDRESSED**. `registration_system_admin_app/lib/app/session_gate.dart:63` now forwards platform back through nested `maybePop`, respecting the route's pop disposition. The actual AdminApp regressions in `test/app/final_gate_regression_test.dart:139` cover dirty cancel/confirm; `:163` dispatches a real team POST held by a barrier before system back and keeps the form mounted; `:185` covers ordinary dialog dismissal, clean exit and root bubbling. The corrected in-flight baseline independently failed 0/1; the final covering tests passed.
- **F2 — A definite 422 rejection permanently locks this member's fund scope** — **ADDRESSED**. `lib/core/network/api_client.dart:111` classifies only HTTP422/code422/nonempty string message/present null data. `lib/features/team_fund/data/http_fund_repository.dart:51` converts only that certainty into pure-domain `FundRejected`; malformed/inconsistent envelopes and all other failures retain the original action. Both submit and explicit retry use `lib/features/team_fund/application/fund_controller.dart:197`; current-generation checks precede cleanup and publishing, `:205` passes the original expected key, and `:207` clears in-memory pending only after secure removal succeeds. Exceptions fall back to pending in submit/retry. The unchanged store contract at `data/secure_pending_fund_store.dart:138` serializes scope comparison/delete and throws on a different key, so cleanup fails closed. New drafts are limited by Beijing today at `application/fund_controller.dart:104`, `domain/fund_models.dart:66` and `presentation/fund_form_page.dart:71`; structural validation remains usable for legacy future-date restore/retry. `test/team_fund/definite_rejection_test.dart:42` covers newer-key protection, `:69` rejects a new future date before storage/HTTP and then corrects it, `:113` restores and retries the legacy future payload, `:153` covers submit/retry cleanup failure, and `:203` onward covers retained original key/payload for 401/503/network/timeout/409/malformed and inconsistent responses. `receipt_date_test.dart:6` covers the UTC16:01→Beijing next-day boundary.
- **F3 — The actual login gate clears credentials on every failed login** — **ADDRESSED**. `lib/app/session_gate.dart:79` keys the form by `loginFormEpoch`, independent of per-attempt request generation. `lib/features/session/application/session_controller.dart:134` retains generation-based stale-response protection; `:177` increments the form epoch only at explicit logout/teardown. Environment replacement also reconstructs the keyed gate (`lib/app/admin_app.dart:116`, examined only for this call contract). Actual AdminApp regression `test/app/final_gate_regression_test.dart:69` preserves both rejected inputs, corrects the password, logs in and verifies logout reset; `:44` covers explicit signed-out teardown without an intermediate rendered frame; `:104` covers environment reset.
- **F4 — Candidate search sends one HTTP request per keystroke instead of debouncing** — **ADDRESSED**. `lib/features/members/presentation/member_candidate_page.dart:78` cancels/reschedules a 300ms timer and clears selection immediately; `:199` prevents selecting the stale list while the timer is active. Refresh/retry/keyboard submit use `:70`, cancelling the timer before immediate search; `:87` cancels on disposal. Controller request-generation behavior remains intact. `test/widgets/candidate_debounce_test.dart:11` verifies latest-only typing, selection clearing and immediate refresh without a delayed duplicate; `:49` verifies disposal sends no delayed query.
- **New Breakage in the Fix Diff:** None found. No new Critical, Important or Minor finding in this bounded fix package.
- **Out-of-Scope Observations:** None. The existing live-account, ordinary iOS keyboard, store/real-device and future Kotlin limits remain explicitly unverified/adjudicated; they were not re-graded or expanded. The deliberately pending review status requires clerical closure after this gate, not another implementation wave.
- **Check — scope:** Read the supplied `review-68db178..445a426.diff` once in three contiguous passes (1–490, 491–985, 986–1464), original F1–F4, fix report, constraints and focus. No git diff recomputation, product/index/branch mutation, subagent, production request or Flutter command. Changed-file reads and named store/session/environment/date/backend-contract checks were limited to the findings and potential fix breakage.
- **Check — F2 server certainty:** Read `registration_system_go/internal/teamfund/application/manual_fund_service.go:85` and `:170`, `application/recharge_date.go:15`, and `internal/shared/adapters/httpapi/response.go:40`/`:67`. Request validation precedes persistence and maps to the complete 422 envelope. `internal/teamfund/adapters/postgres/repository.go:352` checks same-key credit/consume replay before membership validation; `:425`/`:440` checks reversal replay before rejecting changed original state. Transaction error exits defer rollback (`:349`, `:421`), and success follows commit (`:401`, `:479`); notification failures do not turn a committed result into422. 409 key conflict stays outside authoritative validation. This confirms the scoped certainty classification against actual Go code, rather than treating every validation-looking response as safe cleanup.
- **Check — existing validation evidence:** Read final-fix-red.log (11 passed/9 failed), final-fix-inflight-red.log (0/1 failed), final-fix-green.log (22 passed), final-fix-full-test.log (251 passed), final-fix-analyze.log (No issues found) and final-fix-format-check.log (140 files,0 changed). Covering regression implementations match the claimed behaviors. No concrete remaining uncertainty required a focused new run; the suite/analyzer/native builds were not rerun per the scoped-review instruction.
- **Check — native/documentation evidence:** Read successful main-build logs (Android8.3s/iOS12.6s), install/launch logs, main identity fixtureClassesFound=[] and native build metadata1.0.0(1)/error=null/loading=false. Independently recomputed the saved APK, Runner and simulator ZIP SHA-256 values; each matches current identity.json and tracked acceptance. Viewed both final-fix main-login screenshots: readable dark login fields/button and safe areas, no visible overflow. These are native delivery evidence, not live-authenticated acceptance or system-back behavior proof. Extracted all Ruling lines from progress.md and acceptance; exact order/content equality is true,15/15.
- **Fix round / Assessment:** **All four findings addressed, no new Critical/Important breakage.** The scoped final fix gate passes for `445a426ad49b39482872d3db9bdfc81fa7b0eae5`. No open findings from this review; parent may close the pending review records while preserving the documented acceptance limits.

## 全分支初审原文（历史 With fixes，已关闭 F1–F4）

# Final whole-branch senior review

- Reviewed range: `b91ded645f5854ba0ebff17ba1fe99b3ab886983` → `68db1782d8cbec6ed52a7ed477f5167d025f1195`.
- Checkout: `/Users/carlwang/.codex/worktrees/admin-app-v1/registration_system`, branch `codex/admin-app-v1`.
- Scope: approved mobile admin v1 spec/plan, root/App AGENTS, actual whole-branch diff package `review-b91ded6..68db178.diff`, execution rulings, acceptance record and evidence. Reviewed in passes: composition/session/core; match domain/data/controllers/screens; teams/members; funds and cross-feature lifecycle; native configuration/documentation and targeted regression coverage. No git recomputation, product edits, production requests or subagents.
- Verdict: **With fixes**. Three Important findings and one Minor finding below. No Critical finding.

## Strengths

- The App is actually wired to the new Go contract through typed HTTP repositories. The active-team selector, match outcome-check read route, user-ID member navigation and team-fund routes are real destinations. The production main is separate from the fixture harness.
- `ProtectedWorkspace` owns per-generation controllers and the protected Navigator/ScaffoldMessenger. Synchronous retirement, stale request guards, `useRootNavigator: false` dialogs, and same-generation/admin fund currency checks address old-account response contamination. App-lifetime `AppStores` preserves pending-store serialization across A→B→A; expected-key removal prevents stale cleanup deleting a different action.
- Fund actions persist the exact key/payload before dispatch, preserve uncertain writes, and separate a confirmed write from failed history refresh. The post-success invalidation at `fund_controller.dart:198` closes the previously reported balance-read race. Int cents, Beijing wall-clock conversion and pure date semantics have dedicated boundaries.
- Domain/data/application/presentation boundaries are identifiable; production files remain under the approximately 600-line guideline. Known enum capabilities are conservative, captain assignment uses its dedicated route, and membership ID is distinguished from user ID.
- Native artifacts and acceptance limitations are honestly documented. Read the fresh controller logs: `controller-test-final.log` ends `+225: All tests passed!`; `controller-analyze-final.log` reports no issues. Android/iOS delivery logs show successful 26.7s/17.4s builds. Sampled actual native screenshots (`android-main-login-final.png`, `contact-ios-04.png`, `contact-android-helper-01.png`) corroborate native pages and the final helper wrapping. These do not substitute for authenticated live acceptance.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

#### F1 — [P2] System back bypasses every nested form's unsaved/submitting guard

- **File:** `registration_system_admin_app/lib/app/session_gate.dart:62-63`.
- The `NavigatorPopHandler` forwards a system back event to `workspace.navigatorKey.currentState?.pop(result)`. Direct `pop` bypasses the nested route's `PopScope.canPop`; `UnsavedGuard` only protects callers using the guarded pop path. Consequently Android system back silently closes a dirty form even though the app-bar back button/standalone guard tests behave correctly. The same forwarding also bypasses `blocked: submitting` on in-flight write pages, potentially losing their outcome UI.
- **Reproduction:** Real `AdminApp` with `WorkspaceTransport`: login → dashboard “创建球队” → enter `未保存球队` → `tester.binding.handlePopRoute()` → the `TeamFormPage` is gone and there is no discard confirmation. Focused `/tmp/admin_app_final_edge_test.dart`, test `system back preserves dirty team creation and asks confirmation`, exits RED with expected form count 1, actual 0. No product source was changed.
- **Fix:** Route system back through nested `maybePop(result)` (or equivalent that respects route pop disposition), preserving ordinary dialog dismissal and root/back behavior. Add a real-AdminApp system-back regression for dirty form cancel/confirm and for an in-flight write. Existing `test/widgets/unsaved_guard_test.dart` invokes nested `maybePop` directly and therefore does not cover this integration boundary.

#### F2 — [P2] A definite 422 rejection permanently locks this member's fund scope

- **File:** `registration_system_admin_app/lib/features/team_fund/application/fund_controller.dart:143-150`; the same unconditional retention also occurs at `:176-183` during explicit retry. Related entry point: `presentation/fund_form_page.dart:67-72`.
- Every execute failure becomes `pending` once the action was saved; only a successful result can remove it. The approved spec §7 explicitly requires clearing an authoritatively unexecuted validation rejection. There is an ordinary UI trigger: the receipt-date picker permits any date through year 9999, `FundDraft.validate` accepts future dates, while Go `internal/teamfund/application/recharge_date.go:17-18` returns validation “收款日期不能晚于今天” before calling the repository; `shared/adapters/httpapi/response.go:40-41` maps it to HTTP 422.
- After selecting a future receipt date, the app retains that immutable invalid payload, disables new credit/consume/reversal actions, and offers only retry of the same rejected request. Logout/restart restores the same lock. A correction to today's date cannot be submitted.
- **Reproduction:** `/tmp/admin_app_final_edge_test.dart`, test `authoritative unexecuted validation rejection clears pending and unlocks scope`, uses real `AppDependencies`/`HttpFundRepository`/`SecurePendingFundStore` and a UTF-8 HTTP 422 response. A valid-local draft with receipt date `9999-12-31` reaches HTTP; expected pending null, actual `PendingFundAction` (RED). No live write was performed.
- **Fix:** Explicitly classify authoritative no-write validation responses and clear with `expectedKey` only after successful secure removal; retain pending if cleanup fails. Keep 401, 5xx, network/timeouts, malformed success and ambiguous/conflicting keys conservative. Apply this to submit and retry, and prevent future dates using Beijing today in the form/domain boundary. Test definite rejection recovery plus cleanup failure and confirm existing uncertain-write retention remains intact.

#### F3 — [P2] The actual login gate clears credentials on every failed login

- **File:** `registration_system_admin_app/lib/app/session_gate.dart:77-78`; cause paired with `features/session/application/session_controller.dart:129-131`.
- `LoginPage` is keyed by `session.generation`, while `login()` increments generation before publishing the submitting state. Thus every attempt replaces the widget that owns its username/password controllers. A wrong password or network error leaves blank fields rather than preserving the user's input for correction/retry. This contradicts the planned failure behavior and is missed by testing `LoginPage` alone.
- **Reproduction:** `/tmp/admin_app_final_login_test.dart` mounts real `AdminApp` with a UTF-8 401 mock, enters fixture credentials and taps 登录. The error is displayed, but the username controller changes from `fixture-admin` to `''` (RED). The replacement also resets the password controller.
- **Fix:** Keep login-form identity stable during attempts in the same signed-out screen. Reset it at actual session/environment teardown, not the request generation used for stale-response protection. Retain the session generation checks themselves. Add an AdminApp-level failed-login test covering field retention and subsequent successful retry.

### Minor (Nice to Have)

#### F4 — [P3] Candidate search sends one HTTP request per keystroke instead of debouncing

- **File:** `registration_system_admin_app/lib/features/members/presentation/member_candidate_page.dart:134-136`, calling `application/member_controller.dart:128-139`.
- Every text change immediately invokes the candidate endpoint. Request-generation checks correctly reject stale results, but do not reduce request volume or avoid repeatedly replacing the list with loading while the operator types a name/phone. Approved spec §9 calls for debounced search.
- **Fix:** Debounce user typing with a short cancellable timer, clear the current selection immediately, retain explicit refresh/search as immediate actions, and dispose/cancel pending callbacks. A small behavior test should show a burst of typing produces one latest query and leaving the page sends no delayed request. No additional test was run to establish this direct call-path finding.

## Recommendations and verification boundaries

- Address these together as one bounded fix wave, then run the targeted regressions and the existing full suite/analyzer. The three added review repros are outside the checkout under `/tmp`; the implementer should promote appropriate regressions into the repository.
- The 225-test suite is valid evidence for what it tests, but does not cover the two real-App integration failures or definite fund rejection. Neither native screenshots nor successful builds exercise those behaviors.
- Rebuild/copy/hash the real-main delivery artifacts after product fixes; previous artifact hashes describe the reviewed head, not the eventual fixed source. Update the acceptance/final-review records after validation rather than treating the presently pending final status as a documentation defect.
- No broad new framework, backend/schema change, release-signing change or production data write is needed for these fixes.

## Declined to judge

Each considered behavior below is explicitly set aside for the executor's ruling; none is silently assumed to pass.

1. **Real administrator login/restore, live protected Go reads/permissions, and live business/fund writes:** no authorized credentials are available and production writes are forbidden for this task; acceptance correctly marks these unverified. Offline correctness is reviewed, but live end-to-end success is not asserted.
2. **Store signing/distribution and real-device/OS-version performance matrix:** the approved delivery is Android debug plus iOS simulator; release scaffolding's debug signature and simulator-only limitation are disclosed. These are not graded as current-scope product defects.
3. **iOS ordinary text keyboard interaction while the first-run QuickPath tutorial covers it:** the acceptance record discloses the system overlay and only claims numeric keyboard verification. I did not infer a successful ordinary-keyboard result or a product defect from an obstructed screenshot; later unobstructed native acceptance remains necessary.
4. **Future Built-in Kotlin/AGP migration:** the executor's twelfth ruling explicitly retains the currently verified Flutter 3.44.2/AGP 8.12.1 configuration and records the future warning. No upgrade is requested by this branch; current Android compilation is evidenced, and future-version behavior was not judged.

## Assessment

**Ready to merge? With fixes.**

The architectural and API integration work is substantial and generally coherent, with credible native evidence and careful uncertain-write isolation. However, actual App navigation bypasses draft protection, failed login loses input, and a normal validation rejection can permanently block a member's fund operations; these reproducible failures need correction before the v1 branch is considered complete.

## 修复实现与验证报告原文（历史送审阶段，已完成审查）

# Final unified fix wave — F1–F4

Base: 68db1782d8cbec6ed52a7ed477f5167d025f1195; checkout /Users/carlwang/.codex/worktrees/admin-app-v1/registration_system, branch codex/admin-app-v1. All four final-review findings addressed in one bounded wave by this implementer; no subagent/reviewer, backend/schema changes, live credential read, production write, merge, push or publish. Final gate remains **pending SCOPED REVIEW** for controller.

Read root/App AGENTS, approved design and plan, scratch constraints.md, complete final-review.md, progress ledger and both /tmp review repros. Applied systematic debugging and verification-before-completion. Reviewed actual Go manual_fund_service.go, recharge_date.go, postgres repository.go (manual actions/replay/rollback), and shared/adapters/httpapi/response.go: KindValidation maps HTTP422/code422/message/data=null. Request/date validation precedes dispatch; repository validation exits before commit and deferred rollback covers transaction mutations. Notification errors are logged rather than changing committed success into422. 409 idempotency conflict remains ambiguous and never clears pending.

## Changes and regression coverage

- F1 SessionGate forwards platform back via nested maybePop so route PopScope is respected. Actual AdminApp tests cover dirty form with cancel/confirm, true in-flight team POST with a barrier (not a standalone harness), ordinary nested dialog dismissal, clean form exit and root event bubbling.
- F3 LoginPage key uses a distinct SessionController loginFormEpoch, incremented only on actual logout/teardown, while existing request generation still increments per attempt and protects stale responses. Actual AdminApp tests cover rejected login retaining both inputs, corrected successful retry, logout reset, explicit signed-out logout without an intermediate rendered bootstrap frame, and development environment reset.
- F2 ApiClient marks only a complete HTTP422/code422/nonempty message/data=null as authoritative validation; HTTP repository maps this to pure domain FundRejected. FundController _execute handles both submit/retry, removes with expectedKey, and unlocks only after secure removal succeeds. Deletion failure retains exact pending; a replacement key cannot be removed. Other failures retain original key/payload:401,503,network,timeout,409,malformed code0 DTO,malformed422,inconsistent422 and business-only422.
- New submissions validate receipt date using injected now → BeijingClock. FundDraft validate(today:) is pure Dart and validates date keys against Beijing today; structural validate() deliberately remains usable by persisted-action store and repository so an old future-date pending is readable and sent unchanged for authoritative server confirmation. Regressions cover UTC16:01→Beijing next day, valid past/today, future/malformed dates, no persistence/HTTP on a new future date, corrected date then dispatch, and old9999-12-31 pending restored then cleared after real HTTP422 mock. Date picker max is Beijing today. Existing date-picker regression now selects legal day1 instead of future day15 and asserts actual lastDate.
- F4 300ms cancellable page timer; selection clears on each text edit and stale-result selection is disabled while debounce waits. Explicit refresh/retry/keyboard search cancel timer and query immediately. Page disposal cancels callback. Widget tests prove a typing burst issues one latest query, refresh is immediate with no delayed duplicate, and dispose sends no query.

Production max file size remains454lines; all<600. HTTP JSON/certainty classification in core/data, domain exception/rules pure, application handles pending lifecycle, page handles timer/date picker. No speculative Go route/field and no business balance calculation added.

## RED/GREEN and final verification

All Flutter commands serial, App CWD /Users/carlwang/.codex/worktrees/admin-app-v1/registration_system/registration_system_admin_app. Logs under build/acceptance/admin-app-v1/logs. Flutter /Users/carlwang/development/flutter/bin/flutter; dart same bin.

```sh
flutter test test/app/final_gate_regression_test.dart test/widgets/candidate_debounce_test.dart test/team_fund/definite_rejection_test.dart
# Definitive baseline RED exit1,11 passed/9 failed, final-fix-red.log.
flutter test test/app/final_gate_regression_test.dart --plain-name 'AdminApp system back cannot abandon in-flight write'
# Corrected actual write-barrier test against original HEAD gate: RED exit1,0/1,final-fix-inflight-red.log.
flutter test test/app/final_gate_regression_test.dart test/widgets/candidate_debounce_test.dart test/team_fund/definite_rejection_test.dart test/team_fund/receipt_date_test.dart
# Initial focused GREEN exit0,22/22,final-fix-green.log; later added4 cases included in final full suite.
dart format lib test
# final-fix-format.log exit0,140files; final format verification below0changed.
flutter analyze
# final-fix-analyze.log exit0,No issues found,1.9s.
flutter test
# final-fix-full-test.log exit0,251/251,20s (225 baseline +26 behavior regressions).
dart format lib test
# final-fix-format-check.log exit0,140files0changed.
git diff --check
# final-fix-diff-check.log exit0.
```

Test-development corrections: initial temporary invocation referenced an absent new test file (fixed before definitive baseline RED); receipt test first used unavailable package:test, replaced with existing flutter_test runner without adding a dependency. Initial in-flight test tapped page title, not the real 保存球队 button; corrected and independently demonstrated original gate RED as above. First broad suite failed only existing future-day15 picker assertion (249pass/1fail); updated that behavior regression to legitimate day1 plus date-limit assertion and reran full251pass. These corrections are test fixture issues/newly intended date limits, not unresolved product failures.

## Native delivery rebuilt after final lib changes

```sh
env JAVA_TOOL_OPTIONS='-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=7897 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=7897' /Users/carlwang/.codex/worktrees/admin-app-v1/build-tools/with-android-env.sh /Users/carlwang/development/flutter/bin/flutter build apk --debug -t lib/main.dart
# final-fix-android-main-build.log exit0,8.3s.
/Users/carlwang/development/flutter/bin/flutter build ios --simulator -t lib/main.dart
# final-fix-ios-main-build.log exit0,12.6s.
```

Preserved copies under build/delivery/admin-app-v1; identity.json overwritten. Main-debug APK197744157bytes SHA25694328b98c038ce2dc719243306bdad36a9bcf54a62f7c29660b5f2bc8bed61fb. Main simulator App174869137bytes; Runner SHA25619d833788b63d180708cfe93116d8e3fc099bef9c2d20e79d54c07d7cfc03422. Main simulator ZIP53445157bytes SHA2569f7e0728a14b493446f92d7cd8d7effdf595c074d99925fb74c88153898ac76b. Old hashes replaced in tracked acceptance. Bundles/signing unchanged.

Actual adb emulator-5554 install-r/force-stop/start and clean task simulator995EC227-265B-49B2-AD05-7F73AE3EB766 simctl install/launch all exit0; logs final-fix-android/ios-install.log and launch.log. Captured screenshots final-fix-android-main-login.png and final-fix-ios-main-login.png, actually inspected both using view_image: clear dark login title, fields/button, top/bottom safe areas normal, no visible overflow/error. No valid credentials entered and no login request sent to production. Existing fixture matrix retained; no broad visual rerun needed for these behavior fixes. No new ordinary-iOS-keyboard success assertion.

Read-only VM class list final-fix-android/ios-main-identity.json has fixtureClassesFound=[] on both; no NativeSceneHarness/_NativeSceneHarnessState/WorkspaceTransport. final-fix-android/ios-native-buildinfo.json verifies1.0.0(1),error=null,loading=false. Android URL discovered from task adb logcat, forwarded local57891; iOS URL discovered from simulator log show. Flutter attach initially waited without connection and was stopped; no attach success claimed. Direct VM probe then succeeded on the actual already-installed running main process. Runtime discovery logs final-fix-android-runtime.log/final-fix-ios-runtime.log.

## Acceptance, rulings and limits

Tracked acceptance updated with fresh251count, format/analyzer/build logs, artifact hashes/bytes, actual screenshot/identity summary, F1–F4 behavior and pending SCOPED REVIEW status. All15 Ruling lines extracted from progress.md and copied verbatim in ledger order; automated exact-order equality assertion passed. All4 declined items already explicitly adjudicated by parent (first3 latest rulings; item4 existing12thKotlin ruling), preserved.

Still unverified: authorized live administrator login/restore/protected reads/permissions/writes, real-account token write/delete lifecycle, unobstructed ordinary iOS text keyboard, store signing/distribution, real-device/OS performance matrix. Debug APK/simulator only. Future Built-in Kotlin warning remains with currently verified Flutter3.44.2/AGP8.12.1 and upgrade revalidation requirement. No global tooling/host lock/account/tutorial/distribution credential change. Source/package limits unchanged.

Final self-review: all four requested paths and regression tests match actual composition, no local-domain validation deletes a potentially executed pending action, secure cleanup fails closed, newer keys untouched, stale session responses still guarded, explicit query cancels debounce, all production files<600, API/schema untouched. Controller receives this wave for one scoped review.

Commit: `445a426ad49b39482872d3db9bdfc81fa7b0eae5` (single coherent final fix wave). Fresh git status --short empty after commit; binaries/logs/screens and scratch report remain ignored in place. Final review status unchanged: pending SCOPED REVIEW.
