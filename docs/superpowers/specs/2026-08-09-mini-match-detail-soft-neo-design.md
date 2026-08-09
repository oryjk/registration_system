# 小程序比赛报名详情页 Soft Neo-Brutalism 设计

## 背景与目标

`registration_system_mini` 首页已经建立 Soft Neo-Brutalism 视觉令牌与第一批 `Neo*` 组件。比赛报名详情页仍使用大圆角、柔和阴影、渐变背景和页面内重复 CSS，与首页风格不一致；个人报名与球队报名之间也存在 Hero、说明卡、操作按钮等重复结构。

本次以用户确认的 A「赛事战报式」为视觉方向，先完整迁移个人报名主流程，并建立后续球队报名、约队详情等页面可复用的视觉组件。必须保留现有 API、Mock、路由、登录判断、报名提交、成员状态切换、定位、弹窗和分享行为。

## 范围

### 本次包含

- `pages/matches/detail.vue` 的页面背景、模式切换、加载态和错误态。
- 个人报名模式的赛事 Hero、报名状态、成员报名板、比赛说明与底部操作区域。
- 修正详情页报名进度的数据契约，使其与首页统一使用 `value / target / max`。
- 新增三项稳定的全局 Neo 视觉组件。
- 合并个人/球队重复的比赛说明卡结构，为球队模式后续迁移提供同一业务组件。

### 本次不包含

- 不重写球队报名表单、签到设置、赛后评价和结算的内部布局。
- 不修改后端接口、DTO、Mock 字段、报名规则或权限规则。
- 不改变现有分享路径、定位行为和报名提交时机。
- 不迁移比赛创建页或其他业务页面。

## 视觉方向

页面采用「赛事战报式」信息层级：

1. 顶部栏继续使用 `AppTabHeader`。
2. 低圆角、黑描边的模式切换控件紧随顶部栏。
3. 深色赛事 Hero 强调比赛类型、名称、时间、地点和主客队对阵。
4. 报名状态卡作为第二视觉重点，显示当前人数、成行目标、满员上限、分段进度、成员头像和我的报名状态。
5. 球队成员报名板保留完整操作能力，但外壳、标签和操作按钮消费 Neo 组件。
6. 比赛说明与信用分置于内容末尾。
7. 需要独立确认的主操作放入安全区感知的底部操作栏。

视觉继续使用既有令牌：米白页面、黑色描边、低圆角、硬阴影、荧光绿主强调、红色超额进度和紧凑粗体层级。禁止在新组件中重新复制已有颜色、边框、阴影和圆角原始值。

## 页面结构

```text
AppTabHeader
registration-content
  NeoSegmentedControl
  MatchIndividualRegistration
    IndividualMatchupHero
    MatchRegistrationStatusCard
      NeoProgress
      NeoAvatarStack
      报名状态操作
    TeamMemberRegistrationBoard
    MatchInfoCard
NeoStickyActionBar（仅需要独立底部主操作时）
```

父页面继续只负责模式切换和业务组件 wiring。`useMatchDetailPage` 继续持有加载、权限、提交、弹窗和 API 编排。

## 全局视觉组件

### NeoSegmentedControl

用途：页面模式、列表视图或紧凑筛选的二至三项切换。

- Props：
  - `modelValue: string`
  - `options: Array<{ label: string; value: string; disabled?: boolean }>`
  - `block?: boolean`，默认 `true`
- Emits：`update:modelValue`、`change`
- 行为：禁用项不触发事件；选中项使用荧光绿、黑描边和低圆角；容器尺寸不能因文案切换抖动。
- 组件不理解“个人报名”或“球队报名”，不读取 Store。

### NeoAvatarStack

用途：首页报名头像、详情页报名成员、约队参与者等叠放头像展示。

- Props：
  - `items: Array<{ id: string | number; name: string; avatarUrl?: string; tone?: string }>`
  - `selectedId?: string | number | null`
  - `maxVisible?: number`
  - `interactive?: boolean`
  - `size?: "sm" | "md" | "lg"`
- Emits：`select`
- 行为：没有头像时显示姓名首字；超出可见数量时显示 `+N`；只有 `interactive` 为真时提供按压和选择反馈。

### NeoStickyActionBar

用途：报名、保存、提交等页面底部主操作的视觉容器。

- Slots：默认操作区；可选 `leading` 辅助信息区。
- Props：`visible?: boolean`，默认 `true`。
- 行为：处理安全区、固定定位、页面宽度约束和描边/阴影；不持有 loading、disabled 或业务提交逻辑。
- 主按钮由调用方组合 `NeoButton`，操作栏本身不发业务事件。

## 比赛域组件

### IndividualMatchupHero

保持比赛详情专属，不提升为全局业务组件。内部改用 `NeoSurface variant="dark"` 和 `NeoTag`，继续接收现有比赛、主客队、球衣颜色、日期、时间和地点 props。定位点击仍通过 `openLocation` emit 交给父层。

Hero 使用规则：

- 比赛类型标签和比赛名称是第一层。
- 日期、时间、地点是第二层，地点保持可点击状态。
- 主客队名称和 VS 是赛事核心视觉；现有球衣图形可以保留，但改用 Neo 令牌控制边框和色彩。
- 长队名必须截断或换行，不能挤压 VS 和地点。

### MatchRegistrationStatusCard

从现有 `IndividualCountdownCard` 演进，集中处理个人报名状态展示，但不调用 API。

- Props：`joinedCount`、`requiredPlayers`、`maxPlayers`、`countdownText`、`participantPreview`、`remainingPlayersLabel`、当前状态、loading/disabled/guest 等展示状态。
- Emits：报名意图和头像选择意图；实际提交仍由父层处理。
- 内部组合 `NeoSurface`、`NeoProgress`、`NeoAvatarStack`、`NeoButton` 和 `NeoTag`。
- 显示文案明确区分：当前报名人数、成行人数、最大满员人数。

进度规则与首页完全一致：

- 绿色宽度为 `min(value, target) / max`。
- 红色宽度为 `max(value - target, 0) / max`。
- 黑色分界线位于 `target / max`。
- 没有有效最大值时，业务层将 `max` 回退到 `target`，此时不显示额外区段。

当前 `detailState.buildRegistrationProgress` 使用固定 `82%` 分界。迁移后个人报名视图不再消费该固定比例结果，而是从 `registrationCapacityState.capacity` 得到 `maxPlayers` 并传给 `NeoProgress`。不得把固定百分比继续保留为视觉补偿。

### MatchInfoCard

合并 `IndividualInfoCard` 与 `TeamMatchInfoCard` 的重复结构，留在比赛页面域内。

- Props：`title`、`items: string[]`、`score: number`、`scoreLabel: string`。
- 内部使用 `NeoSurface` 和设计令牌。
- 个人报名本次切换到统一组件；球队报名可以继续使用旧调用或同步换壳，但不改其业务流程。
- 约队详情当前复用的 `IndividualInfoCard` 需要改为使用新组件或兼容导出，不能直接删除导致引用失效。

### TeamMemberRegistrationBoard

保留现有分组、成员状态选择、弹窗和 `dialogVisibilityChange` 行为。只迁移以下视觉：外壳、标题、状态标签、头像和操作按钮。成员状态数据结构和 emit 契约不变。

## 数据流

```text
API / Mock
  -> useMatchDetailPage（加载、权限、提交、容量状态）
  -> detail.vue（模式与页面编排）
  -> MatchIndividualRegistration（业务展示组合）
  -> MatchRegistrationStatusCard / IndividualMatchupHero / MatchInfoCard
  -> Neo*（纯视觉与局部交互）
```

`maxPlayers` 来源为 `match.team_capacity_limit`。值缺失、非有限数或小于等于零时回退到 `requiredPlayers`；若后端给出的上限小于成行人数，则使用成行人数作为上限，避免负区段和溢出。

## 状态与交互

- loading：`MatchDetailSkeleton` 改用 Neo 令牌和低圆角硬边框，布局与最终页面相近，避免加载后大幅跳动。
- error：错误文案放入居中的 Neo Surface，不新增重试或路由行为。
- guest：保留现有登录/报名限制；视觉组件只接收 disabled 与文案。
- submitting：继续使用现有 `submittingStatus`，按钮显示提交中并禁止重复触发。
- full：容量已满且当前用户未参加时，沿用 `canSubmitIndividualRegistration=false`；已参加用户仍能变更状态。
- member dialog：弹窗打开时继续通过 `page-meta` 禁止页面滚动。
- location：地点入口保持可点击，调用现有 `openMatchLocation`。

## Wot UI 边界

- 页面不直接新增 `wd-button` 或 `wd-tag`，继续通过 `NeoButton`、`NeoTag` 隔离 Wot UI 默认样式。
- 现有 `wd-picker` 属于球队报名表单，本次不改。
- 新增 Neo 组件优先使用 uni-app `view/text/image` 和既有 Neo 组件组合，不引入新的 UI 依赖。

## 兼容与迁移

- 所有新增样式使用 `rpx`、`hover-class` 和 uni-app 组件，不使用 DOM API、`:hover` 或仅 H5 可用能力。
- 页面最大宽度继续由现有小程序壳层约束；宽屏 H5 中保持居中，移动端不出现横向溢出。
- 约队详情对 `IndividualInfoCard` 的复用必须在迁移中显式处理。
- 球队报名模式本轮允许保留内部旧视觉，但模式切换、页面背景和全局外壳需与个人模式协调，不出现明显断层。

## 验证与成功标准

- `act-003` 个人报名首屏与确认的 A 方案一致：深色 Hero、赛事对阵、Neo 报名状态卡和明确底部操作。
- `8 人报名 / 6 人成行 / 8 人满员` 显示绿色 75%、红色 25%、分界线 75%。
- 个人/球队模式切换正常，返回、地点、成员状态选择、弹窗和报名提交行为不退化。
- loading、error、guest、full、submitting 至少通过代码路径或 Mock 状态核对。
- 浏览器检查页面身份、非空、无框架错误覆盖层、无相关 console error/warn。
- 在移动视口和宽屏视口检查无重叠、截断、横向溢出或固定操作栏遮挡。
- 执行 `bun run type-check`、`bun run build:h5`、`bun run build:mp-weixin` 和目标文件 `git diff --check`。
- 小程序构建必须通过；微信开发者工具或真机视觉作为最终人工验收项。

## 实施约束

- 小步迁移，不顺手改球队签到、评价、结算或创建比赛页面。
- 不修改 API、Mock、Store、路由和分享契约。
- 不提交代码或文档；保留在当前 `codex/mini-soft-neo-components` 分支供用户检查。
