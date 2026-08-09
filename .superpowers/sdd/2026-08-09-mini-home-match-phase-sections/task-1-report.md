# Task 1 实现报告：Go Match DTO/API 与统一 mock

## 交付结果

已完成 Task 1，范围仅限 brief 指定的 mini 端文件：

- 新增 Go Match DTO 契约：`registration_system_mini/src/types/match.ts`
- 新增 Go Match API 封装：`registration_system_mini/src/api/match.ts`
- 新增 API 合同测试：`registration_system_mini/src/api/__tests__/matchApi.test.ts`
- 新增统一 mock 数据：`registration_system_mini/src/mock/data/matches.ts`
- 接入 mock 路由：`registration_system_mini/src/mock/handlers.ts`

没有修改首页、卡片组件或二级页面。

## 实现内容

### 1. Go Match DTO 契约

在 `src/types/match.ts` 中补齐了 Task 1 要求的公开类型：

- `AppMatchSummary`
- `AppHomeActionMatch`
- `AppHomeEndedMatch`
- `AppMatchHomeResponse`
- `AppMatchListResponse`

同时补充了契约需要的基础类型：

- `AppMatchStatus`
- `AppMatchUiPhase`
- `AppMatchPhaseSource`
- `AppHomeMatchGroup`

字段命名按 brief 的 snake_case JSON 约定保留，便于直接对齐 Go 后端返回。

### 2. API 封装

在 `src/api/match.ts` 中新增：

- `getMatchHome(): Promise<AppMatchHomeResponse>`
- `listMyMatches(params: { page: number; pageSize: number }): Promise<AppMatchListResponse>`

实现使用现有 `requestApi` 与 `buildQueryString`，并且固定走 Go envelope 约定对应的 `/matches/home` 和 `/matches?scope=mine...` 路径。

### 3. API 合同测试

在 `src/api/__tests__/matchApi.test.ts` 中只 mock 了 HTTP 边界，不 mock 业务逻辑：

- 验证 `getMatchHome()` 会请求 `GET /matches/home`
- 验证 `listMyMatches({ page: 2, pageSize: 20 })` 会请求 `GET /matches?scope=mine&page=2&page_size=20`

为了适配当前仓库的 `bun:test` 类型声明，我把测试写成动态导入形式，并用普通数组记录调用参数，这样既能在 Bun 下运行，也能通过 `bun run type-check`。

### 4. 动态 mock 数据

在 `src/mock/data/matches.ts` 中新增了统一的 Match mock 生成：

- 使用 `Date.now()` 动态生成时间戳
- 覆盖了 brief 要求的状态组合：
  - future / registering
  - ongoing
  - 时间已结束但 status 仍未更新为 ended
  - 显式 ended
  - cancelled

同时导出了：

- `mockMatchHome`
- `mockMyMatches`
- `paginateMockMatches(...)`

其中 `paginateMockMatches` 会按 `page` / `page_size` 返回 `{ items, total, page, page_size }`。

### 5. Mock 路由接入

在 `src/mock/handlers.ts` 里只新增了两条现有机制下的 mock 路由：

- `GET /matches/home`
- `GET /matches`

没有新增任何后端路由，也没有改动现有 request 入口。

## 验证结果

已完成并通过：

```bash
cd registration_system_mini
bun test src/api/__tests__/matchApi.test.ts
bun run type-check
```

结果：

- API contract test: 2 passed
- type-check: passed

## 备注

- 本次 mock 数据是按当前时间动态生成的，避免写死过期时间。
- mock envelope 继续沿用现有 `{ code, message, data }` 结构。
- 后续首页阶段分组任务可以直接复用这套 Match DTO 和 mock 入口，不需要再为首页单独造一套契约。

## Fix round 1

### 修复内容

- 将 `registration_system_mini/src/mock/data/matches.ts` 从模块加载时一次性物化的数据，改为按请求动态生成：
  - `mockMatchHome()` 每次调用都会基于当前 `Date.now()` 重新生成 home 数据
  - `mockMyMatches()` 每次调用都会基于当前 `Date.now()` 重新生成列表数据
  - `paginateMockMatches(...)` 继续只负责分页，不再持有冻结数据
- 将 match ID 从短 ID `match-001` 这类字符串，改为稳定的 UUID 风格 ID，并保持同一比赛在 home / list 里的 ID 一致。
- 在 `src/mock/handlers.ts` 中把 `/matches/home` 和 `/matches` 的 handler 改成每次请求调用生成函数，而不是直接返回模块级静态常量。

### RED / GREEN 证据

原始 Task 1 报告里没有保留本轮修复所需的 RED 证据；这次修复按要求重新补了聚焦测试并先确认失败，再实现修复。

RED：

```bash
cd registration_system_mini
bun test src/api/__tests__/matchApi.test.ts
```

结果：失败，分别暴露出：

- mock home 数据在两次不同 `Date.now()` 下仍然返回相同的时间戳
- mock match ID 不符合 UUID-like 约束

GREEN：

```bash
cd registration_system_mini
bun test src/api/__tests__/matchApi.test.ts
bun run type-check
```

结果：通过。

### 提交

本轮修复提交：

- `c3b83a7`（base）
- `7c3cc01`（fix round 1，新增动态 mock 与 UUID-like ID）

### Concerns

- 无。
