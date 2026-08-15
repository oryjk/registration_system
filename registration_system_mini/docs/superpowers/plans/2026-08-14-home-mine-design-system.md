# 首页与我的页面组件化及设计系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页和“我的”页面稳定遵循父页面编排、子组件展示，并统一使用 Neo token。

**Architecture:** 首页展示字段进入 `HomeMatchCardViewModel`，列表组件只转发事件；“我的”页面业务编排进入 `useMinePage`，SFC 仅注册生命周期并拼装展示组件。全局壳层使用 `neo-tokens.css` 的 semantic/component token，其他业务域保持不动。

**Tech Stack:** uni-app、Vue 3、TypeScript、Bun Test、Wot UI 2.3。

## Global Constraints

- 不改变后端接口、路由和 JSON 契约。
- 子组件不调用业务 API，不直接操作 store。
- 页面现有访客态、刷新、错误和支付行为保持不变。
- H5 与微信小程序都必须可以构建。

---

### Task 1: 收口首页比赛卡片契约

**Files:**
- Modify: `src/types/viewModels.ts`
- Modify: `src/pages/home/homeMatchState.ts`
- Modify: `src/pages/home/components/HomeMatchCard.vue`
- Modify: `src/pages/home/components/HomeMatchList.vue`
- Modify: `src/pages/home/index.vue`
- Modify: `src/pages/home/matches/index.vue`
- Test: `src/pages/home/__tests__/homeMatchState.test.ts`
- Test: `src/pages/__tests__/homePageLoading.test.ts`

**Interfaces:**
- Produces: `HomeMatchCardViewModel.dateBlock`, `stageTone`, `statusTone`。
- Produces: `HomeMatchList` props 仅保留 `matches`、`isGuestMode`、`navigatingMatchId`。

- [ ] 写失败测试，断言 ViewModel 提供日期块和 tone，页面不再透传展示函数。
- [ ] 运行首页定向测试，确认因缺少新契约而失败。
- [ ] 实现 ViewModel 字段并删除卡片旧版分支和函数 props。
- [ ] 同步首页与二级列表消费者。
- [ ] 运行首页定向测试与类型检查。

### Task 2: 抽离“我的”页面编排 composable

**Files:**
- Create: `src/pages/user/useMinePage.ts`
- Modify: `src/pages/user/index.vue`
- Modify: `src/pages/user/mineTypes.ts`
- Modify: `src/pages/user/mineOverviewState.ts`
- Modify: `src/pages/user/components/MineMatchSection.vue`
- Test: `src/pages/user/__tests__/mineOverviewState.test.ts`
- Test: `src/pages/__tests__/userPageBackground.test.ts`

**Interfaces:**
- Produces: `useMinePage()` 返回模板 refs/computed、加载/认证/切换/支付/导航 actions。
- Produces: `MineMatchSummary.statusTone`，展示组件不再接收函数 prop。

- [ ] 写失败测试，断言 mine view model 带 tone，页面使用 `useMinePage` 且不直接导入业务 API。
- [ ] 运行个人中心定向测试，确认因新边界缺失而失败。
- [ ] 新建 composable 并迁移页面状态、计算属性与动作。
- [ ] 精简 `index.vue` 为生命周期和模板 wiring。
- [ ] 运行个人中心定向测试与类型检查。

### Task 3: 统一 Neo token 与共享壳层

**Files:**
- Modify: `src/styles/neo-tokens.css`
- Modify: `src/App.vue`
- Modify: `src/uni.css`
- Modify: `src/components/AppTabHeader.vue`
- Modify: `src/components/BottomTabBar.vue`
- Modify: `src/pages/home/components/HomeHeroSection.vue`
- Modify: `src/pages/home/components/HomeMatchCard.vue`
- Delete: `src/pages/home/components/HomeOpportunityList.vue`
- Delete: `src/pages/home/components/HomeDigestGrid.vue`
- Test: `src/components/__tests__/bottomTabBarAssets.test.ts`

**Interfaces:**
- Produces: `--neo-color-accent` 为共享壳层唯一强调色。
- Produces: `--app-primary` 仅由 `neo-tokens.css` 提供兼容映射。

- [ ] 更新静态契约测试，要求共享壳层使用 token 且旧组件不存在。
- [ ] 运行测试确认旧硬编码和文件使测试失败。
- [ ] 增补所需 primitive/semantic token 并替换结构 UI 硬编码。
- [ ] 删除无运行时引用的旧首页组件。
- [ ] 运行组件测试和硬编码颜色扫描。

### Task 4: 更新架构文档与完整验证

**Files:**
- Modify: `docs/mini-architecture.md`
- Create: `docs/mini-design-system.md`
- Modify: `docs/superpowers/specs/2026-08-14-home-mine-design-system-design.md`

- [ ] 校正首页和 Mine 组件清单、职责和重构状态。
- [ ] 写 Neo 风格、token 层次、组件复用和硬编码例外规范。
- [ ] 运行 `bun test`。
- [ ] 运行 `bun run type-check`。
- [ ] 运行 `bun run build:mp-weixin`。
- [ ] 运行 `bun run build:h5`。
- [ ] 检查最终 diff 和工作区状态，记录无法执行的模拟器/真机验收。
