# mini UI 统一改版 Checklist

> 本文中的旧组件名、旧 token 和基线样式只属于迁移/验收历史，不是现行开发规范。新工作以[统一设计系统](../../registration_system_mini/docs/mini-design-system.md)为准；基线 patch 仅用于回溯，不可用于恢复旧皮肤。

依据 `docs/superpowers/plans/2026-09-22-mini-ui-unification.md`。本文件是跨批次的状态台账：每行状态分「代码完成 / 自动验证通过 / 用户验收通过 / reviewer 通过」四格，不混为一个完成标记。路由新增时随盘点补入。

## 冻结基线（任务 0，2026-09-22）

| 项 | 值 |
| --- | --- |
| 分支 / HEAD | `codex/mini-d-design`（与 `origin/codex/mini-d-design` 同步）/ `71c721b1dc3c0482accc5953bee4fe39be1d83c5` |
| 未提交修改 | 15 个文件，+307 / −754（`git diff --stat`），全部未暂存；未删除、未 stash、未 reset |
| 基线证据 | **迁移前完整 diff 与未跟踪快照：[`mini-ui-baseline-2026-09-22.patch`](mini-ui-baseline-2026-09-22.patch) + [`mini-ui-baseline-2026-09-22-manifest.md`](mini-ui-baseline-2026-09-22-manifest.md)**。patch 自包含（53 条目 = 15 tracked diff + 38 个未跟踪文件实际内容，含 PNG 二进制），`71c721b` 干净检出上单条 `git apply` 完整还原，不依赖当前工作区；manifest 含原始 status/stat 记录、逐文件 sha256、重建方法与三层验证（任务 1 后补充，见批次记录） |
| 未跟踪文件 | 见下表「带入文件」；`docs/design/home-apple-2026-09-21.html`、`home-glass-2026-09-21.html` 为并行探索稿，**不覆盖、不清理、不属于本计划** |

### 已验收基准文件（不改视觉，只随任务 1 迁移依赖路径）

| 文件 | 状态 |
| --- | --- |
| `src/pages/home/components/HomeActionMatchCard.vue` | 未跟踪（新增），已验收：大卡视觉/进度/叠卡内层 |
| `src/pages/home/components/HomeActionMatchDeck.vue` | 未跟踪（新增），已验收：叠卡跟手拖动/回弹/阻尼/预加载 |
| `src/pages/home/homeActionMatchCardState.ts` | 未跟踪（新增），已验收：卡片状态推导（含长标题/非法日期/未知费用用例） |
| `src/pages/home/homeActionDeckState.ts` | 未跟踪（新增），已验收：拖动状态机 |
| `src/pages/home/useHomeActionDeckDetails.ts` | 未跟踪（新增），已验收：相邻预加载 + 迟到响应拒绝 |
| `src/config/themePalettes.ts` | 修改中，已验收：mint/lime/orange 三主题 + page-meta 注入串 |
| `src/styles/neo-tokens.css` | 修改中，已验收：`--now-*` 试点 token（任务 1 改名 `design-tokens.css`） |

其余带入的未提交/未跟踪文件（首页改版配套）：`HomeHeaderSearch.vue`、`HomeMatchSearchResults.vue`、`home/__tests__/*4 个新测试`、`src/static/icons/lucide/`（PNG+SVG+LICENSE）、删除的 `HomeMatchSearch.vue`/`HomeOtherMatchesSection.vue`/`otherMatchesState.ts`/`useHomeOtherMatches.ts` 及其测试、修改的 `home/index.vue`/`HomeTeamSwitcher.vue`/`homeMatchState.ts`/`viewModels.ts`/`AppTabHeader.vue`/`neo/NeoAvatarStack.vue`/`stores/__tests__/theme.test.ts`/`pages/__tests__/homePageLoading.test.ts`。

### 基线自动检查（2026-09-22，任务 0）

| 命令 | 结果 |
| --- | --- |
| `bun run type-check` | 通过（exit 0） |
| `bun test src/pages/home/__tests__ src/pages/__tests__/homePageLoading.test.ts src/stores/__tests__/theme.test.ts` | 56 pass / 0 fail（exit 0；该子集不包含下表 6 个失败文件所在的测试文件） |

全量实况（reviewer 2026-09-22 复核确认）：`bun test src` = **374 pass / 6 fail**。6 个失败均为基线既有问题（与任务 1 命名迁移无关），证据与归属见下表：

| 失败测试 | 根因 | 证据 | 归属 |
| --- | --- | --- | --- |
| `viewModelsStructure` "keeps the legacy entry point as a small domain barrel" | 旧测试要求 `homeMatches`/`challenges` 导出，当前模块结构与断言不一致，需核对是否仍有兼容需求 | `utils/viewModels/` 目录只有 common/finance/notifications/team | B5 已核销；仅保留真实四个公共域导出，消费者类型检查通过 |
| `appTabHeader` "renders the header in solid neo style instead of glass blur" | 用户未提交改动把描边从 `--neo-border-default` 换成 D 风格 `--app-tab-header-line` | worktree diff 中 `-border-bottom: var(--neo-border-default)` → `+2rpx solid var(--app-tab-header-line)` | **已于任务 3 解决**（2026-09-22）：AppTabHeader 线色收敛为 `--ui-color-line`，测试断言同步更新为 D 风格实现 |
| `createMatchWotUi` "uses native date and time pickers…"（行40） | 页面级字符串断言要求过时函数与局部变量，不能据此恢复旧实现 | `submittedAtTimestamp` 在 src 仅存在于该测试文件内 | B1 已核销；现行日期控件接线 + payload 行为测试通过 |
| `createMatchWotUi` "derives registration times from submit time…"（行148） | 旧测试要求前端计算报名起止时间，当前 payload 契约不发送这些字段 | createMatchPayload 测试明确检查不含 `registration_start_at/registration_end_at` | B2 已核销；不发送报名时间字段的 payload 契约测试通过 |
| `themePageMetaCoverage` "every registered page injects…" | `pages/webview/index.vue` 无 `<page-meta`，需判断外壳主题支持或平台例外 | 主题覆盖测试命中 webview | B4 已核销；web-view 外壳 page-meta 与主题覆盖检查通过 |
| `teamManageIntegration` "team manage page edits team profile…" | 测试读取已删除的 `registration_system_rs` 源码文件 | `Bun.file(workspacePath("registration_system_rs/..."))` 必然抛错 | B3 已核销；六例前端 API mock/composable 行为测试通过 |

若后续批次发现新失败，先区分「本批引入」与上表基线问题，基线问题在此登记。

2026-09-22 用户要求这五例纳入本轮改造；实施细则见 [计划中的基线清理表](../superpowers/plans/2026-09-22-mini-ui-unification.md#五例基线失败的分批清理2026-09-22-用户追加)。每项关闭需附替代验证与运行结果。第 8 步以 `bun test src` exit 0 统一核销，不能继续将这些失败视为最终验收豁免；此处“待实施”不等于已修复。

### 已知待办基线偏差（计划已核对）

- `src/pages/home/index.vue` 的 `actionDeckMatches` 仍使用 `upcomingMatches.length ? upcomingMatches : ongoingMatches` 回退——任务 4 必须移除，当前实现不满足「进行中不进待处理叠卡」的新要求。

## 页面路由台账（pages.json 23 路由）

状态图例：`代码`=本批代码完成；`自动`=类型检查/测试/构建通过；`用户`=双端视觉验收通过；`review`=reviewer 通过。`—` 表示该批次未开始。

| 路由 | 批次 | 关键功能入口 | 实现状态 | 自动 | 用户 | review |
| --- | --- | --- | --- | --- | --- | --- |
| `pages/home/index` | 4 | 待处理叠卡、进行中/已结束分区、标题行我的比赛搜索及分页、球队切换、创建入口、下拉刷新、游客登录提示、角色引导；首页广场已取消，不恢复 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/home/matches/index` | 4 | 全部比赛列表、分页加载 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/activities/index` | 4 | 独立约队页：发现球队约队/散人约局、日历条、快捷筛选、比赛卡列表及分页、发布类型选择、身份引导；不迁回首页 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/matches/detail` | 5 | 比赛概览、报名摘要与名单、单一个人行动栏、真实说明、联系队长、独立管理区；保留报名/请假/取消/支付、申请、编辑/比分/结束能力 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/matches/create/index` | 5 | 创建比赛表单、地点/球衣色选择、发布类型 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/matches/apply-team/index` | 5 | 接约确认、继承信息、状态卡 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/challenges/create-individual/index` | 5 | 创建散人约队 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/index` | 6 | 统计概览、排名、出勤日历、登录态提示 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/detail/index` | 6 | 球队详情信息卡、成员入口 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/create/index` | 6 | 创建球队表单 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/join/index` | 6 | 加入球队、密码校验 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/invite/index` | 6 | 球队邀请分享 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/fund/index` | 6 | 队费缴纳 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/teams/manage/index` | 6 | 成员管理、出勤弹层、资料编辑、加入密码、解散、留言入口 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/user/index` | 7 | 资料 hero、球队身份、钱包、我的比赛、统计、主题选择、代操作、身份切换 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/user/matches/index` | 7 | 我的比赛列表 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/user/settings/index` | 7 | 设置项 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/user/contact-developer/index` | 7 | 联系开发者、赞赏 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/notifications/index` | 7 | 消息中心、未读、全部已读、队长留言列表 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/messages/thread/index` | 7 | 球队留言对话、回复 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/billing/index` | 7 | 账单明细 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/profile/setup/index` | 7 | 完善资料表单 | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |
| `pages/webview/index` | 7 | web-view 嵌页外壳（不改 code 兑换协议） | 代码收尾完成（本轮核对，视觉待验收） | 见任务 8 最终验证记录 | 待用户双端验收 | 已核对源码/自动检查，见文末限制 |

## 公共层台账（非路由）

| 项 | 批次 | 状态 |
| --- | --- | --- |
| `src/components/neo/*` → `src/components/ui/*`（13 文件改名，见任务1映射表） | 1 | 代码完成 2026-09-22；自动验证见批次报告；用户/ review 待办 |
| `src/styles/neo-tokens.css` → `src/styles/design-tokens.css`；`--neo-*` → `--ui-*`（`--now-*` 原样、`--app-*` 兼容出口保留并指向 `--ui-*`） | 1 | 同上 |
| `src/config/themePalettes.ts`、`src/stores/theme.ts` 注入串同步 | 1 | 同上 |
| `src/components/__tests__/neoButtonEvents.test.ts` → `appButtonEvents.test.ts` | 1 | 同上 |
| `AppTabHeader` / `BottomTabBar` / `PageBackButton` / `FloatingLoginPrompt` / `ProfileCompletionDialog` / `MatchScheduleFields` 视觉 | 3 | 未开始（任务1 仅改名引用） |
| `docs/mini-design-system.md`、mini `AGENTS.md` 旧命名示例 | 1 | 已更新 2026-09-22 |
| 任务 2 token 提炼：状态语义（`--ui-color-*-fg/bg` 固定值，成功不再随主题）、轻描边（`--ui-color-line/-strong`）、柔和阴影（`--ui-shadow-card` 族，色基 24,55,100）、圆角基准（`--ui-radius-card/button`）、900 字重→600、`--now-*` 改引用语义层（值不变） | 2 | 代码完成 2026-09-22；type-check/主题+首页测试/双端构建通过（themePageMetaCoverage 1 例失败为已登记基线问题）；用户/review 待办 |
| 任务 3 公共控件：AppButton（无描边色块+按压缩放 0.98+md 高 88/字号 30）、AppSurface（卡圆角 32/内边距 26）、AppTag（胶囊+500）、SectionHeader（34/600+软底 marker）、SegmentedControl（滑动指示块+switch token）、DateRail（浅底卡）、AppProgress（平滑过渡+无描边圆轨）、ConfirmDialog（overlay token 进场+轻字重+软底高亮）；壳层：AppTabHeader 线色收敛、BottomTabBar 选中浅底+按压反馈+创建菜单圆形按钮、PageBackButton 去 hex、FloatingLoginPrompt、ProfileCompletionDialog、MatchScheduleFields；uni.css 分段/tabbar 皮肤 | 3 | 代码完成 2026-09-22；组件测试 32/32、type-check、双端构建通过；全量 375 pass / 5 fail（均为其余基线项，appTabHeader 基线失败已修复）；AvatarStack（已验收）与 RunningLoader（已合规）不动；用户/review 待办 |
| 动效 duration/easing token（`--ui-motion-*` 五时长 + 两缓动） | 2 | 已定义 2026-09-22；基准卡进度过渡已接入（220ms 值不变）；其余组件任务 3+ 接入 |

## 旧名称消费者登记（任务 1 要求）

同批迁完，无永久双轨。登记项：

| 消费者 | 说明 | 删除条件 |
| --- | --- | --- |
| 无 | 全部旧名称（`Neo*`、`components/neo`、`neo-tokens.css`、`--neo-*`、`neo-*` class）在 `src/`、`scripts/` 内一次迁清 | — |

（历史探索稿 `docs/design/home-apple-2026-09-21.html`、`home-glass-2026-09-21.html` 与本计划文档自身保留旧词，属记录性文件，不算消费者。）

## 批次记录

| 批次 | 日期 | 交付摘要 | review |
| --- | --- | --- | --- |
| 任务 0 | 2026-09-22 | 冻结基线 + 本 checklist；不改产品代码 | 两项返工（基线证据不足、台账矛盾） |
| 任务 0 补充 | 2026-09-22 | 基线 patch + manifest（逆变换重建，114 文件逐字节验证 + stat 全等 + patch 应用自测）；修正台账两处"通过"表述与失败表矛盾；P2 返工后 patch 自包含全部未跟踪文件与图标实际内容（含二进制），还原不再依赖当前工作区 | 待 review |
| 任务 1 | 2026-09-22 | 命名迁移（见批次报告） | 待 review（另行审查，未开始任务 2） |
| 任务 2 | 2026-09-22 | token 提炼 + 设计系统文档重写（见批次报告）；基准卡仅接入 progress token（值不变） | 待 review |
| 任务 3 | 2026-09-22 | 公共控件与页面框架 D 风格改造 + 动效 token 接入；修复 appTabHeader 基线测试断言；P2 返工①退场动画（useOverlayPresence：退场期遮罩拦截、快速关开防误关、卸载清理）；P2 返工②reduced-motion 适配；P2 返工③去永久缓存——prefersReducedMotion 每次实时读取 + 退场时长改为关闭时刻求值（函数选项），附运行中切换设置的退场测试 | 待 review（三项 P2 已补） |
| 任务 4 | 2026-09-22 | 移除 actionDeckMatches ongoing 回退；HomeMatchCard 按 viewMode 分层（upcoming 富卡 / ongoing+ended 紧凑查看卡，仅真实比分展示）；状态测试新增 7 例（三阶段并存/仅单阶段/全空/查看型仅查看/比分真实性/比分前缀按阶段区分）；约队大厅筛选/日历平滑切换+列表淡入+发布弹层退场防点穿；首页配套组件 D 化；P2 返工：发布菜单子元素彻底禁点+事件入口可见性检查（BottomTabBar 同步加防误触守卫）、比分前缀 scoreNote 区分「最终比分/当前比分」；P2 返工②：scoreNote 改按后端 status 判定——仅 status==="ended" 显示「最终比分」，超时未收尾（时间戳归 ended 分区但 status 仍 ongoing，0:0 复现）显示「当前比分」，附测试 | 待 review（P2 均已补） |
| 任务 5 | 2026-09-22 | 详情/报名/创建全链 D 化收紧（~24 文件）；查看型门控核对（零逻辑改动）；MatchSignupCountSheet/VenuePickerSheet 接退场防点穿；修复 createMatchWotUi 两例基线失败。P2 返工R1：守卫写反修正+回归断言、概览去重复头像、迟到/雨天虚构文案删除。P1/P2 返工R3：①行动栏真正合并——名单板自带 StickyActionBar 移除，单一行动栏上收至 MatchIndividualRegistration（优先级：待支付 > 名单状态 > 报名 CTA；支付态叠加次行动：散人未付=调整人数、球队名单在开=修改状态，经 statusDialogRequest 计数触发名单板对话框）；②详情结构遗漏——detail.vue 游离在 <style> 外的编辑区 CSS 移入（并修复 </style> 丢失）、hero 信息行加 lucide 图标（clock/map-pin 28rpx）、删名单板「我的状态」重复块（状态由单一行动栏文案表达）；③统计卡随 props 精简为纯概览。P2 返工R4：①类型与入口——isPickupMatch 改由页面按 publication_mode 判定后直传（match_kind=external 会误判散人对手局），次行动（调整人数/修改状态）报名关闭后隐藏（仅保留去支付主行动）；②详情结构补齐——导航标题动态显示比赛名、hero 时间行补结束钟点（start–end）、新增人制/费用 chips（免费兜底）、散人局对阵区改「散人报名 · 已报 N 人」（不再待定 VS 待定）、删球服 kits 行（与对阵色条重复） | 待 review（R4 已补） |
| 任务 6 | 2026-09-22 | teams 全目录 D 化清扫 + 危险区/统计卡核对。P2 返工：①管理页顶部卡改 wrapper 模式（custom-class 跨作用域布局在 mp 失效，AppSurface flush + 页面自持包裹 view 横排）；②出勤明细/年度记录展开补内容淡入（expand token + ≤8rpx 位移）+ 箭头旋转（switch token）+ reduced-motion；③新增 teamManageFlows.test.ts 六例行为测试。P2 返工R2：展开跳动——新增 SmoothCollapse 组件（实测内容高度过渡 0→px→auto，收起先钉高再回 0，世代计数防快速反向，卸载清理，reduced-motion 直切），接入出勤明细与年度记录两处（容器平滑撑开/收回 + 内容淡入）。补遗：出勤记录/排名分页签切换 keyed 内容轻淡入（年月翻页/刷新不重播）；邀请分享按钮补 prefers-reduced-motion（去缩放只留表面色反馈） | 待 review（R2+补遗已补） |
| 任务 7 | 2026-09-22 | user/billing/notifications/messages/profile/webview 18 文件 D 化清扫；webview 补 page-meta 修复 themePageMetaCoverage 基线失败；功能入口全保留，H5TestLoginPanel 未动。P2 返工：①钱包卡 wrapper 修复（custom-class 跨作用域布局→AppSurface flush + 自持包裹 view 横排）；②MineTeamSwitchSheet 接 useOverlayPresence 退场防点穿（overlay token 进退场 + reduced-motion）；③消息分区切换（通知/队长留言）keyed 内容轻淡入（已读/分页不重播）；④移除 MineProfileHero 气泡常驻摇摆循环动画（违反常驻动画约束） | 待 review（P2 已补） |

### Reviewer 复核：任务 4 收尾与任务 5（2026-09-22）

- 任务 4 最后比分 P2 通过：`homeMatchState` 仅后端 `status === "ended"` 标注最终比分；超时但仍 ongoing 的 0:0 保持当前比分，回归用例通过。用户视觉验收另行记录。
- 任务 5 暂不通过，先完成下列返工，再继续申请本批验收：
  1. **P2 弹层退场误提交**：`MatchSignupCountSheet.vue:55–60` 的两个处理器用了 `!props.submitting || leaving.value`。退场时仍允许确认/取消，面板也未禁点。事件入口应拒绝不可见、退场、提交中状态；保持遮罩防点穿，同时停止面板业务交互，补相应事件行为验证。
  2. **P2 详情结构未落实**：按 `2026-09-22-match-detail-d-design.md` 完成紧凑概览、图标信息行、报名摘要/名单去重、单一个人行动栏、联系行及管理区。当前 `MatchIndividualRegistration` 仍串联旧状态卡和队员板，`MatchRegistrationStatusCard` 仍重复人数与头像、保留“已选中”，`detail.vue` 仍为“比赛报名”及独立解释型管理卡。不能以批量调整字重、边框完成本批验收；编辑区位于 `</style>` 外的样式也须按设计归位。
  3. **P2 虚假赛事说明与信用归属**：`IndividualInfoCard.vue:18–35` 仍在无说明时生成迟到/雨天规则，且将当前身份球队信用标成“本场比赛信用”。只展示真实填写的说明，空说明隐藏，移除错误归属的信用展示。
- 自动验证：`bun run type-check`、`MINI_REVIEW_SKIP=1 bun run build:mp-weixin`、`VITE_PUBLIC_BASE=/ bun run build:h5 --mode test` 均退出 0。`bun test src` 为 396 pass / 2 fail（398 tests），退出 1；剩余失败是 B4 主题 page-meta 和 B5 viewModels 结构。
- B1/B2 已通过现行控件接线与 payload 测试核对，不恢复旧报名起止时间计算。B3 虽已不报错，目前仅删除 Rust 源码断言，不能据此核销：任务 6 仍须落实计划约定的当前前端 API/流程行为验证，并将测试名改为实际覆盖范围；本次未完成任务 6 的页面 review。
- 本次仅源码 review 与本地自动验证，未控制浏览器、未执行生产报名/取消/支付；双端界面与动效由用户验收。

### Reviewer 复核：任务 6（2026-09-22）

结论：暂不通过。现有球队创建/加入/邀请/资金/管理入口和危险操作确认流程保留，统计汇总仍集中展示；本批主要为样式迁移，以下约定仍未完成。这些是本批验收遗漏，不统一认定为本批新引入的业务回归。

1. **P2 小程序管理卡布局仍跨 scoped 边界**：`teams/manage/index.vue:117` 将 `team-manage-hero` 传入 AppSurface，但对应第 300 行的 flex、间距和 padding 写在父页面 scoped CSS。mp 产物选择器为 `.team-manage-hero.data-v-6df4f4fc`，AppSurface 内层只有自身作用域 `data-v-734c54c1`，不能命中，文字与队徽会退化为纵向布局。使用 `AppSurface flush` 加当前模板内层 view 承载布局和 padding；同时核查本批同类 form-card/custom-class，不以 H5 正常代替双端兼容。
2. **P2 出勤展开与切换动效未落实**：`TeamActivityAttendancePanel.vue:80` 直接 v-if 插拔整段明细，`MemberAttendancePopup.vue:98` 同样直接显示/隐藏年度记录；前者仅箭头有写死的 180ms 旋转。按总计划实现局部内容/容器过渡及列表切换反馈，使用 motion token，支持快速反向操作和 H5 reduced-motion；Wot 弹层本身沿用已有动效，不重复套层。原生邀请按钮新增缩放也须补 reduced-motion 处理。
3. **P2 B3 尚未达标**：`teamManageIntegration.test.ts:111–132` 只删除了 Rust 源码读取和断言，剩余仍为 includes 检查，suite 仍命名 real backend integration。补充计划要求的当前前端资料更新、用户搜索、添加成员 API mock/composable 行为验证，检查实际参数与响应处理，并按真实覆盖范围命名；不得用后端测试存在代替前端调用链验证。B3 保持未核销。

验证：类型检查、mp-weixin 构建及组件注册检查、H5 test 模式构建均退出 0；完整测试 396 pass / 2 fail（B4/B5），退出 1。未操作浏览器或生产数据，用户视觉验收仍待完成。第 5 步前次列出的三项返工状态不因第 6 步提交而改变。

### Reviewer 复核：任务 5 第二轮返工（2026-09-22）

结论：部分修复，暂不通过。SignupCountSheet 的 `|| leaving` 已改为 `&& !leaving`，退场误提交条件已修正；虚构迟到/雨天规则和状态卡重复头像已删除。新增回归保障仍是源码字符串断言，未验证事件时序；建议在本轮行动栏行为验证中补不可见/退场/提交中不发送事件。

1. **P1 支付入口被报名门控隐藏**：`MatchRegistrationStatusCard.vue:109` 把唯一“去支付”放入 `showCta` 控制的栏；父组件 `MatchIndividualRegistration.vue:109` 在有队员名单或报名关闭时传 false。待支付用户因此只看到待支付信息，却无法从详情继续支付，TeamMemberRegistrationBoard 也没有支付事件接线。按原设计由统一编排层分别判断报名操作与现有支付能力，保留实际可支付状态的入口；散人待支付时允许的调整人数/取消次入口也不能被主按钮替换后丢失。补有名单、无名单、窗口关闭但仍待支付等行为验证，不修改后端支付资格。
2. **P2 总额误标人均**：`MatchRegistrationStatusCard.vue:104` 将 `pendingPaymentFeeLabel` 标成“人均”，但 `useMatchRegistrationPayment.ts:29–30` 已将单价乘报名人数。单价 25 元报 3 人时实际应付 75 元，会显示“人均 ¥75.00”。总额标为待支付/合计；人均费使用真实单价，避免重复乘人数。
3. **P2 详情设计仍未完整落实**：继续按 `2026-09-22-match-detail-d-design.md` 逐项完成，不以包一层管理分区代替结构改造。导航仍为“比赛报名”；IndividualMatchupHero 仍为大日期块、独立球服行，缺少紧凑时间/地点/费用图标行，散人仍显示虚拟主客队；摘要和进度重复人数，队员板重复状态；概览与独立比分卡仍重复比分；管理教学文案仍在；`detail.vue:452` 后仍有样式落在 style 块外。IndividualInfoCard 虽删除虚假规则，但仍始终展示类型和“当前球队信用”（无球队回退 0），不符合只展示真实说明、空说明隐藏、移除无关信用的已定方案。统一行动栏需连同第 1 项一起完成。

验证：类型检查、mp-weixin 构建/组件注册检查、H5 test 模式构建均退出 0；`bun test src` 为 396 pass / 2 fail（B4/B5），退出 1。未控制浏览器或执行生产操作；未复核第 6 步后续修复。

### Reviewer 联合复核：任务 5 / 6 最新返工（2026-09-22）

已确认修复：任务 5 金额改为合计、空说明整卡隐藏、无关信用移除、大日期块压缩、重复比分移除；报名关闭且有待支付时现在会渲染支付栏。任务 6 顶部管理卡采用本模板 wrapper，布局不再依赖 AppSurface 内层的父 scoped class；B3 新增六例真实 composable → actions → mock API 流程测试，载荷、空输入拦截、结果合并、名单刷新/缓存失效、权限 no-op 均通过，B3 行为验证通过。旧 suite 名称 `team manage real backend integration` 仍应改为实际的源码接线检查名称。

剩余阻塞（不重复要求已通过部分）：

1. **任务 5 / P1：两个固定行动栏重叠，支付仍可能被遮挡。** `MatchRegistrationStatusCard.vue:110` 在待支付时强制渲染 StickyActionBar，但其后的 `TeamMemberRegistrationBoard.vue:261` 在报名窗口开放时仍渲染另一个。两者使用同一 fixed bottom / z-index 40 / 宽度，后一个名单操作栏覆盖支付栏。触发条件：有名单 + 待支付 + 报名开放。必须由父编排层只渲染一个行动栏，而非再调整 OR 条件或提高 z-index；同时保留散人未支付时原来允许的调整人数/取消次入口（当前无名单时主按钮变为支付后该入口也消失）。补组合状态行为测试，至少含有/无名单、待支付、报名关闭及可调整人数。
2. **任务 5 / P2：原详情结构清单仍有遗漏。** 导航仍是“比赛报名”；概览仍缺人制/真实费用/结束时间的图标信息行，散人仍展示虚拟主客队和独立球服行；摘要与进度重复人数、队员板重复状态，联系队长仍未收紧；`detail.vue:448` 已结束 style，但第 450 行起编辑卡 CSS 仍在块外。按既有详情设计完成并逐项对照，不将大日期块压缩视作整个结构验收通过。
3. **任务 6 / P2：仅有进入动画，收起和布局跳动未解决。** `TeamActivityAttendancePanel.vue:81`、`MemberAttendancePopup.vue:98` 仍直接 v-if 插拔内容，新增 keyframes 只影响 opacity/transform，不影响占位高度，展开瞬间撑开、收起立即移除。实现局部展开/收回的布局过渡，或真正保持布局的淡入降级，不能仅在注释中称“保持布局”。保留已加的 token/reduced-motion；补原生邀请按钮 reduced-motion 和记录/排行内容切换反馈（两者此前要求仍未落实）。交互流畅度由用户验收。

本次全量测试 402 pass / 2 fail（B4/B5），新增六例 B3 通过；类型检查、mp-weixin 构建和组件注册检查、H5 test 模式构建均退出 0。未使用浏览器控制或生产操作。任务 5 / 6 均保持待返工。

### Reviewer 复核：单一行动栏与 SmoothCollapse 返工（2026-09-22）

已确认：底部栏上收到 MatchIndividualRegistration，两个子组件不再渲染固定栏，叠栏问题解决；编辑 CSS 已移回 style；出勤两处接入实测高度 SmoothCollapse。尚不能通过：

1. **P1 编译阻塞**：`MemberAttendancePopup.vue` 的 SmoothCollapse 附近标签不匹配。H5 构建失败，随后文件仍在修改（最后读取的第 113 行还多一个 `</view>`）；必须修复后重新跑双端构建。mp 首次构建另报 detail.vue style 未闭合，随后源文件已补上且 parser 通过，不能将该旧错误继续列为当前问题，但 mp 尚无本轮成功结果。
2. **P2 次行动误判比赛类型与窗口**：`MatchIndividualRegistration.vue:64` 用 `match.match_kind === "external"` 判散人，但 detailData 的适配器对所有比赛固定写 external。待支付球队比赛因此显示“调整人数”，实际 selectIndividualSignup 在非散人且已报名时走取消确认；窗口关闭时也仍显示这个必然被业务层拦截的入口。传入 useMatchDetailPage 已有、依据 sourceMatch.publication_mode 的 isPickupMatch；所有修改类次行动均检查报名开放，付款独立保留。补真实模式/开放关闭的行为测试，不能只检查模板字符串。
3. **P2 详情原清单仍未完成**：导航仍为“比赛报名”；hero 虽补时钟/地点图标，但仍缺真实人制/费用/结束时间，散人仍无条件显示主客队及球服；人数/状态去重和联系行按之前文档继续完成。此项延续已有设计，不新增视觉要求。

自动验证：bun test src 403 pass / 1 fail（B5）；类型检查退出 0，但 SFC 编译失败，不能用类型检查代替构建。B4 本次测试通过，不代表已完成第 7 步 review。本轮工作区在检查期间仍有变化，以上基于最后读取文件；最终交付需代码稳定后的双端构建。未操作浏览器或生产数据。

### Reviewer 模板修复复核（2026-09-22）

MemberAttendancePopup 标签闭合已修复，小程序构建（含组件注册检查）和 H5 test 模式构建均退出 0，上一轮 P1 编译阻塞核销。上一轮两个 P2 仍未修复：MatchIndividualRegistration 第 64 行仍以 external 判散人，第 121 行的调整人数分支仍未检查 registrationClosed；详情标题及人制/费用/结束时间、散人展示和信息去重清单仍待落实。此轮只复跑受模板修复影响的双端构建，未重复跑未改逻辑的测试，未控制浏览器。整体仍不标记通过。

### Reviewer：任务 7（2026-09-22）

结论：暂不通过，剩余两类 P2。与原基线对比，本批主要是样式与公共组件命名迁移，未发现新接口调用/支付流程/权限判断改动，个人中心代操作、身份切换、主题偏好及回复/付款入口仍保留。webview 只补 useAccentTheme/page-meta，URL 白名单和导航逻辑未变；B4 主题覆盖测试通过，可核销。此注入只作用外壳，不表示 iframe 内页面已换色。

1. **P2 钱包卡跨组件 scoped 布局未修复**：`user/components/MineWalletSection.vue:22–29` 将布局类通过 custom-class 交给 AppSurface，flex/间距/背景仍写在父组件 scoped CSS。mp 编译选择器 `.mine-wallet-strip.data-v-5efd951e` 与 AppSurface 内根节点 `data-v-734c54c1` 不匹配，余额与查看账单按钮不能按预期横排，背景也不生效。采用 AppSurface flush + 本模板内层 view 承载布局和 padding，沿用此前已修的球队身份卡模式；核对本批其他类似 custom-class 布局。此为本批应处理的存量问题，不称为新业务回归。
2. **P2 第 7 步动效规范未落实**：`MineTeamSwitchSheet.vue:27` 仍以 visible 直接卸载遮罩和面板，只有写死 220/240ms 的进场动画，缺反向退场和 reduced-motion。复用既有 presence 机制，退场保留遮罩、禁用面板业务点击，使用 motion token，并保留切换中的防重。`notifications/index.vue:129` 的通知/球队留言内容仍直接 v-if 切换，需按计划补局部内容过渡（不为动画重发请求、不分页全量重播）。`MineProfileHero.vue:186` 的资料提示保留无限摇摆且无 reduced-motion，应改静态或有限反馈，并统一 H5 减少动画适配。未通过项不是要求新增复杂动画，而是落实既定关闭和切换反馈。

验证：类型检查、mp-weixin 构建/组件注册检查、H5 test 模式构建均退出 0；完整测试 403 pass / 1 fail（仅 B5，归任务 8），退出 1。没有浏览器控制、生产写入或界面实测。第 5/6 步既有未通过项不因本次第 7 步 review 自动核销。

### Reviewer：任务 6 单独复核（2026-09-22）

管理卡 wrapper、B3 行为验证、出勤展开/收起容器接入与模板闭合均已确认；展开容器已从直接插拔改为实测高度过渡，实际连续快切和两端流畅度仍由用户验收，未以源码检查代替实测。本次球队流程/页面接线/统计日历三个测试文件共 19 pass / 0 fail。

仍有此前清单中的两处遗漏，任务 6 暂不核销：
- `teams/index.vue:195–201` 记录/排行内容仍由 v-if/v-else 直接替换，无计划要求的局部内容过渡；分段控件自身动画不等于列表内容过渡。
- `teams/detail/index.vue:431–435` 邀请分享按钮仍有缩放过渡，但本文件没有 prefers-reduced-motion 适配；补减少动画时移除缩放和过渡。

另有非阻塞命名收尾：teamManageIntegration 的 describe 仍为 real backend integration，实际是源码接线检查，应按覆盖范围命名。此次未重复双端构建和类型检查（前次已成功，以上遗漏可直接从当前源码确认）；未操作浏览器。第 5/7 步状态独立保留。

### Reviewer：任务 7 返工通过（2026-09-22）

任务 7 代码 review 通过，用户双端视觉/动效验收仍待完成。钱包横排布局已移到当前模板 wrapper；通知/球队留言通过按 tab key 的内容容器淡入，不在分页时重建整段；减少动画时禁用过渡；资料提示不再循环摇摆。B4 保持通过，登录桥接和 URL 白名单未改。

纠正上一轮范围判断：全 src 搜索没有 MineTeamSwitchSheet 的实际导入/使用，它属于当前未使用组件，不能作为线上切换入口的验收阻塞。其新增 presence、退场遮罩/面板禁点、motion token 与 reduced-motion 已检查，但不声称它代表当前页面的切换流程或已实测。任务 8 可核对并清理这类未使用组件，不为此恢复旧入口。

非阻塞 P3 交任务 8：notifications/index.vue 的内容动画仍写死 `160ms ease`，替换为既有合适的 motion duration/easing token；不必为纯样式新增测试。

本轮验证：类型检查、mp-weixin 构建/组件注册检查、H5 test 模式构建全部退出 0。完整测试 403 pass / 1 fail，唯一失败为归任务 8 的 B5。未使用电脑控制或生产写操作；第 5/6 步未完成项仍按各自记录保留。

## 任务 8 当前结论（2026-09-22，以此节覆盖上方历史 review 状态）

用户授权本对话直接修复剩余问题并执行任务 8。代码收尾与自动检查已完成；整个改版仍等待用户的 H5/小程序界面与动效验收，不将其标为整体完成。未提交、推送、部署，未执行生产报名、取消、付款或发送消息。

### 已完成与修正

- 任务 6：记录/排行内容过渡、邀请按钮 reduced-motion 已核对；两处 160ms 内容切换改为 motion token。管理卡 wrapper、出勤高度过渡、B3 六例流程验证保留。
- 任务 5：`detailPresentation` 统一个人行动选择，支付与只读独立；真实 publication_mode 决定散人入口，已支付散人不能借名单绕过锁定。报名截止/开赛后旧弹窗提交也重新拦截；有/无名单、待支付、只读、已支付状态补行为测试。人数门槛与差额展示采用实际报名组最少/最多配置，原报名 payload 与容量业务计算不改。
- 比赛详情标题、时钟/人制/费用/地点信息、跨日结束日期、散人无虚拟对阵、人数/名单去重、真实说明、紧凑联系行、管理区 wrapper 已收尾。费用缺失显示待确认，零元与赛前/赛后结算分开；待付金额仍显示合计。
- SmoothCollapse 从当前可见高度反向过渡，卸载清理帧等待和结算定时器，并使迟到测量回调失效；退场报名弹层禁点、事件检查 visible/rendered；球队切换中选择事件也防重。
- B1–B5 全部核销。B5 不是恢复空模块：核对所有共享 viewModels 消费者后保留 common/team/finance/notifications 四个真实导出；比赛展示归 home/hall 等页面域。修正旧源码接线断言，不删有效业务测试。
- 已按具体文件核对并清理生产界面剩余 900/950 字重与头像硬阴影；新增 heading token。H5TestLoginPanel 属开发辅助界面，按原计划保留其独立样式。静态图片引用检查未发现缺失文件。
- 更正前次“MineTeamSwitchSheet 未使用”的结论：当前 MineTeamIdentityPanel 明确导入并使用该组件；以当前调用链为准，保留切换入口和退场机制，不据此前记录删除它。

### 最终自动验证（均在 registration_system_mini 执行）

| 检查 | 结果 |
| --- | --- |
| `bun test src` | **416 pass / 0 fail**，61 文件，退出 0 |
| `bun run type-check` | 退出 0 |
| `MINI_REVIEW_SKIP=1 bun run build:mp-weixin` | 构建与组件注册检查通过，退出 0；不登记发布版本 |
| `VITE_PUBLIC_BASE=/ bun run build:h5 --mode test` | 退出 0 |
| `git diff --check` | 通过 |

执行过程中一次误从工作区根运行 bun test，混入另一前端子项目并出现失败；该结果不作为 mini 验证。上述结果均已从正确子项目根重新执行。未改管理端或后端来处理该错误调用。

独立源码复核已进行，反馈的跨日时间与跨开赛时刻提交保护已修复。此轮自动检查不能证明手势节奏、窄屏布局、键盘/安全区与真机动画表现。

### 用户待验收（任务 8 最后一道门）

- 首页叠卡、头像滚动、首尾提示不退化；进行中/结束比赛仍为查看层级。
- 详情：免费/未知/预付/赛后费用，多人报名与付款、满员与无门槛、已支付锁定、已开赛只读、队长管理入口。
- 队员很多时的名单、长说明/长名称、出勤快速展开/反向收回、记录/排行切换。
- 三主题、H5 减少动画、小程序样式隔离、键盘遮挡与底部安全区。
- 个人中心切队、钱包、通知/留言切换与 web-view 外壳；无需为验收视觉进行生产支付或发消息。

用户确认以上双端表现后，再将任务 8 和整体改版标记完成；目前为“代码与自动检查完成 / 用户验收待完成”。
