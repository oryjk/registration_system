# 首页与我的页面组件化及设计系统设计

## 目标

让首页和“我的”页面形成稳定的父页面编排、子组件展示边界，并让 Neo 设计 token 成为本轮页面与共享壳层视觉样式的唯一来源，方便后续 AI/Agent 在局部文件内安全修改。全仓其他业务域的 token 迁移留待后续增量完成。

## 范围

- `src/pages/home/`：首页、`home/matches` 二级列表及共用比赛组件。
- `src/pages/user/`：个人中心页面及页面局部组件；`user/matches` 本轮只迁移直接共享的全局颜色，不重构其业务结构。
- `src/styles/neo-tokens.css`、`src/uni.css`、`src/App.vue`：全局视觉基线。
- `src/components/AppTabHeader.vue`、`src/components/BottomTabBar.vue`：首页与我的共同使用的应用壳层。
- 相关测试和 `docs/mini-architecture.md`。

不修改后端接口、路由契约、业务 API 原子封装或其他业务域页面。共享壳层使用的强调色会在全应用同步变化，这是本轮允许的全局视觉影响；其他页面内部样式不做批量迁移。

## 组件边界

### 首页

`src/pages/home/index.vue` 保留：

- uni-app 生命周期和分享配置；
- 登录态、加载态、刷新和错误状态；
- `getMatchHome` 数据加载；
- 页面导航和子组件事件 wiring。

`HomeMatchList.vue` 只负责列表遍历、列表间距和 `match-tap` 事件转发，不再接收展示格式化函数。首页和 `home/matches/index.vue` 两个消费者同步迁移。

`HomeMatchCard.vue` 负责单卡片展示，包括日期块、阶段/状态 tone 和报名进度视觉数据；最终 props/emits 契约为：

```ts
defineProps<{
  match: HomeMatchCardViewModel;
  isGuestMode: boolean;
  isNavigating: boolean;
}>();

defineEmits<{
  (event: "matchTap", match: HomeMatchCardViewModel): void;
}>();
```

`HomeMatchCardViewModel` 新增声明式字段：

```ts
dateBlock: { monthDay: string; weekday: string; timeLabel: string };
stageTone: NeoTagTone;
statusTone: NeoTagTone;
```

进度统一使用 `NeoProgress`，不再保留旧版手工宽度计算。`default` / `brutalist` 过渡变体删除，首页与二级比赛列表统一为 Neo 卡片样式。

日期、阶段和状态的展示值由 `homeMatchState.ts` 构建；tone 类型放在共享 `src/types/viewModels.ts` 中，不从 Vue 组件文件反向导入。组件不调用 API、不操作 store。

### 我的页面

`src/pages/user/index.vue` 保留模板编排，以及 `onShow/onLoad/onUnload` 生命周期注册和 `session:login-completed` 事件注册/清理。

新增 `useMinePage.ts` 承载：

- 页面级响应式状态；
- session/team context 读取和数据加载；
- 登录、退出、球队切换、身份切换；
- 会员续费支付流程及错误提示；
- 页面导航方法。

`useMinePage()` 返回模板所需的 refs/computed 和以下 actions：

```ts
loadPageData(options?: { preserveContent?: boolean }): Promise<void>;
handleSwitchTeam(teamId: number): void;
handleSwitchIdentity(identityId: string): void;
handleLogin(): Promise<void>;
handleLogout(): Promise<void>;
handleMembershipRenewal(): Promise<void>;
handleEditProfile(): void;
openTeamManage(teamId?: number): void;
openNotifications(): void;
openUserMatches(): void;
openMatchDetail(matchId: string): void;
openBilling(): void;
```

composable 不自行注册页面生命周期，避免重复加载和事件清理遗漏。

现有 `Mine*` 组件继续保持展示组件职责，仅通过 props 接收 view model、通过 emits 发出用户意图。暂不把页面专属组件提升到全局 `src/components/`。

## Token 方案

`src/styles/neo-tokens.css` 继续使用三层结构：

1. primitive：原始颜色、尺寸和动效值；
2. semantic：页面、表面、文字、强调色和状态色；
3. component：surface、button、tag、progress、segmented、avatar 等组件契约。

统一使用 `#b9f24b` 对应的 Neo 强调色 `--neo-color-accent`。删除 `uni.css` 对旧 `--app-primary` 的重复定义，兼容别名仍只在 `neo-tokens.css` 中映射。`App.vue`、顶部/底部导航和首页/我的页面的结构色、边框、圆角、阴影通过 token 或组件 token 引用。字体和间距本轮保留现有值，不进行无关的全局视觉重设计。

`#c8ff00` 若作为球衣/队服等业务数据默认值存在，不属于视觉 token，不在本轮删除范围。透明遮罩、图片质感渐变、球体等插画内部颜色允许保留；结构 UI 的纯色不得新增硬编码。

## 数据流与错误处理

- API 原子调用仍在 `src/api/`。
- View model 转换仍在 `homeMatchState.ts`、`mineOverviewState.ts` 或页面局部纯函数中。
- composable 负责异步状态和错误消息；展示组件不处理 API 异常。
- 所有现有访客态、首次加载 skeleton、刷新保留内容、支付取消和登录完成刷新行为保持不变。

错误呈现保持现状：

- 页面数据加载失败：更新页内 `errorMessage`，不额外 Toast；
- 登录失败：Toast；
- 无权限续费：Toast；
- 支付取消：显示“已取消支付” Toast；
- 支付/API/同步失败：显示错误 Toast；
- 支付成功或订单创建：刷新页面后显示结果 Toast。

## 验证

- 新增/更新纯函数测试，覆盖首页卡片的 `dateBlock`、`stageTone`、`statusTone`，并同步首页与二级比赛列表的组件契约测试。
- `useMinePage` 本轮以现有页面行为测试和类型检查保护；不为重构强行引入模块 mock。关键行为矩阵包括访客加载、成功加载、保留内容刷新、切队防重、登录完成刷新、退出确认、无权限续费、支付成功/取消/失败。
- 运行 `bun test`、`bun run type-check`、`bun run build:mp-weixin`、`bun run build:h5`。
- 在 H5 检查首页/我的的访客态、skeleton、错误态、底栏和球队切换；微信开发者工具人工验收支付取消与共享导航。无法在当前环境执行的人工项必须在交付中明确说明。
- 颜色扫描范围为 `src/pages/home/**`、`src/pages/user/index.vue`、`src/pages/user/components/**`、`src/App.vue`、两个共享导航组件和 `src/uni.css`。排除 mock/test、类型/业务数据色值、图片/插画渐变中的颜色；允许的装饰色在相邻 CSS 注释中标记为 `decorative asset colors`。
- 更新 `docs/mini-architecture.md` 中过时的首页组件和 `Mine*` 组件名称，删除未使用组件的错误描述。
