# 小程序 Neo 设计系统

## 设计语言

小程序当前采用 Neo / neo-brutalist 方向：高对比墨色文字、浅暖色画布、荧光青柠强调色、明确边框和偏移阴影。页面应该让信息层级和交互状态一眼可见，不通过大量渐变或装饰色制造层级。

## Token 层次

`src/styles/neo-tokens.css` 按三层组织：

1. primitive：原始色值、透明度、圆角、阴影和动效基础值；
2. semantic：页面、表面、文字、强调、成功、警告、危险和信息语义；
3. component：Surface、Button、Tag、Progress、Segmented、Avatar 等组件契约。

结构 UI 使用 semantic 或 component token，不在页面和共享壳层新增散落的 hex。唯一视觉强调色是 `--neo-color-accent`（当前 primitive 为 `#b9f24b`）。兼容别名 `--app-primary` 只在 token 文件中映射。

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
