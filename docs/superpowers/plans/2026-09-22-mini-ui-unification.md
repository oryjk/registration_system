# 小程序与 H5 组件统一改版 Implementation Plan

> **状态说明：这是分批改版与迁移记录。** 命名迁移已完成，旧路径/映射表仅供追溯；不得按早期未勾选项重新迁移或恢复旧风格。最新视觉和后续交互调整以[现行统一设计系统](../../../registration_system_mini/docs/mini-design-system.md)为准，批次完成情况以[验收清单](../../design/mini-ui-rollout-checklist.md)为准。

> **For agentic workers:** 使用 `superpowers:executing-plans` 按批次实施本计划。用户指定其他 agent 实现，当前对话的 agent 负责 review；不要自行启动额外 agent 或新任务。步骤使用 checkbox 跟踪。

**Goal:** 以用户已确认的首页“最近要处理的比赛卡”为基准，统一 `registration_system_mini` 的视觉和交互质量，同时保留功能及 H5 / mp-weixin 双端能力。

**Architecture:** 先冻结当前基线，再独立迁移职责命名，随后提炼全局 token、调整公共组件，最后按业务页面落地。业务状态、接口调用和数据提交继续由原有页面/composable/service 管理；展示组件沿用现有 props/emits，不借改版重写业务。

**Tech Stack:** uni-app、Vue 3、TypeScript、Vite、现有 Wot UI 2.3.0；Lucide 本地图标资源。

**Spec:** [现有迭代记录](../../design/mini-d-rollout.md)及本文“已验收基准”。本文是后续执行依据；旧记录中的初期蓝色方案、单张卡限制、纵向翻卡等历史决定不再适用。

## 角色与修改边界

- 实现者：用户指定的其他 agent。每批提交可 review 的 diff、验证结果和验收说明，修复 review 问题后再进入下一批。
- Reviewer：当前对话的 agent，负责代码、范围、功能保留和验证证据审查，不接管整轮实现。
- 用户：负责 H5 和微信端视觉/手势验收。所有 agent 均不调用电脑控制或自动浏览器进行界面测试，除非用户后来明确改变要求。
- 修改范围：`registration_system_mini/`，以及本计划、相关有效设计/架构文档。全仓引用搜索允许；Go 后端、管理端、暂停的 Flutter、部署脚本、数据库和 H5 专用新项目不在本次改动范围内。
- 不新增/更改接口协议、权限、报名支付规则、身份切换逻辑或路由结构。若确需后端能力，记录具体阻塞交由用户决定，不能扩展任务。
- 不删有效功能、不合并具有不同作用的按钮、不改变导航目的地；可以去掉同一区域同一目的地的重复入口。普通用户对进行中/已结束比赛采用本计划新增的查看型展示要求，管理员功能继续保留。
- 不升级依赖、不换框架、不安装新的整套 UI 库；Wot 相关修改须先读子项目要求的 `.agents/skills/wot-ui-v2/SKILL.md` 并查已有 MCP 文档。
- 运行时组件直接导入 `.vue`，不能改为 barrel 导入。保持 uni API，不引入仅 H5 可用的 DOM/window 业务实现。
- 单批只做一个可验收目标。命名迁移与外观变化分开；不重置、覆盖或提交与本任务无关的用户改动。
- 只做本地实现和验证；本计划不授权提交、推送、上传小程序或部署。若用户另行授权提交，按批次独立提交。

## 已验收基准（不要重新设计）

参考文件（任务 1 后部分公共依赖路径改变，业务文件名保留）：

- `registration_system_mini/src/pages/home/components/HomeActionMatchCard.vue`
- `registration_system_mini/src/pages/home/components/HomeActionMatchDeck.vue`
- `registration_system_mini/src/pages/home/homeActionMatchCardState.ts`
- `registration_system_mini/src/pages/home/homeActionDeckState.ts`
- `registration_system_mini/src/pages/home/useHomeActionDeckDetails.ts`
- `registration_system_mini/src/config/themePalettes.ts`
- `registration_system_mini/src/styles/design-tokens.css`

### 视觉标准

| 项目 | 统一方向 |
| --- | --- |
| 默认主题 | 薄荷蓝；保留已有 mint/lime/orange 主题 ID、存储偏好与切换能力 |
| 配色 | 背景 `#fffffe`，标题 `#00214d`，正文 `#1b2d45`，主色 `#00ebc7`；辅助 `#ff5470` / `#fde24f` |
| 色彩管理 | 全部结构 UI 使用 token。主色、主色上文字、浅底、深色文字成组切换；状态语义色独立，不能把成功状态随着主题变成任意颜色 |
| 容器 | 轻描边、柔和阴影、圆角。基准卡圆角 32rpx、按钮圆角 20rpx；紧凑列表可减少装饰，不把每个区域都套大卡片 |
| 密度 | 基准卡内边距 26rpx / 28rpx；相关信息横向组合，长内容自然换行，不靠删除信息压缩高度 |
| 字体 | 正文 24–26rpx；次要信息 22rpx；状态 24rpx；卡标题 34rpx / 600；主按钮 30rpx / 600。20rpx 只用于短徽章；68rpx 时间强调仅留给关键比赛卡 |
| 图标 | 沿用 `src/static/icons/lucide/` 中 PNG（附 SVG 原稿和 LICENSE）；信息图标统一尺寸和笔画，不混用 emoji 代替常规 UI 图标 |
| 动作 | 一处突出一个主动作；主按钮基准最小高度 88rpx。次要动作降低视觉权重，危险动作明确标识 |
| 排版 | 比赛性质放标题旁小徽章；状态直接显示“已报名/已请假”等，不加重复“我的报名”标签 |

### 首页主次层级：待处理与查看型比赛必须明显区分

2026-09-22 用户补充：普通用户对进行中和已结束比赛仅查看；首页首要目标是让用户知道现在该做什么。此要求优先于“所有卡片套相同视觉”的解释。统一设计语言不等于统一卡片结构或操作强度。

| 类型 | 展示目的与优先级 | 视觉与信息 | 普通用户交互 |
| --- | --- | --- | --- |
| 最近要处理 | 第一优先级，展示接下来要处理的比赛 | 保留已验收的大卡、主题色主按钮、清楚的时间/报名状态、多人比赛叠卡 | 进入该比赛现有处理流程；动作由真实状态决定，不把所有比赛都写成“去报名” |
| 进行中 | 第二优先级，了解当前比赛 | 紧凑列表卡，标题和时间为主，小号“进行中”标签；只有真实接口返回比分时才展示比分 | 整卡进入查看详情，尾部小箭头或轻量“查看”；不用满宽主按钮、报名进度强调、叠卡或可拖动线索 |
| 已结束 | 第三优先级，回顾比赛 | 更安静的记录列表，日期/名称、已有结果与比分；次要文字降低权重但保持对比度 | 查看比赛记录；不显示报名/取消报名/调整人数等普通用户操作入口，不做灰掉的报名按钮 |

- 首页顺序：待处理区域 → 进行中 → 已结束；搜索和既有导航仍可达，不为强化主次删除功能。
- 首页只承载自己的比赛及处理任务，标题行搜索仅调用现有 `listMyMatches`。首页广场及“我的比赛/广场”切换已取消；发现比赛、球队约队与散人约局由独立的“约队”页（`pages/activities/index`）承载，任务 4 不恢复重复入口或广场数据流。
- 最近待处理为空时，显示紧凑的“暂无待处理比赛”，可给轻量浏览比赛入口；进行中和已结束仍留在各自区域，不能顶替成大号待处理卡。
- 已核对当前 `src/pages/home/index.vue`：`actionDeckMatches` 仍使用 `upcomingMatches.length ? upcomingMatches : ongoingMatches`。任务 4 必须移除这个进行中回退；当前实现在这一点上尚未满足本条新要求。
- 查看型卡片不只是把主按钮文字改成“查看”：必须同时降低高度、去掉大时间强调/主题色条和重复 CTA，保持整卡可点击且状态明确。
- 队长/管理员已有管理入口继续按权限保留并与普通用户查看路径区分。本条不授权改变服务端权限或删除管理功能，也不代表删除账单页既有结算能力。
- 首页卡片与详情页的普通用户展示一致：进行中/结束不再暗示可以报名或修改参赛状态。只依据既有角色/状态字段控制前端展示；若缺少可靠权限字段，记录具体问题交 reviewer，不臆造字段。
- 可在现有 `HomeMatchCard.vue` 内按 phase 明确分支；若展示职责已经显著不同，再抽成查看型业务组件。不能让已验收的 HomeActionMatchCard 承载所有阶段，也不强制为了命名新增一套重复业务状态。

### 已确认交互的保护清单

- 叠卡只用于“最近要处理”这一多比赛场景，不机械推广到所有列表。
- 真实背层卡片、整卡横向跟手（头像区域除外）、纵向页面滚动、短距离回弹、首尾阻尼和轻提示、拖动防误触继续保留。
- 当前及相邻比赛预加载；刷新比赛集合/切换球队后旧请求不能串入；背层不能接受报名操作。
- 头像单行横向滚动，固定位置的展开/收起，卡片高度不因头像换行跳动。
- 报名进度：不足最低人数黄色；达到最低人数后前段薄荷绿、超过门槛部分海军蓝，剩余容量浅底；保留门槛分隔点、人数及成行状态说明。用户已去掉重复的门槛下方文字，不恢复旧的双行刻度。
- 按报名组 ID 匹配数据，不能取返回数组第一组。未知费用不标免费；未设置截止时间不伪造；未设人数限制不虚构门槛/上限。

### 交互动效标准（2026-09-22 用户补充）

用户希望点击和切换具有明确的动画反馈，以已验收叠卡的跟手感为参考。动效属于本次交付范围，不是可省略的后续美化；不同控件按职责应用，不把叠卡动画套到所有页面。

| 场景 | 反馈方式 | 建议时长与约束 | 负责批次 |
| --- | --- | --- | --- |
| 主/次按钮、可点击卡片 | 按下轻微缩放至 0.98 或改变表面色，松开恢复；信息密集行优先表面色，不挤压文字 | 80–120ms；禁用态不产生可点击反馈；保留布局和点击热区 | 3，全页面复用 |
| 分段筛选、标签切换 | 当前指示底块平移到新选项，文字/图标颜色过渡；不能只有瞬间换色 | 160–200ms；视觉状态和实际选择一致，支持快速反向切换 | 3、4 |
| 列表内容切换 | 内容轻淡入，可配合不超过 8rpx 位移；筛选控件本身保持稳定 | 120–180ms；不先清空整页，不为动画额外请求接口，不每次分页重播全部列表 | 4、6、7 |
| 展开/收起内容 | 内容与容器平滑展开/收回；头像保持现有固定高度横向展开模式 | 180–220ms；不直接切换 auto 高度造成跳动，不用巨大 max-height 伪造均速展开；无法稳定测量时保持布局、只淡入内容 | 3、5、6、7 |
| 底部弹层、确认弹窗 | 底部弹层小幅上移配合遮罩淡入，关闭反向；居中弹窗可用轻缩放 0.98→1 | 180–240ms；退场完成前保留必要遮罩，防止点穿；不能延迟校验或重复提交 | 3、5、6、7 |
| 底部导航 | 选中图标/底色轻变化，提供按压反馈 | 100–160ms；保持 uni.switchTab 原行为，不叠加整页横向动画，也不重建 tab 导航 | 3 |
| 进度/数字状态更新 | 进度长度及颜色平滑过渡，状态徽章轻量换色；数字立即展示真实值 | 180–220ms；不要做数字滚动计数，不制造中间业务状态 | 3、5 |
| 最近待处理叠卡 | 保留当前拖动一比一跟手、倾斜、松手切换/回弹、首尾阻尼 | 拖动无 transition，松手沿用约 220ms；真实背层预加载，禁止回退到离散翻页 | 4 保护性验证 |
| 进行中/已结束查看卡 | 只提供轻量按压反馈 | 不做叠卡、摇摆、循环呼吸等吸引注意的动画，维持首页主次 | 4、7 |

**统一实现规则：**

- 在任务 2 定义 `--ui-motion-press-duration`、`--ui-motion-switch-duration`、`--ui-motion-expand-duration`、`--ui-motion-overlay-duration` 及对应 easing token；各组件引用，不分散硬编码。已验收叠卡只在保持行为相同的前提下接入 token，不重新调参。
- 优先 transform/opacity/颜色过渡，禁止 `transition: all`；高度动画仅限确需展开的局部容器。不得通过父容器整体 scale 改变正在阅读的正文。
- 轻触立即响应，业务动作不等待装饰动画；涉及退出遮罩/防点穿等生命周期例外，需要精确说明并覆盖测试。触摸取消要恢复外观，拖动结束不能误触按钮。
- 快速连点/反向切换应转向最新目标，不排队播放旧动画；提交防重保持原规则。卸载、切换球队、关闭弹层时清理 timer/listener，迟到回调不能改变新页面状态。
- 不新增常驻定时器、自动轮播、循环装饰动画，不一次性为长列表所有条目绑定动画或长期设置 will-change。遵守用户节省资源和控制发热的要求。
- H5 尊重 `prefers-reduced-motion`，减少位移/缩放并缩短过渡；小程序若无可靠系统能力，不臆造 API，保持短时、非循环动效。降低动画不能破坏实际选择和提交逻辑。
- 双端使用现有 uni/Vue 能力。不要为普通动画引入只支持 DOM 的库；涉及 Wot 弹层优先使用其已有动效，避免套两层互相冲突的动画。
- 代码 review 检查方向锁定、重复事件、生命周期和资源使用；用户验收流畅度、节奏和视觉层级。截图只能说明静态结果，不能作为“动效已验收”的证据，agent 仍不调用电脑控制。

## Review Focus

1. **主题与小程序宿主节点**：改名后 page-meta 注入、局部变量覆盖和按钮宽度仍生效；任务 1–3 负责自动检查，用户验收三主题及双端布局。
2. **数据状态与功能入口**：游客、多球队、未报名/已报名/请假/待支付、满员、报名窗口变化时入口及行为不变；任务 4–5 负责对应既有测试和状态用例。
3. **触摸冲突与异步竞态**：横向切卡不吞纵向滚动、头像不带动整卡、背层不能提交、迟到响应不串场；任务 2/4 保护已有手势和预加载测试，用户验收真实手势。
4. **紧凑布局的内容极值**：长队名/赛事名/场地、多人报名、较长金额、错误信息和窄屏不能截断关键操作；任务 3–8 给用户逐项验收步骤，不添加字符串样式断言冒充视觉测试。
5. **表单及固定操作栏**：键盘、安全区、提交中防重复、弹层关闭和原有取消/支付限制不退化；任务 5–7 根据行为改动跑已有测试，纯布局交给双端人工验收。

## 任务 0：冻结交接基线和范围清单

**Files:** 读取根/子项目 `AGENTS.md`、上述基准文件、`registration_system_mini/src/pages.json`；新增 `docs/design/mini-ui-rollout-checklist.md`。

**交接事实（2026-09-22 核对）:** 当前分支 `codex/mini-d-design`，HEAD `71c721b`。已验收卡片、预加载逻辑、图标和主题改动大量存在于未提交工作区中；仅 checkout 远端分支会漏掉这些文件。另有未跟踪 `home-apple-2026-09-21.html`、`home-glass-2026-09-21.html`，它们不是已选方案，不覆盖、不清理。

- [ ] 在当前完整工作区开始；若换 worktree，由用户确认交接包含未提交和未跟踪的基准文件，不能默认从远端裸分支实施。
- [ ] 记录 `git status --short --branch`、`git diff --stat`、基准文件清单。禁止为获得干净工作区 stash/reset 用户文件。
- [ ] 在 checklist 中以 `pages.json` 的 23 个路由为行，记录阶段、关键功能入口、实现状态、自动验证、用户视觉验收、review 结果。路由若新增，随盘点补入，不能漏覆盖。
- [ ] 跑一次基线检查，已有失败明确标为基线问题，不冒充本批引入或已解决。

```sh
cd registration_system_mini
bun run type-check
bun test src/pages/home/__tests__ src/pages/__tests__/homePageLoading.test.ts src/stores/__tests__/theme.test.ts
```

**交付 / Review gate:** reviewer 能还原“改版前”完整状态和用户既有改动边界；本批不修改产品代码。

## 任务 1：独立职责命名迁移

**Files:** `src/components/neo/*` → `src/components/ui/*`、`src/styles/neo-tokens.css` → `src/styles/design-tokens.css`；所有运行时引用、class/token 覆盖、`src/config/themePalettes.ts`、`src/stores/theme.ts`、相关现有测试、`src/App.vue` 的样式入口及有效规范文档。此节所有 `src/` 均相对 mini 根。

| 旧文件/符号 | 新文件/符号 |
| --- | --- |
| NeoAvatarStack / NeoAvatarItem / NeoAvatarSize | AvatarStack / AvatarItem / AvatarSize |
| NeoButton / NeoSurface / NeoTag | AppButton / AppSurface / AppTag |
| NeoProgress / NeoDateRail | AppProgress / DateRail |
| NeoSectionHeader / NeoSegmentedControl | SectionHeader / SegmentedControl |
| NeoStickyActionBar / NeoConfirmDialog | StickyActionBar / ConfirmDialog |
| NeoRunningLoader / useNeoConfirmDialog | RunningLoader / useConfirmDialog |

**Interfaces:** 保留每个组件的 props 默认值、emits、slots、expose 及普通 TS 函数签名；只改名称与导入路径，不改为另一套组件 API。

- [ ] 执行前确认目标文件无冲突。当前未发现 `components/ui` 和 `--ui-*`；既有 `--app-primary` 等已存在，不能简单把 `--neo-` 全替换成 `--app-`。
- [ ] 文件和类型按上表迁移，业务组件 `HomeActionMatchCard/Deck` 保留；运行时组件继续直接 `.vue` 导入。
- [ ] 将 `--neo-*` 一对一迁为 `--ui-*`，保留 primitive/semantic/component 层级；组件内部 `neo-*` class 迁为 `ui-*`。同步主题注入、局部 override、字符串内联样式、测试及 App 样式入口。
- [ ] `--now-*` 本批保持原样；原 `--app-*` 兼容出口继续存在，只把其内部引用改指向 `--ui-*`。
- [ ] 若仍有消费者需旧别名，在 checklist 逐项登记消费者及删除条件；优先同批迁完，不永久保留两套样式实现。不得靠覆盖方向错误的 CSS alias 假装兼容。
- [ ] 更新有效设计文档与子项目 AGENTS 中的旧示例；历史 HTML 设计稿不批量替换。
- [ ] 搜索有效代码的旧名称并说明保留项；运行完整自动检查。

```sh
rg -n 'Neo|useNeo|components/neo|neo-tokens|--neo-' src scripts
bun run type-check
bun test src
MINI_REVIEW_SKIP=1 bun run build:mp-weixin
VITE_PUBLIC_BASE=/ bun run build:h5 --mode test
```

**Review gate:** diff 只有命名/引用迁移；H5 与 mp 编译及注册通过。用户检查三主题、基准卡、弹窗和主按钮与此前一致。失败先修复，不掺入视觉调整。

## 任务 2：提炼统一 token，保护已验收卡片

**Files:** `src/styles/design-tokens.css`、`src/config/themePalettes.ts`、`src/stores/theme.ts`、`src/pages/user/components/ThemeAccentPicker.vue`、`src/pages/home/components/HomeActionMatchCard.vue`；更新 `registration_system_mini/docs/mini-design-system.md`。

**Interfaces:** 主题 ID、存储 key、`useAccentTheme()` 返回值、`buildAccentThemePageStyle(theme)` 签名不变。`--now-*` 允许引用通用语义 token，值与已验收效果一致。

- [ ] 在设计系统文档登记本文配色、字号、间距、圆角、描边、阴影、点击尺寸及“主色不等于状态色”的映射；同时落实上节动效 duration/easing token。
- [ ] 通用颜色与尺寸收敛到 `--ui-*`。例如组件消费 `--ui-color-text`，不能把所有正文硬编码海军蓝；付费/失败/危险与品牌色分别建语义映射。
- [ ] 把公共 Neo 遗留硬阴影、粗边框、900 字重的默认 token 改为轻量风格；本批不改变组件布局 API。
- [ ] 同步三主题 page-meta 显式注入及切回默认主题的路径。主题变更不要只改 CSS 默认值，也不要清空用户旧偏好。
- [ ] 保持首页卡片所有已确认尺寸与交互，不因为“统一规范”把它改回高卡或单色进度条。
- [ ] 跑主题测试、首页状态/手势/预加载测试及双端构建。纯 token 变更不新增机械样式测试。

**Review gate:** 基准卡保持不变，主题切换无旧色残留；所有结构颜色有语义归属，不引入后端改动。

## 任务 3：公共控件和页面框架

**Files:** 任务 1 后 `src/components/ui/*.vue`；`src/components/AppTabHeader.vue`、`BottomTabBar.vue`、`PageBackButton.vue`、`FloatingLoginPrompt.vue`、`ProfileCompletionDialog.vue`、`MatchScheduleFields.vue`；相应 `src/components/__tests__/`。

**Interfaces:** 保留原 props/emits/slots；按钮仍只提交一次；确认弹窗仍由调用者决定异步流程，不能自行吞掉错误或绕过校验。

- [ ] 先改 AppButton/AppSurface/AppTag/SectionHeader：清晰主次、轻边框、短徽章，保留 disabled/loading/block 和危险态。
- [ ] 再改分段筛选、DateRail、Progress、StickyActionBar、ConfirmDialog 和 RunningLoader。通用 Progress 仍接收原 `value/max/target`，不要因为比赛门槛改成业务专用 API。
- [ ] 处理公共头部、底栏、返回和登录提示：保留 tab 数量/顺序/地址、创建入口、未读标识及返回兜底。图标可换统一资源，不能以改版名义重新定义导航。
- [ ] 按交互动效表实现按钮按压、分段指示器、展开收起、弹层进退和底栏反馈；样式动效不机械新增单测，改动关闭时序/防重/回调时则补快速点击、取消与卸载行为测试。
- [ ] 清除残余写死的硬阴影/字重/位移；每次修改前核对依赖它的页面，禁止全项目正则替换所有 font-weight。
- [ ] 检查小程序宿主宽度与样式隔离。布局放自己模板的 wrapper，不能依赖父 scoped class 穿透子组件。
- [ ] 跑已有组件事件、返回、底栏资源测试和双端构建；用户验收正常/禁用/加载/错误、长按钮文字、窄屏、安全区和弹层。

**Review gate:** 公共控件样式一致且 API/事件不变。先审此批，再开始页面批次，以免后续反复修改同一依赖。

## 任务 4：首页其余组件与独立约队页

**Files:** `src/pages/home/index.vue`、`home/components/HomeMatchCard.vue`、`HomeMatchList.vue`、`HomeHeaderSearch.vue`、`HomeMatchSearchResults.vue`、`HomeHeroSection.vue`、`HomeTeamSwitcher.vue`、`OnboardingRolePickerDialog.vue`、`home/matches/index.vue`；`src/pages/activities/index.vue` 及其 `components/`。核对既有 `home/homeMatchSearchState.ts`、`activities/useHallPage.ts`、`activities/hallMatchState.ts` 与对应测试，不重写请求逻辑。

**页面边界（2026-09-22 用户确认）：** 首页展示自己的待处理/进行中/已结束比赛，约队页负责发现与发布。`HomeMatchSearch.vue`、`HomeOtherMatchesSection.vue`、`otherMatchesState.ts`、`useHomeOtherMatches.ts` 已删除，不恢复；首页不新增广场列表、广场搜索或“我的比赛/广场”分段切换。约队页仍在本批统一视觉与动效，保留其独立路由及既有功能。

- [ ] 按“首页主次层级”区分三类比赛。待处理保留已验收叠卡；进行中/结束改成紧凑查看型卡片，只保留整卡查看/轻量箭头，不再显示报名型主按钮。
- [ ] 移除 `actionDeckMatches` 的 ongoing 回退，检查对应分区去重和空态条件，确保没有待处理时进行中比赛仍显示在进行中区域；不要改接口请求或丢弃比赛。
- [ ] 在现有首页集合/状态测试中覆盖：三种阶段同时存在、仅有进行中、仅有已结束、全空；验证待处理集合没有混入 ongoing/ended，查看型卡片的普通用户操作仅为查看。权限区分若触及状态推导，补普通用户和管理员各一例。不要用静态颜色断言代替行为测试。
- [ ] 首页统一球队切换、标题行搜索展开/收起、搜索结果、列表标题、“更多”、加载/失败/空态；保留搜索自己的比赛及分页行为，不改变 `listMyMatches` 的请求范围。首页已验收叠卡保持原有行为。
- [ ] 独立约队页统一日历条、快捷筛选、比赛卡列表和发布类型弹层；筛选提供平滑选中切换与局部内容过渡。保留球队约队/散人约局、日期筛选、分页、发布入口及现有身份引导，不把这些功能搬回首页。
- [ ] 对照任务 0 功能表分别验收：首页的球队切换、我的比赛搜索分页、创建入口、最近待处理/进行中/已结束与全部比赛入口；约队页的发现、筛选、分页、发布类型及详情入口。已取消的首页广场不再列为功能保留项。
- [ ] 无比赛、游客、多个球队、长标题、接口失败、连续翻卡/头像滑动、搜索展开与清空、约队筛选快速切换列入用户验收；至少跑 `bun test src/pages/home/__tests__ src/pages/home/matches/__tests__ src/pages/activities/__tests__ src/pages/__tests__/homePageLoading.test.ts src/pages/__tests__/activitiesPageSections.test.ts`。若触及搜索请求或状态，核对自己的比赛搜索范围、分页及过期响应处理，按风险补行为测试。
- [ ] 对照现有 useHomeActionDeckDetails 的预加载和无效化测试，确认公共组件调整没有导致重复请求或背层可操作。

**Review gate:** 首页首屏能明确辨认待处理主区域和进行中/结束查看区域；进行中不再回退进待处理叠卡；普通用户没有误导性报名入口，管理员有效功能保留。首页只搜索自己的比赛，不恢复广场；独立约队页的发现、筛选和发布能力完整保留。用户确认此批再延伸到报名主流程。

## 任务 5：比赛详情、报名和创建流程

**详情页设计依据：** 必须先读 [比赛详情页 D 风格设计与实现交接](../../design/2026-09-22-match-detail-d-design.md)。该文明确概览/名单/行动栏/管理区结构、冗余信息取舍、图标使用、状态矩阵与可信数据来源；不能只替换颜色和圆角即声称完成。本批先完成详情子批 review，再继续创建/接约表单；步骤总数不变。

**Files:** `src/pages/matches/detail.vue`、`matches/components/` 全部组件；`matches/create/index.vue`、`matches/create/components/`；`matches/apply-team/index.vue` 及 components；`src/pages/challenges/create-individual/index.vue`。

- [ ] 按详情设计合并重复报名摘要、名单和比分；标题旁性质徽章，时间/地点/人制/费用图标化；普通动作保留文字。移除空说明时虚构的迟到/天气规则与错误归属的“本场比赛信用”，不删真实比赛说明或球队数据。
- [ ] 个人固定行动栏统一仲裁，管理操作独立；报名只读与既有待支付费用分开处理，避免因为阶段切换误删有效支付入口。新增展示逻辑按设计中的状态矩阵验证，提交与权限 handler 保持原语义。
- [ ] 将 MatchInfoCard、IndividualMatchupHero/InfoCard、报名状态/名单/比分/结束卡按信息优先级收紧；统一图标、状态徽章及主次操作。
- [ ] 核对进行中/已结束详情对普通用户仅呈现查看内容，管理动作继续遵守原有角色权限；不改后端状态机，不移除独立账单结算。
- [ ] 整理 MatchSignupCountSheet、MatchJoinTeamSheet、MatchEditDialog、MatchScoreDialog、球队申请和散人报名的弹层布局。原有多人报名、代报、请假、取消、待支付/支付入口、管理员动作全部保留。
- [ ] 创建表单改分组、标签和间距；保留字段、默认值、必填校验和 payload 构造。复用现有地点/球衣色选择器，不新增业务字段。
- [ ] 对照现有 `createMatchPayload` 及报名状态测试：本次不允许同一输入生成不同 payload。若改到 actions/state，必须针对实际行为补测试，而非测试 CSS class 存在。
- [ ] 清理基线失败 B1/B2：`src/pages/__tests__/createMatchWotUi.test.ts` 的原生日期控件与报名时间两例。先核对 `MatchScheduleFields.vue`、创建表单、实际 payload 构造与 `matches/create/__tests__/createMatchPayload.test.ts`：当前契约不发送 `registration_start_at/registration_end_at`，不能为了旧断言恢复 `submittedAtTimestamp` 或“开赛前 24 小时截止”。移除对过时局部变量/函数位置的依赖，保留日期时间控件接线检查，业务时间与请求字段用现有 payload 行为测试保障；不重复新增同义测试，不修改后端默认规则。跑上述两个测试文件并记录退出码。
- [ ] 用户验收预付/赛后结算、免费/未知费用、满员、窗口未开始/关闭、不同报名组、队长权限、键盘遮挡和长校验错误；agent 不在生产上执行报名/取消/付款。

**Review gate:** 业务规则和请求保持一致；B1/B2 两例基线失败已解决且原有日期/请求保障保留。如果只能靠改后端满足效果，停止该项并列出原因，不绕过校验。

## 任务 6：球队、成员、邀请和统计

**Files:** `src/pages/teams/index.vue`、`teams/detail/index.vue`、`teams/create/index.vue`、`teams/join/index.vue`、`teams/invite/index.vue`、`teams/fund/index.vue`、`teams/manage/index.vue`；`teams/components/`、`teams/manage/components/`。

- [ ] 统一球队信息卡、统计概览/排名/日历、加入/创建面板、邀请及球队资金展示；数字与标签相邻，避免一个指标一张大卡。
- [ ] 成员管理、搜索、编辑、出勤弹层统一控件密度；保留管理员/普通成员的权限差异和全部筛选入口。
- [ ] 危险区（如解散球队）保持单独语义和确认流程；不能因减少按钮而与普通保存合并。
- [ ] 清理基线失败 B3：`src/pages/__tests__/teamManageIntegration.test.ts` 不再读取已删除的 `registration_system_rs`。沿现有 `useTeamProfile/useTeamMembership` 与 `src/api/` 核实资料编辑、用户搜索、添加成员的调用、参数和响应适配；需要时只读核对 Go 路由/DTO。用前端 API mock/既有 composable 行为测试保护这些流程，保留其余有效页面接线与模块边界断言；不简单删掉整例，也不恢复 Rust 目录或制造空文件。测试名称按实际覆盖范围命名，不能把源码字符串检查称作真实后端集成。运行该测试文件与受影响的球队流程测试，禁止生产写操作。
- [ ] 跑该目录既有行为测试；纯布局不新增测试。用户验收空球队、很多成员、长姓名、统计无数据、权限不足与金额显示。

**Review gate:** 页面入口和权限完全可追踪；数据计算未变化；列表长内容可用；B3 已摆脱废弃后端源码依赖，核心操作仍有有效验证。

## 任务 7：个人中心、账单、消息及剩余页面

**Files:** `src/pages/user/index.vue`、`user/components/`、`user/matches/index.vue`、`user/settings/index.vue`、`user/contact-developer/index.vue`；`src/pages/billing/index.vue`、`notifications/index.vue` 及 components、`messages/thread/index.vue`、`profile/setup/index.vue`、`webview/index.vue`。

- [ ] 个人信息、球队身份、钱包、比赛、统计和主题选项按任务分组，保留每一个有效入口；不要删除代操作等已有条件功能。
- [ ] 账单、通知和对话采用紧凑列表；金额、时间、未读、付款/回复入口的语义保持明确。
- [ ] 设置、联系开发者、资料补全与登录提示统一表单/空态/错误态。web-view 仅检查外壳、加载与错误反馈，不改登录 code 兑换协议和内嵌业务页面。
- [ ] `H5TestLoginPanel.vue` 仅属于开发辅助界面，不作为生产用户视觉验收目标，也不得删除其调试能力。
- [ ] 清理基线失败 B4：核对 `src/pages/__tests__/themePageMetaCoverage.test.ts` 与 `src/pages/webview/index.vue`。若 web-view 外壳实际使用主题，补入现有 `useAccentTheme/page-meta` 并保持滚动与加载状态；若平台嵌页不适用，明确记录两端原因，在测试中仅对该路由设置有理由的显式例外，其他页面继续完整检查。不能将 web-view 从 `pages.json` 移除或全局跳过主题检查，也不把外壳主题注入当成 iframe 内页面已换色。登录 code 兑换、URL 白名单、导航行为不变；运行主题覆盖与已有 web-view 相关测试。
- [ ] 跑已有相关行为测试；用户验收登录/退出、身份切换、空账单/大金额、长消息、资料错误及安全区。不实际发消息或支付来测试样式。

**Review gate:** `pages.json` 23 个路由全部在 checklist 有状态；B4 已依据真实平台行为处理，主题覆盖测试通过。存在未改项时说明原因，不能只宣称“全站完成”。

## 任务 8：跨页面收尾与最终 review

**Files:** `docs/design/mini-ui-rollout-checklist.md`、`registration_system_mini/docs/mini-design-system.md`，以及此前各批发现的有限遗漏。

- [ ] 检查有效代码的旧命名、重复 token、旧硬阴影、零散结构 hex、900 字重；人工判断业务色/插画是否例外，不盲删。
- [ ] 对已不再调用的旧 helper（例如早期单卡详情 hook），先核对所有调用方与测试价值，再单独清理；不得把删旧测试当作修复失败。
- [ ] 清理基线失败 B5：`src/utils/__tests__/viewModelsStructure.test.ts` 仍要求导出不存在的 `viewModels/homeMatches`、`viewModels/challenges`。搜索 `src/utils/viewModels.ts` 的全部消费者与业务模型当前归属，确认是否确有兼容导出缺失；若模块已经迁移，更新过期结构断言，保留入口轻量、按职责分层及有效导出保障。不能新建空模块、恢复废弃逻辑或为凑行数拆文件。运行该测试文件及受影响消费者测试。
- [ ] 用户动效验收覆盖：连续快切、反向滑动、触摸取消、头像与整卡手势隔离、弹层关闭防点穿、长列表、低性能设备以及 H5 减少动画设置；未实测项如实保留，不用构建成功代替。
- [ ] 汇总所有入口新旧对应、自动测试、用户视觉反馈和未验证项。每项分别记录“代码完成 / 自动验证通过 / 用户验收通过 / reviewer 通过”，不混为一个完成标记。
- [ ] 运行最终完整检查，将命令、退出码、失败原因交给 reviewer。只有新代码变化或失败修复才重复全量检查。
- [ ] 核销下方 B1–B5 台账：本轮范围内的五例必须全部解决，`bun test src` 最终退出码为 0；不得继续以“既有失败”豁免最终完成。出现其他失败先定位归属并修复，不用 skip/todo、吞异常、删除有效断言或减少覆盖范围伪造通过。不能解决时列明阻塞，整体保持未完成。
- [ ] Reviewer 做全分支检查，确保无后端/管理端/部署越界、无功能遗漏、无未解决 P1/P2 问题；用户完成双端视觉验收后才标记整体完成。

## 自动验证与预览约定

### 五例基线失败的分批清理（2026-09-22 用户追加）

这是本次前端改造的交付范围，不新增编号批次。按所属功能随批修复，第 8 步统一核销；每项提供“原断言目的 → 当前真实契约 → 替代验证 → 执行结果”。只修改必要前端代码/测试/文档，后端可只读核对，不扩大为后端改造。具体实施要求见对应任务。

| 编号 | 失败例 | 负责批次 | 完成标准 |
| --- | --- | --- | --- |
| B1 | createMatchWotUi：原生日期/时间控件 | 5 创建表单子批 | 控件接线验证跟随当前结构，不要求业务函数留在页面内 |
| B2 | createMatchWotUi：报名起止时间 | 5 创建表单子批 | 按当前 payload 契约验证，不恢复过时的前端截止时间规则 |
| B3 | teamManageIntegration：资料编辑/用户搜索/添加成员 | 6 | 脱离 Rust 源码依赖，验证当前前端 API 调用及流程 |
| B4 | themePageMetaCoverage：webview 路由 | 7 | 主题外壳支持或有证据的单路由例外，其余覆盖完整 |
| B5 | viewModelsStructure：旧导出约定 | 8 | 依据真实模块边界更新验证，必要兼容出口仍有效 |

表格表示计划，不表示已经修复。每批交付更新 checklist 中对应项；当前用户视觉验收与测试清理仍分别记录。

所有命令从 `registration_system_mini/` 执行。任务 1/3/8 跑全量已有前端测试；其他批次跑影响目录和上述指定回归集。类型检查与双端构建是每批交付门槛。

```sh
bun run type-check
bun test src
MINI_REVIEW_SKIP=1 bun run build:mp-weixin
VITE_PUBLIC_BASE=/ bun run build:h5 --mode test
```

- mp 构建使用 `MINI_REVIEW_SKIP=1`，不分配发布版本；构建脚本已检查 usingComponents。编译通过不代表微信真机验证通过。
- 没有新增行为时不机械写单元测试/静态源码断言；测试失效应先区分命名变更和行为回归，再修正断言。
- 现有 H5 预览地址 `http://127.0.0.1:5178/`，连接 `.env.test` 中的生产后端。先确认服务是否在运行，优先复用；只有服务已停且需要预览时，运行以下单个进程：

```sh
VITE_PUBLIC_BASE=/ bun run dev:h5 --mode test --host 127.0.0.1 --port 5178 --strictPort
```

- 不另开 Python 静态服务，不留下多个预览进程。用户关心机器发热；禁止持续动画演示和不必要轮询。
- 不记录 token/真实连接串；不变更生产数据。验证失败或工具受限须明确记录，不能用“应该没问题”替代结果。

## 每批交给 reviewer 的格式

```text
批次：任务 N（或 N 的独立子批）
基线：分支、起始 commit、带入的未提交文件
完成范围：文件清单 + 变化目的
功能保护：原入口/事件/请求是否保持；具体核对项
验证：命令、退出码、相关输出；未验证项及原因
用户验收：待验收的操作步骤/状态/动效场景；已有反馈
待 review：diff 或已授权产生的 commit 区间
后续：只列下一批，不提前改共享文件
```

Reviewer 输出按严重性列问题，附文件/行号、触发条件、用户影响和修复建议；无发现也需说明实际审查范围与未验证风险。需要返工时由实现 agent 修复，再做复审。不要只用“风格不喜欢”阻塞，依据已验收基准、功能保护或平台约束提出意见。

## 可直接发给实现 agent 的指令

> 阅读根目录和 mini 的 AGENTS.md，以及 `docs/superpowers/plans/2026-09-22-mini-ui-unification.md`。在包含现有未提交改版代码的 `codex/mini-d-design` 工作区，先完成任务 0，再实施任务 1；完成后停在 review 交付点。只改小程序/H5 前端，不动后端、管理端或部署；保留当前已验收的 HomeActionMatchCard/Deck 效果和全部功能。不要调用电脑控制测试，不自行创建 agent，不推送或发布。按计划提供 diff、验证证据和用户验收步骤，由原对话的 agent review 后继续下一批。
