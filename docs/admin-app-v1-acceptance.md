# 移动管理 App 首版验收记录

验收日期：2026-10-03。范围为已批准的 [设计](superpowers/specs/2026-10-03-admin-app-v1-design.md) 与 [实施计划](superpowers/plans/2026-10-03-admin-app-v1.md)。Task1–10 已实施并完成独立审查；最终全分支初审的 F1–F4 在一个修复波次后全部 ADDRESSED，scoped review 未发现新增破坏或越界变更。最终产品代码评审通过，源码基线 `445a426ad49b39482872d3db9bdfc81fa7b0eae5`，完整测试 251/251；初审及修复后的结论见 [代码审查归档](admin-app-v1-code-review.md)。本文的原生产物身份对应该修复源码，后续仅做文档闭环。

客户端首版已恢复，Android debug APK 和 iOS simulator App 可运行。**未完成真实账号验收**：没有提供管理员凭据，真实登录、受保护 Go 读接口与端到端业务操作未验证。没有向生产业务表写入验收数据。健康探测成功仅证明服务可达；离线 fixture 成功不证明线上账号权限、生产数据或服务端记账成功。

## 验证结果与首版边界

| 设计验收项 | 结果与证据 |
| --- | --- |
| 1. 登录、球队/成员、比赛创建/编辑、报名查询、状态/比分流程 | 离线 repository/controller/widget 测试通过，原生实际页面可显示与导航；真实管理员完整业务链未验证（无凭据）。报名只查花名册/状态，不增加报名修改功能。 |
| 2. 权限、取消/删除状态限制、未授权不假成功 | DTO 与 Go 路由/领域规则核对及行为测试通过；401/403、未知状态、删除结果不确定的恢复路径有测试。线上权限未验证。 |
| 3. 会员、收款/扣费/流水/合法冲正、幂等 | 规则、整数分、10,000 元上限、UTF-8 原因限制、重复点击、原 key/payload 恢复与冲突等行为测试通过；原生 pending/显式重试/confirmed 截图通过。全部资金请求使用内存 fixture，无真实交易验收。 |
| 4. 退出/过期、旧响应、新登录隔离 | 会话存储、generation、导航与 workspace 生命周期行为测试通过，含 A→B→A 与旧 401；真实账号恢复未验证。 |
| 5. 首次失败、无数据/筛选、刷新/提交失败的恢复 | 行为测试与原生 loading/empty/error/long error、pending/成功反馈截图通过；提示保留成功结果并提供刷新重试，不提示重复写入。 |
| 6. 共享主题/组件、职责边界 | 两主题全部产品页面已截图检查；圆角 8、OutlinedButton 点击高度 48 与说明文本换行已补齐。domain 无 HTTP/Flutter UI、presentation 无协议解析/URL 构造；最大 lib Dart 文件 454 行。 |
| 7. Android/iOS 工程、依赖锁定、运行配置/范围 | 最终两平台原生构建与真实入口运行通过；pubspec.lock、Android 工程与 iOS SwiftPM 可复现。debug/simulator 构建不能当作商店发行验收。 |
| 8. 根/App AGENTS 与 README 更新 | 已更新恢复状态、Go 协议、开发/构建与 harness 命令、模块边界；App 旧 Rust 端点说明已删除。 |

用户管理、管理员配置、系统设置、约战申请、比赛结算不在首版；未修改 Go API、数据库 schema，也未恢复 Rust/旧 Vue 项目。

## Review Focus 与架构检查

| 审查焦点 | 结果 |
| --- | --- |
| 安全存储 read/write/delete 失败 | 测试通过：不得假登录，pending 持久化失败不发资金请求。真实 secure_storage 插件初始化在两平台 main 登录运行通过；实际账号 token 写入未验证。 |
| 旧会话 401/响应污染 | 测试通过：旧 generation 无权使新会话退出，旧结果不覆盖新 workspace。 |
| 写成功后刷新失败 | 测试通过：保留成功和重试刷新路径，不重新写入。 |
| 已删除对象、未知枚举、nullable | DTO/controller/widget 测试通过；未知状态保守禁用；原生空头像和空电话（未提供）可读。 |
| pending 重启、修改金额、幂等冲突 | 测试通过：原 key/payload 保留、显式原请求重试、禁止自动重放；共享 AppStores 和 expectedKey 串行清理防旧队列误删。 |

检查 `AppDependencies`/`ProtectedWorkspace`/navigation、各 form/controller 的 ownership、dispose 与监听清理；全量测试覆盖注销、环境替换和旧请求。domain 唯一 `dart:convert` 用于 UTF-8 字节业务校验，不做 JSON 映射；JSON payload 构造位于 data mapper。架构扫描记录在 logs/domain-boundary.txt、presentation-protocol.txt、file-size-audit.txt。正式 `lib/main.dart` 无 fixture 或 HARNESS 控制导入。

## 最终评审统一修复 F1–F4

本轮增加 26 个行为回归，完整测试 251/251 通过。F1 真实 AdminApp 系统返回走 nested maybePop，dirty 取消/确认、进行中写入阻止退出、普通弹窗/干净页面/root 行为均验证。F3 登录表单采用独立 teardown epoch；失败保留用户名/密码并可修正成功重试，退出（含无中间渲染帧）与环境切换清空输入，请求 generation 安全隔离保持原实现。

F2 只将完整 Go HTTP 422/code422/message/data=null 校验拒绝映射为 domain FundRejected；submit/retry 共用 expectedKey 清理，安全删除失败或已有另一 key 均保留待确认。401、5xx、超时、网络错误、409、malformed success/422 与不一致 envelope 保留原 key/payload。新收款按注入的北京时间今天校验，date picker 的 lastDate 为北京时间今天；存量未来日期仍可从 secure store 读取并显式以原请求交给后端确认拒绝，避免在本地读取时再次锁死。Go service/repository 的校验前置与事务回滚已只读核对，无 API/schema 修改。

F4 候选输入采用 300ms 可取消 debounce，输入立即清除选择，等待期间禁止选择旧候选；refresh/retry/键盘 search 立即查询并取消 timer，dispose 取消回调。连打仅发送最新查询、立即刷新不再延迟重复请求与销毁不发送查询均验证。

最新原生 main APK/iOS App/ZIP 在 lib 修复后重建、复制、哈希、安装并启动。`final-fix-android-main-login.png` 与 `final-fix-ios-main-login.png` 已通过 view_image 实际查看：标题/输入/按钮清楚、上下安全区正常；两平台 version=1.0.0 (1)、error=null、loading=false。没有重新执行整套旧 fixture 视觉矩阵；这些行为修复由真实 AdminApp/widget 和 HTTP 回归覆盖。真实账号、token 生命周期、普通 iOS 文字键盘、商店/真机与未来 Kotlin 迁移限制仍按下文保留。

最终状态：**代码评审已完成，无开放发现项**。scoped review 通过源码 `445a426ad49b39482872d3db9bdfc81fa7b0eae5`，F1–F4 全部 ADDRESSED；[完整审查归档](admin-app-v1-code-review.md) 保留初审与修复结论。已本地合并到 main，合并后完整测试 251/251、analyze 无问题、140 文件格式检查 0 改动；日志见 artifact root 下 logs/main-merged-test.log 与 logs/main-merged-analyze.log。未 push 或发布。

## 最终检查与原生运行

工具：Flutter 3.44.2、Dart 3.12.2、AGP 8.12.1、Gradle 8.14、JDK21、Kotlin 2.2.20、Android SDK35/36；Xcode26.6、iOS26.5 iPhone17 模拟器。Android SDK/JDK/Gradle/AVD 位于工作树旁隔离目录，仅按命令注入环境；无全局 Flutter/toolchain 修改。

| 命令（App 目录执行，串行） | 最终结果 | 日志（下述 artifact root/logs） |
| --- | --- | --- |
| dart format lib test | exit0，140 文件、0 改动 | final-fix-format-check.log |
| flutter analyze | exit0，No issues found（1.9s） | final-fix-analyze.log |
| flutter test | exit0，251/251（20s） | final-fix-full-test.log |
| flutter pub get | exit0，依赖锁保持不变 | pub-get-final.log |
| git diff --check | exit0 | final-fix-diff-check.log |
| flutter build apk --debug（隔离 wrapper，Java 仅当前命令接收本机网络代理） | exit0，8.3s，显式 -t lib/main.dart | final-fix-android-main-build.log |
| flutter build ios --simulator | exit0，12.6s，显式 -t lib/main.dart | final-fix-ios-main-build.log |
| adb install/start，simctl install/launch 保存的 main 产物 | exit0，实际登录页/安全存储初始化正常 | final-fix-android/ios-main-login.png、install/launch 日志 |
| 只读 VM 检查已初始化 BuildInfoController | 两平台 exit0，version=1.0.0 (1)、error=null、loading=false | final-fix-android/ios-native-buildinfo.json |
| GET 默认 base/health | exit0，code0 / status ok | health.json |

Android 初次构建 Maven TLS 失败，Java 未继承系统网络代理；仅当前 build 命令设置代理后通过。iOS 首次 Flutter 自动迁移 SwiftPM，所有插件均支持，但旧 Pods 集成仍触发缺失 CocoaPods；用隔离 cocoapods-deintegrate/xcodeproj 工具移除停止使用的 Pods target/file 引用、Podfile、xcconfig/workspace 引用后纯 SwiftPM 构建通过。未安装全局 CocoaPods、未改变 bundle ID/signing；两平台显示名统一“赛事管理”。保留 Flutter 自动迁移的本项目 Android Kotlin 兼容 flags，当前构建通过。未来迁移 Built-in Kotlin 需 AGP9+ 和 Flutter3.47+，因此保留已验证的 Flutter3.44.2/AGP8.12.1；升级时应连同插件迁移并重新验证原生构建，依据 [Flutter 官方迁移指引](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers#validate)。初始失败日志保留 android-production.log、ios-production.log；修复后首次成功日志 android-production-proxy.log、ios-production-swiftpm.log。

Android AVD emulator-5554，截图 1080×2400。原 density420 时逻辑 411.43×914.29，系统状态栏图标自身在 63px 边界裁切；HOME 稳定截图同样复现，App 内容未覆盖系统栏。density400 的任务 AVD 逻辑 432×960，支持有效 430 布局，最后 main 截图系统栏完整。iOS 使用新建任务专用空白 iPhone17 `995EC227-265B-49B2-AD05-7F73AE3EB766`，不改既有设备/Apple 账户；原生 402×874，横屏 874×402。旧设备被账号提示覆盖的本任务截图已删除，不作为证据。

## 交付产物（真实入口 lib/main.dart）

正式产物在所有 fixture 构建结束后重新构建并复制，然后从保存文件安装启动。产物忽略且已迁移到主工作区，不提交二进制；本地合并后逐文件核对迁移副本，记录见 logs/artifact-relocation.json。main 登录截图均已实际查看；本修复后两平台只读 VM class 列表均未发现 NativeSceneHarness、_NativeSceneHarnessState、WorkspaceTransport，身份记录见 final-fix-android/ios-main-identity.json；最新 hash/大小见 delivery/admin-app-v1/identity.json，旧产物身份不再代表当前源码。

- Android debug APK：`/Users/carlwang/projects/registration_system/registration_system_admin_app/build/delivery/admin-app-v1/admin-app-v1-main-debug.apk`，197744157 bytes。 SHA-256：`94328b98c038ce2dc719243306bdad36a9bcf54a62f7c29660b5f2bc8bed61fb`。

- iOS simulator App：`/Users/carlwang/projects/registration_system/registration_system_admin_app/build/delivery/admin-app-v1/admin-app-v1-main-simulator.app`，174869137 bytes。 SHA-256：`19d833788b63d180708cfe93116d8e3fc099bef9c2d20e79d54c07d7cfc03422`。App 的 hash 指 Runner 可执行文件；总大小为普通文件字节和。

- iOS simulator ZIP：`/Users/carlwang/projects/registration_system/registration_system_admin_app/build/delivery/admin-app-v1/admin-app-v1-main-simulator.zip`，53445157 bytes。 SHA-256：`9f7e0728a14b493446f92d7cd8d7effdf595c074d99925fb74c88153898ac76b`。

Android debug 签名仅供安装验证；release scaffold 仍引用 debug signing，需维护者配置正式签名。iOS simulator App 不能装在真实 iPhone；设备签名/归档、App Store/Play 发布、真机性能与系统版本矩阵均未验证。

## 原生截图覆盖与实际检查

Artifact root：`/Users/carlwang/projects/registration_system/registration_system_admin_app/build/acceptance/admin-app-v1`。原图在 `screenshots/`，每次 scene/theme/scale 请求的实际 viewport 在 `logs/android-coverage.jsonl` 与 `ios-coverage.jsonl`；修改 width 仅约束页面布局，不能超过设备可用宽度。

表内 scene 采用真实产品 page/repository/controller，网络与账号/存储为离线虚构实现。`P` 为 android 或 ios；`T` 为 dark 或 light。每行深/浅两张都存在且已检查，覆盖表并不表示每一页都测试全部宽度/字号组合。

| 产品页面 | scene / 两平台两主题原图 |
| --- | --- |
| 登录 | `P-login-T-w390-x1.png` |
| 工作台 | `P-shell-T-w390-x1.png` |
| 比赛列表 | `P-match-list-T-w390-x1.png` |
| 比赛详情（报名/收费信息另滚动） | `P-match-detail-T-w390-x1.png` |
| 创建比赛 | `P-match-create-T-w390-x1.png` |
| 编辑比赛 | `P-match-edit-T-w390-x1.png` |
| 球队列表 | `P-team-list-T-w390-x1.png` |
| 球队详情（密码区域另滚动） | `P-team-detail-T-w390-x1.png` |
| 创建球队 | `P-team-create-T-w390-x1.png` |
| 编辑球队 | `P-team-edit-T-w390-x1.png` |
| 成员列表 | `P-members-T-w390-x1.png` |
| 成员详情（管理操作另滚动） | `P-member-detail-T-w390-x1.png` |
| 候选成员 | `P-member-candidates-T-w390-x1.png` |
| 角色/状态编辑 | `P-member-edit-T-w390-x1.png` |
| 球员资料编辑 | `P-member-profile-T-w390-x1.png` |
| 队费流水 | `P-fund-history-T-w390-x1.png` |
| 收款登记 | `P-fund-credit-T-w390-x1.png` |
| 消费扣费 | `P-fund-consume-T-w390-x1.png` |
| 流水冲正 | `P-fund-reversal-T-w390-x1.png` |
| 我的（实际导航 tab=3） | `P-account-T-w360-x1.png`、`P-account-T-w360-x2.png`；虚构长环境地址，版本失败/恢复另图 |

| 代表性压力轴 | 已查看证据与实际范围 |
| --- | --- |
| 360/390/430，2x | Android：shell、match-list、team-edit、members、member-candidates、member-profile、fund-credit 等 `android-*-w360/w390/w430-x2.png`；430 时 native432×960。iOS：360 竖屏的 long/team-detail/member-detail/fund-credit 与各 form 底部、390 全页基线；430 使用原生横屏874×402，四页2x。iOS 竖屏宽402不能宣称430。 |
| 横屏 | Android `android-shell/match-list/team-edit/fund-credit-light-w430-x2-landscape.png`，iOS `ios-shell/match-list/match-create/fund-credit-light-w430-x2-landscape.png`；Android native960×432、iOS874×402。iOS 原始截图是竖向像素容器里的旋转内容，inspection-ios-* 仅转向供查看。内容可滚动，底部操作与导航可见。 |
| 键盘、安全区 | Android `android-team-create-keyboard-stable.png`、fund-credit/login-keyboard；iOS `ios-fund-credit-keyboard-light-w390-x1.png` 数字键盘完整，提交栏在键盘上方。iOS team-create/login 首次普通文字输入被系统 QuickPath Continue 教程覆盖，不据此声称普通文字键盘通过；未操作系统教程/用户账户。 |
| 长名字/nullable/空头像 | long 两主题、light 长 match/team/member 名称、成员/候选空电话、默认头像、长环境 account，两平台可读且可滚动。输入框单行文字按系统编辑框水平滚动显示。 |
| 长错误、版本失败/恢复 | `P-long-error-light-w360-x2.png`、`P-account-version-error.png`、`P-account-version-recovered.png`；提示有重试，账号版本仍为 fixture，真实 native metadata 另有 main VM 证据。 |
| loading/empty/error | `P-loading/empty/error-T-w390-x1.png`，GET barrier 显示真实加载控件；清筛选、创建、重试入口可见。 |
| pending/成功 | Android `android-pending-T-w390-x1.png`；iOS `ios-pending-T-w360-x2.png`；原记录key/payload保留、提交禁用。Android 实际点“重试原请求”，iOS QA 显式调用实际 controller 原请求重试；fund-history/credit/consume/reversal 截图显示确认流水/服务器返回余额。无自动重放，无真实资金写入。 |
| 表单底部与2x说明修复 | 各 match/team/member 表单 `P-*-bottom-light-w360-x2.png`；最终 `P-member-profile/fund-credit/fund-consume/fund-reversal-T-w360-x2-helper-final.png` 与 `P-*-helper-bottom-T-w360-x2.png`。金额范围、原因UTF-8限制、可留空说明已完整换行，两主题均重新查看。 |

实际检查：Android 初始 contact01–08、final01–08、stress01–06、extra01–03 与 helper01–04；iOS contact01–13、helper01–04，以及四张旋转 inspection 图；两平台 main-login-final 和 Android 稳定键盘单图均已查看。原生运行日志没有发现 Flutter overflow/unhandled exception。contact 是原图缩略拼图，最终 helper 图覆盖此前2x提示截断的旧图；旧图保留诊断，不能当最终修复证据。Android 初始部分截图的系统栏问题如上单列，最终 main 图正常。完整截图列表与 viewport 是 JSONL，而非未查看图的自动“通过”计数。

## 未验证项与后续验收

- 没有凭据：真实管理员登录/会话恢复、受保护读接口返回、线上权限与整条业务链均未验证。需维护者提供合法验收账号后，在授权测试数据环境补验；本次未探取秘密、未用假凭据发登录请求。
- 真实账户 token 写入/删除与安全存储故障只通过行为 fake 测试；真实插件初始化无错误，不能代替真实账号生命周期验收。
- iOS 普通文字键盘首次系统教程遮挡，数字键盘与底部安全区已验证；需有可操作模拟器/真机时补普通文字键盘交互。没有请求解锁或绕过宿主锁屏。
- 商店签名、真实设备/不同OS性能与完整发行流水线未验；当前交付是 debug APK/simulator App。
- 最终代码评审已完成：F1–F4 全部 ADDRESSED，scoped review 无新增破坏或越界变更，结论见 [代码审查归档](admin-app-v1-code-review.md)；上述真实账号与平台验收限制仍保留。

## 附录：执行 ledger 的全部 Ruling 原文（按出现顺序）

Ruling: Execute Task 6 after Task 4 and before Task 5 — match creation needs the real active-team selector, whose TeamRepository is delivered by Task 6 — if wrong, execution order may need rework; feature scope and API contracts stay unchanged.

Ruling: JsonValue.decode supports optional uncertainWrite context — a code0 write with malformed DTO may already be committed, so funds must preserve pending status — if wrong, callers may retain a failed request for explicit confirmation instead of clearing it.

Ruling: Keep JSON payload construction in feature data layers, not domain Draft objects — spec makes data responsible for protocol mapping; Task4/6 plan convenience serializers conflicted with that boundary — if wrong, callers may need small signature adjustments; business behavior and fields are unchanged.

Ruling: Resolve uncertain match deletion only after an explicit subsequent GET returns404 and controller tracks that pending delete; ordinary404 remains a read error — disappearance confirms the desired result without replay — if wrong, a concurrently removed match may be reported as deleted, which still matches requested outcome.

Ruling: Deliver planned shared AdminScaffold/FormSection with Task6 first real management-page use, and PersonRow with Task7 first member-page use; Task3 brief only named its five interaction widgets — preserve shared styling without building unused APIs — if wrong, integration calls may need minor layout adaptation; final planned widget inventory remains required.

Ruling: Prepare isolated JDK21/AndroidSDK outside repo with per-command environment for finalnativebuild, instead of treating missingglobalSDK as permanent blocker — authorized platformverification can proceed without globaltoolchainchanges — if wrong, only removable tool downloads/diskspace are incurred.

Ruling: Add optional expectedKey to pending-store removal and serialize scope comparison/cleanup in shared store — an old cleanup retry after a partial storage failure must not delete a newer pending action — if wrong, only small store/fake signature adaptations and conservative cleanup failures are added; API/business protocol unchanged.

Ruling: Extract environment normalization to a pure core helper, preserving SessionController.normalizeEnvironment as forwarding API — FundScope must share the exact environment identity without importing application/Flutter into domain — if wrong, only a small shared-helper linkage and focused regression test adaptation need rework; scope keys remain compatible.

Ruling: Read installed build version via package_info_plus metadata instead of compile-time fallback text — Flutter build-name/build-number flags do not automatically populate custom Dart defines, so Account must reflect the actual native package — if wrong, one standard plugin dependency and its native integration may need rework; fixture version injection remains isolated.

Ruling: Use package_info_plus10.2.2 with a local Android AGP8.12.1 update — older package versions conflict with secure_storage win32^6, and official plugin requirements mandate AGP>=8.12.1; existing Gradle8.14/JDK21/Kotlin2.2.20 meet compatibility — if wrong, this App-only dependency/tooling change may require reverting or another native metadata adapter; Task10 native builds gate it. Sources https://pub.dev/packages/package_info_plus/versions/10.2.2 and https://developer.android.com/build/releases/agp-8-12-0-release-notes .

Ruling: Use a new task-owned clean iPhone simulator for headless iOS acceptance instead of asking to unlock the Mac or altering existing Apple-account prompts — existing simulator screenshot is covered by personal account verification and CUA refuses locked-Mac control; an independent empty test device preserves old user state and permits authorized CLI testing — if wrong, only removable simulator data/disk space and additional QA time are spent; no screen-lock bypass or account change.

Ruling: Retain verified Flutter3.44.2/AGP8.12.1 legacy Kotlin configuration and document its future migration warning — official Flutter guidance requires Flutter3.47+ and AGP9+ to enable built-in Kotlin, so changing it now exceeds the validated toolchain — if wrong, a future Flutter upgrade needs Android migration and native revalidation; current debug build remains verified. Source https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers .

Ruling: Keep real-admin login/restore, protected live reads/permissions and business/fund writes explicitly unverified without supplied authorized credentials — reviewer declined item1 and production writes are outside acceptance authorization — if wrong, live permission/DTO mismatches may require follow-up fixes after an authorized account is provided.

Ruling: Deliver debug Android and iOS simulator builds while retaining store signing/distribution and real-device performance as unverified — reviewer declined item2 and approved first-version implementation does not authorize publication/signing configuration — if wrong, device compatibility or release setup needs subsequent verification before distribution.

Ruling: Keep ordinary iOS text-keyboard acceptance unverified where the first-run system tutorial obscures the test, while preserving verified numeric-keyboard evidence — reviewer declined item3 and no host unlock/account/tutorial interaction was authorized — if wrong, ordinary-input layout issues may remain until unobstructed native verification.
