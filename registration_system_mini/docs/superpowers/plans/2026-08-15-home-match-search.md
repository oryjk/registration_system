# 首页比赛搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页为当前用户可见的全部比赛提供按名称或地点模糊搜索的结果，并按开始时间倒序展示所有比赛状态。

**Architecture:** 首页父页面负责搜索输入、服务端分页、错误状态、结果 ViewModel 转换和详情导航；`HomeMatchSearch.vue` 只负责搜索框与结果展示。`homeMatchSearchState.ts` 提供无副作用的分页去重合并和全状态卡片映射，复用现有 `listMyMatches` API 原子封装。

**Tech Stack:** uni-app、Vue 3、TypeScript、Bun Test、现有 Neo 组件。

## Global Constraints

- 搜索范围是当前用户可见的全部比赛，调用现有 `scope=mine` 列表接口，不修改后端契约。
- 结果不按报名中、进行中、已结束或取消状态过滤；后端按名称/地点匹配和 `start_time` 倒序排列，每页返回 5 场。
- 子组件不调用 API 或 store；页面父层负责异步状态、权限提示和导航。
- H5 与微信小程序保持兼容，使用 `uni.*` API，不使用 DOM API。

---

### Task 1: 锁定搜索纯函数与页面边界

**Files:**
- Create: `src/pages/home/homeMatchSearchState.ts`
- Modify: `src/pages/home/__tests__/homeMatchState.test.ts`
- Modify: `src/pages/__tests__/homePageLoading.test.ts`

**Interfaces:**
- Produces `HOME_MATCH_SEARCH_PAGE_SIZE = 5`。
- Produces `mergeHomeMatchSearchPage(currentMatches, response)`，只合并当前响应页、按 ID 去重并计算 `hasMore`。
- 页面源码保持父层拥有搜索状态，搜索列表不接收展示格式化回调。

- [x] 写失败测试：API 传递 `search` 且固定每页 5 场，Mock 在分页前按名称/地点匹配。
- [x] 写失败测试：分页响应追加去重，并在空页或 total 达成时停止。
- [ ] 运行搜索定向测试，确认因模块/函数不存在而红灯。
- [x] 实现分页合并纯函数，接口参数扩展为 `{ page, pageSize, search }`。
- [ ] 运行定向测试确认绿灯。

### Task 2: 新增搜索展示组件

**Files:**
- Create: `src/pages/home/components/HomeMatchSearch.vue`
- Modify: `src/pages/home/components/HomeMatchCard.vue`（仅在需要时兼容 cancelled 展示 tone）

**Interfaces:**
- Props：`query`、`isLoading`、`hasSearched`、`isGuestMode`、`matches`、`errorMessage`。
- Emits：`updateQuery`、`search`、`clear`、`retry`、`matchTap`。
- 组件只展示搜索栏、加载/空态/错误态和 `HomeMatchList`，不直接读 API/store。

- [ ] 先补页面源码契约测试，要求搜索组件存在且没有 API 导入。
- [ ] 运行测试确认组件边界断言红灯。
- [ ] 实现搜索栏和结果展示，复用 `HomeMatchList`/`HomeMatchCard`。
- [ ] 运行组件契约测试和类型检查。

### Task 3: 接入首页父页面

**Files:**
- Modify: `src/pages/home/index.vue`
- Modify: `src/pages/home/homeMatchState.ts`（必要时为 cancelled 结果提供可展示 ViewModel 映射）
- Modify: `src/pages/home/__tests__/homeMatchState.test.ts`

**Interfaces:**
- 首页新增搜索 refs：query、isSearching、hasSearched、searchError、searchMatches。
- 搜索提交：游客显示登录提示；登录用户请求第 1 页，页面触底时每次追加下一页 5 场。
- 空关键词清空结果；结果点击沿用现有 `handleMatchTap`。

- [ ] 为 cancelled 搜索结果补充可展示 stage/status tone 断言。
- [ ] 运行首页定向测试确认红灯。
- [x] 实现父页面搜索状态、`onReachBottom` 分页加载、转换和事件 wiring。
- [ ] 运行首页相关测试与类型检查确认绿灯。

### Task 4: 文档与完整验证

**Files:**
- Modify: `docs/mini-architecture.md`
- Create: `docs/mini-design-system.md`（如尚未存在，仅补搜索组件边界说明）

- [ ] 更新首页组件清单，记录 `HomeMatchSearch` 和 `homeMatchSearchState.ts` 的职责。
- [ ] 运行 `bun test`。
- [ ] 运行 `bun run type-check`。
- [ ] 运行 `bun run build:mp-weixin`。
- [ ] 运行 `bun run build:h5`。
- [ ] 运行 `git diff --check` 并记录无法进行的微信开发者工具/真机验收项。

### Task 5: 调整分页终态文案

**Files:**
- Modify: `src/pages/home/components/HomeMatchSearch.vue`

**Interfaces:**
- Consumes: `hasMore: boolean`。
- Produces: 有下一页时展示“继续下滑加载更多”，无下一页时展示“已经捅到底了”。

- [x] 将 `hasMore === false` 分支的“没有更多比赛了”替换为“已经捅到底了”。
- [x] 运行 `rg -n "继续下滑加载更多|已经捅到底了|没有更多比赛了" src/pages/home/components/HomeMatchSearch.vue`，确认两个分页状态文案互斥且旧文案已移除。
