# 小程序 Neo 设计系统

## 设计语言

小程序当前采用 Neo / neo-brutalist 方向：高对比墨色文字、浅暖色画布、荧光青柠强调色（可切换为活力橙）、明确边框和偏移阴影。页面应该让信息层级和交互状态一眼可见，不通过大量渐变或装饰色制造层级。

## Token 层次

`src/styles/neo-tokens.css` 按三层组织：

1. primitive：原始色值、透明度、圆角、阴影和动效基础值；
2. semantic：页面、表面、文字、强调、成功、警告、危险和信息语义；
3. component：Surface、Button、Tag、Progress、Segmented、Avatar 等组件契约。

结构 UI 使用 semantic 或 component token，不在页面和共享壳层新增散落的 hex。唯一视觉强调色族是 `--neo-color-accent` / `--neo-color-accent-soft` / `--neo-color-accent-deep`（primitive 默认为青柠 `#b9f24b` 族；`--neo-primitive-accent-rgb` 供 rgba 透明变体）。兼容别名 `--app-primary` 只在 token 文件中映射。

## 强调色主题

- 支持两套强调色主题：`lime`（青柠，默认）与 `orange`（活力橙），定义在 `src/config/themePalettes.ts`（token 默认值与该文件保持一致）。活力橙主题除强调色族外还带两个专属变体：主按钮（CTA token 族）换橙底墨字、hero 区（`--neo-color-hero/-hero-fg`）换暖棕深底；两套主题的 hero 都保持深底白字（曾试过浅橙底深棕字，硬阴影观感差，已回退）。文字、描边、硬阴影的墨色、`NeoSurface dark` 深色卡片与时间条底色两套主题保持一致，不做主题化。
- 切换机制：mp-weixin 无法在运行时给 `page` 加 class，主题通过**每个页面的 `<page-meta :page-style="themePageStyle" />`** 注入 page 级 CSS 变量覆盖实现（`useAccentTheme()` 来自 `src/stores/theme.ts`）。page 级覆盖可级联到 root-portal 渲染的 Wot 弹层；新增页面必须带 page-meta（有守卫测试扫描 `pages.json`）。
- 偏好持久化在本地（`src/utils/themeStorage.ts`），入口在「我的」页主题色卡片；所有主题（含默认青柠）都注入显式覆盖串——uni-h5 对空串 page-style 不更新，默认主题若为空串会导致切回时旧主题残留。
- 原生组件（如 `<switch color>`）只接受 hex，绑定 store 的 `accentHex`，不要写字面量色值。

## 组件边界

- 全局 `src/components/` 只放跨页面且 API 稳定的壳层或 Neo 基础组件。
- `src/pages/<domain>/components/` 放页面专属展示组件；通过 props 接收 ViewModel，通过 emits 发出用户意图。
- 页面 `index.vue` 负责生命周期、数据加载、权限、错误和导航编排；复杂状态和纯转换放到同目录 `*State.ts` 或 `use*Page.ts`。
- 首页精选比赛和首页全状态搜索是两条独立数据流：`homeMatchState.ts` 不承担关键词搜索；搜索使用服务端模糊匹配和时间倒序，每页 5 场通过页面触底与结果底部可见性观察追加，`homeMatchSearchState.ts` 只合并分页并映射卡片，不修改首页阶段分组。

## 颜色例外

- 球衣颜色、球队颜色等业务数据值不是视觉 token，不能因为颜色扫描而删除。
- 首页球体、球网、图片遮罩等插画内部颜色属于 decorative asset colors，可以保留在组件样式中，并在相邻 CSS 注释中标明。
- 其他结构性背景、文字、边框、圆角和阴影必须引用 token。

## 跨端约束

- H5 与 MP-Weixin 共用 Vue/TypeScript 组件和 `uni.*` API。
- 不使用 DOM API、浏览器存储或仅 H5 可用的布局能力。
- Wot UI 组件继续遵循项目 `.agents/skills/wot-ui-v2/SKILL.md`，Neo 组件通过 `custom-class` / `custom-style` 和 token 适配，不修改组件库 API。
