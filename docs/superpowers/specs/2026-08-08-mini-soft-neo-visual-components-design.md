# 小程序 Soft Neo-Brutalism 视觉组件设计

## 目标

为 `registration_system_mini` 建立一套可跨页面复用的 Soft Neo-Brutalism 视觉基础。第一批组件以当前已获认可的首页为视觉基准，并将首页迁移为首个使用方；后续页面可以逐个迁移，而不需要复制黑框、硬阴影、低圆角、荧光绿和按压反馈 CSS。

本次组件化必须保持首页现有数据、接口、路由、权限、状态、文案和用户操作不变。组件化后的首页在 `390x844` H5 视口下需要与迁移前保持视觉等价。

## 设计原则

- 通用组件只处理视觉结构、展示状态和局部按压反馈，不读取 Store、不请求 API、不执行路由。
- 比赛卡片、约队卡片等业务组件继续留在页面域内，通过 props 和 slots 组合视觉组件。
- 设计令牌是颜色、边框、阴影、圆角和动效的唯一来源；业务组件不再新增重复的 Soft Neo 原始值。
- Wot UI 只作为成熟交互控件的底层实现，不能把默认主题泄漏到页面。
- 视觉保真优先于强行使用 Wot UI。若 Wot UI 组件无法稳定还原当前样式，则保留自定义底层实现，但不改变对外的 `Neo*` 组件 API。
- H5 与微信小程序必须使用同一套组件接口和 `rpx` 视觉令牌。

## 目录结构

```text
registration_system_mini/src/
  styles/
    neo-tokens.css
  components/
    neo/
      NeoSurface.vue
      NeoButton.vue
      NeoTag.vue
      NeoProgress.vue
      NeoDateRail.vue
      NeoSectionHeader.vue
      index.ts
```

`neo-tokens.css` 由全局样式入口引入。页面显式导入 `Neo*` 组件，`index.ts` 只提供稳定导出，不注册全局组件。

## 设计令牌

令牌在一个 CSS 文件内按 primitive、semantic、component 三层分区，避免第一阶段创建过多文件。

### Primitive

- 颜色：`#111310`、`#fffdf8`、`#f4f0e8`、`#b9f24b`、`#dff8a8`、`#ff6b5f`、`#dce6ff`、`#ffd2cc`、`#ece9e1`。
- 描边：`2rpx` 和 `3rpx`。
- 圆角：`3rpx`、`4rpx`、`6rpx` 以及仅供头像使用的圆形值。
- 硬阴影：`8rpx 8rpx 0`，按压态为 `4rpx 4rpx 0`。
- 按压位移：`4rpx`；快速动效：`120ms ease`。

### Semantic

- 页面背景、表面、主文字、次文字、主强调、危险、信息、成功和禁用。
- 主描边、次描边、浮起阴影、按压阴影和交互位移。

### Component

- Surface、Button、Tag、Progress 和 DateRail 的背景、前景、边框、圆角、阴影、间距和字体。
- 组件内部只能引用 semantic 或 component token，不直接写上述原始十六进制颜色。
- 现有 `--app-primary` 可以别名到 Soft Neo 主强调色，避免与项目已有 Wot UI 定制冲突。

## 组件规格

### NeoSurface

通用内容表面，只负责外壳，不规定业务内容布局。

- Props：
  - `variant: "raised" | "outlined" | "dark"`，默认 `raised`。
  - `interactive: boolean`，默认 `false`。
  - `disabled: boolean`，默认 `false`。
  - `flush: boolean`，默认 `false`；用于 Hero、Swiper 等自行控制内边距的内容。
  - `customClass: string`，用于业务组件添加布局 class。
- Slot：默认内容。
- Emit：`tap`。
- 行为：可交互状态使用 `hover-class` 实现位移和阴影变化；禁用状态优先级高于按压状态。

### NeoButton

标准命令按钮，对外隐藏 Wot UI 或自定义底层差异。

- Props：
  - `variant: "dark" | "lime" | "outline" | "danger" | "muted"`，默认 `dark`。
  - `size: "sm" | "md"`，默认 `md`。
  - `loading: boolean`、`disabled: boolean`、`block: boolean`。
  - `stopPropagation: boolean`，默认 `true`；卡片内仅作视觉入口时可以关闭。
- Slot：按钮文案。
- Emit：`click`；loading 或 disabled 时不发出。
- 状态优先级：disabled、loading、active、default。
- 底层策略：先使用 Wot UI 2.3.0 的 `wd-button`，通过版本准确的 custom class/style 能力覆盖外观；若跨端覆盖无法达到视觉基准，则改用 uni-app 原生 button/view，保持上述 API 不变。

### NeoTag

低圆角描边标签。

- Props：
  - `tone: "lime" | "green" | "amber" | "red" | "blue" | "dark" | "muted"`。
  - `size: "sm" | "md" | "lg"`，默认 `sm`。
- Slot：标签文案。
- 无业务事件。
- 底层策略与 NeoButton 相同，优先验证 Wot UI `wd-tag` 的样式覆盖能力；视觉无法等价时使用 `text`。

### NeoProgress

统一普通进度和目标分段进度。

- Props：
  - `value: number`：当前值。
  - `max: number`：显示上限，非法或小于等于零时按 `1` 处理。
  - `target?: number`：目标分割点；省略时等于 `max`。
  - `label?: string`：可选标题。
  - `valueText?: string`：可选显示值；省略时使用 `value/(target ?? max)`。
  - `showMeta: boolean`：是否显示标题与 `value/max`，默认 `true`。
- 显示规则：
  - `0..target` 使用主强调色。
  - `target..max` 中的超额部分使用危险色。
  - `target < max` 时显示黑色分割线。
  - 所有宽度限制在 `0%..100%`，不因异常数据造成溢出。
- 继续自定义实现，不使用 `wd-progress`，因为后者不能完整表达双区段和目标分割线。

### NeoDateRail

赛事、约队和日程卡片可复用的日期栏。

- Props：`monthDayLabel`、`weekdayLabel`、`timeLabel`、可选 `note`。
- 只负责日期、星期、时间和提示的稳定排版；不解析日期、不计算截止状态。
- 时间区使用荧光绿矩形，长时间范围允许两行但不能改变日期栏宽度。

### NeoSectionHeader

页面区块标题和右侧入口。

- Props：`title`、可选 `caption`、可选 `marker`、可选 `actionLabel`。
- Emit：`action`。
- marker 使用荧光绿方形贴纸；action 使用 outline NeoButton 的小尺寸表现。
- 未传 actionLabel 时不渲染操作控件。

## 首页迁移

- `home/index.vue` 使用 `NeoSectionHeader` 替换两组重复标题结构，并继续持有导航事件。
- `HomeHeroSection.vue` 使用 `NeoSurface` 提供 raised/interactive 外壳；轮播、图片、文案和足球装饰继续由 Hero 组件负责。
- `HomeMatchList.vue` 的 default 分支保留现有卡片和日期栏 DOM；`brutalist` 分支通过局部条件模板接入 `NeoTag`、`NeoProgress` 和 `NeoButton`，卡片外壳与日期栏先改为消费设计令牌。比赛 view model、状态映射、导航意图和头像内容仍属于业务组件。
- `HomeOpportunityList.vue` 是首页专属组件，可以完整使用 `NeoSurface`、`NeoDateRail`、`NeoTag`、`NeoProgress` 和 `NeoButton`；报名和接约动作仍只通过 emit 交给首页。
- `HomeSkeleton.vue` 第一阶段只改用设计令牌，不额外创建 skeleton 组件。
- `HomeMatchList` 的现有 default 视觉调用方必须保持 DOM、class 和计算结果不变。新增视觉组件只在 `variant="brutalist"` 条件内渲染，不能要求“全部比赛”同步迁移。

## 数据流与错误边界

```text
API / Mock / Store
       ↓
home/index.vue（加载、权限、路由、提交）
       ↓ props / emits
HomeMatchList / HomeOpportunityList（业务展示组合）
       ↓ props / slots / visual events
Neo* 视觉组件（无 API、无 Store、无路由）
```

视觉组件不捕获或展示业务请求错误。loading、disabled、tone 等状态由业务组件显式传入。无效进度数据只在视觉层做安全裁剪，不修改原始数据，也不发出副作用。

## Wot UI 集成边界

- 修改 Wot UI 组件代码前读取项目 `.agents/skills/wot-ui-v2/SKILL.md`，并通过已配置 MCP 查询 2.3.0 的 Button、Tag custom class/style 和跨端示例。
- Wot UI 适合承担 Button、Tag 后续的 loading、disabled 和交互语义。
- Surface、Progress、DateRail、SectionHeader 保持自定义，因为它们是本产品的视觉结构而不是通用控件库默认结构。
- 页面不得直接混用 `wd-button` 和 `NeoButton` 来表达同一种 Soft Neo 操作，避免样式分叉。

## 验证与成功标准

- 迁移前保存 `390x844` 首页首屏和完整页截图，作为视觉基线。
- 迁移后在相同 Mock 数据和视口下对照检查至少六项：页面宽度、卡片尺寸、描边、硬阴影、圆角、字体层级、标签颜色和分段进度。
- 迁移前后可见文案、卡片顺序、报名数字、头像、按钮状态和导航目标一致。
- 验证 Hero、首张比赛卡片、首张约队卡片和“全部比赛”四条非提交跳转。
- 确认“全部比赛”未获得 `brutalist` class，继续使用原有圆角和柔和阴影。
- 新开首页标签检查控制台无相关 error/warn，无 Vite 或 Vue 错误覆盖层。
- 执行 `bun run type-check`、`bun run build:h5`、`bun run build:mp-weixin` 和目标文件 `git diff --check`。
- 微信小程序构建必须通过；真机或开发者工具中的最终视觉仍作为人工验收项。
- 不修改 API、Mock、Store、路由、共享顶部栏或底部栏。

## 非目标

- 本次不迁移首页之外的页面。
- 不创建比赛、约队等全局业务卡片。
- 不替换现有接口、Mock、状态管理或路由逻辑。
- 不一次性把所有现有颜色迁移成令牌。
- 不为了组件数量完整而新增输入框、弹窗、表单或 Skeleton 通用组件。
