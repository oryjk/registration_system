# Mini Home Match Phase Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小程序首页比赛数据切换到现有 Go Match API，按时间展示待报名、进行中和已结束三个区域，并提供进行中/已结束的完整二级列表。

**Architecture:** API 层只封装 Go `/matches/home` 与 `/matches` 契约；`homeMatchState.ts` 作为无副作用的阶段分类、去重、排序和 ViewModel 转换层；首页与二级页只负责加载、状态编排和导航。比赛卡片拆为可复用子组件，通过 ViewModel 控制报名进度、时间说明和只读动作，不在模板中重复业务判断。

**Tech Stack:** uni-app、Vue 3、TypeScript 4.9、Vite 5、Bun Test、现有 Neo/Wot UI 视觉组件、Go Gin App API。

## Global Constraints

- 后端来源只允许 `registration_system_go/`，不读取或修改 Rust 后端。
- 不新增 Go HTTP 路由、数据库字段或 `registration_deadline`。
- 首页比赛数据只调用 `/api/v1/app/matches/home`；二级列表只调用 `/api/v1/app/matches?scope=mine`。
- 阶段优先级固定为 `cancelled -> excluded`、`ended/status or now >= end_time -> ended`、`start_time <= now < end_time -> ongoing`、`now < start_time -> upcoming`。
- 首页“进行中的比赛”和“已结束的比赛”各最多 2 场；进行中按 `start_time` 倒序，已结束按 `end_time` 倒序。
- 首页移除“约队机会”区域、状态、操作和请求，不提供替代入口。
- H5 与微信小程序共用实现；只使用 `uni.*`，不使用 DOM、`window`、`localStorage` 或 `wx.*`。
- 保持现有 Soft Neo-Brutalism 风格；视觉变更用类型检查、双端构建和浏览器截图验证，不机械新增纯样式断言。
- 业务与共享状态变更遵循 TDD：先运行新增测试确认正确失败，再写最小实现。

---

## File Map

- Create `registration_system_mini/src/types/match.ts`: Go Match App DTO 与页面阶段类型。
- Create `registration_system_mini/src/api/match.ts`: Go 首页摘要和“我的比赛”分页请求。
- Create `registration_system_mini/src/api/__tests__/matchApi.test.ts`: API 参数与 Go 路径契约测试。
- Create `registration_system_mini/src/mock/data/matches.ts`: 相对当前时间生成的三阶段 Match mock。
- Modify `registration_system_mini/src/mock/handlers.ts`: 注册 `/matches/home` 与 `/matches` mock 路由。
- Create `registration_system_mini/src/pages/home/homeMatchState.ts`: 阶段计算、合并去重、排序、首页截断与卡片 ViewModel 转换。
- Create `registration_system_mini/src/pages/home/__tests__/homeMatchState.test.ts`: 时间边界、去重、排序和两场限制测试。
- Modify `registration_system_mini/src/types/viewModels.ts`: 为卡片增加阶段、时间说明、进度可见性和详情可达性。
- Create `registration_system_mini/src/pages/home/components/HomeMatchCard.vue`: 单张比赛卡片及三阶段视觉差异。
- Modify `registration_system_mini/src/pages/home/components/HomeMatchList.vue`: 保留列表循环并委托 `HomeMatchCard`。
- Modify `registration_system_mini/src/pages/home/index.vue`: 只读取 Go 首页摘要，展示三个比赛区域并删除约队逻辑。
- Modify `registration_system_mini/src/pages/__tests__/homePageLoading.test.ts`: 移除旧活动/约队断言，保留加载行为并覆盖 Go 首页与阶段路由接入。
- Create `registration_system_mini/src/pages/home/matches/homeMatchPagination.ts`: 前端阶段分页扫描状态机。
- Create `registration_system_mini/src/pages/home/matches/__tests__/homeMatchPagination.test.ts`: 空筛选页继续加载、去重和终止条件测试。
- Modify `registration_system_mini/src/pages/home/matches/index.vue`: 支持 `phase=upcoming|ongoing|ended`、上拉分页和完整列表。

---

### Task 1: Add the Go Match Client Contract and Unified Mock Data

**Files:**
- Create: `registration_system_mini/src/types/match.ts`
- Create: `registration_system_mini/src/api/match.ts`
- Create: `registration_system_mini/src/api/__tests__/matchApi.test.ts`
- Create: `registration_system_mini/src/mock/data/matches.ts`
- Modify: `registration_system_mini/src/mock/handlers.ts`

**Interfaces:**
- Produces: `getMatchHome(): Promise<AppMatchHomeResponse>`.
- Produces: `listMyMatches(params: { page: number; pageSize: number }): Promise<AppMatchListResponse>`.
- Produces DTOs `AppMatchSummary`, `AppHomeActionMatch`, `AppHomeEndedMatch`, `AppMatchHomeResponse`, and `AppMatchListResponse`.
- Mock routes return the same Go `{ code, message, data }` payload shape through the existing mock envelope.

- [ ] **Step 1: Write the failing API contract test**

Create `src/api/__tests__/matchApi.test.ts` and mock only the HTTP boundary:

```ts
import { beforeEach, describe, expect, mock, test } from "bun:test";

const requestApi = mock(async () => ({}));
mock.module("@/utils/request", () => ({ requestApi }));

const { getMatchHome, listMyMatches } = await import("../match");

describe("Go match API", () => {
  beforeEach(() => requestApi.mockClear());

  test("loads the authenticated home summary", async () => {
    await getMatchHome();
    expect(requestApi).toHaveBeenCalledWith({ url: "/matches/home", auth: true });
  });

  test("loads a page of the current user's matches", async () => {
    await listMyMatches({ page: 2, pageSize: 20 });
    expect(requestApi).toHaveBeenCalledWith({
      url: "/matches?scope=mine&page=2&page_size=20",
      auth: true,
    });
  });
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
cd registration_system_mini
bun test src/api/__tests__/matchApi.test.ts
```

Expected: FAIL because `src/api/match.ts` does not exist.

- [ ] **Step 3: Define the exact Go DTOs**

Create `src/types/match.ts` with these public shapes:

```ts
export type AppMatchStatus = "registering" | "ongoing" | "ended" | "cancelled";
export type AppMatchUiPhase = "upcoming" | "ongoing" | "ended" | "excluded";

export interface AppMatchPhaseSource {
  id: string;
  status: AppMatchStatus;
  start_time: string;
  end_time: string;
}

export interface AppHomeMatchGroup {
  id: string;
  kind: "host_team" | "guest_team" | "individual_opponent";
  status: "open" | "closed" | "cancelled";
  min_players: number | null;
  max_players: number | null;
  attending_count: number;
  my_registration_status: "unknown" | "attending" | "leave" | "absent" | "cancelled" | null;
}

export interface AppHomeActionMatch extends AppMatchPhaseSource {
  name: string;
  host_team_name: string;
  opponent_name: string;
  players_per_team: number;
  location: string;
  group: AppHomeMatchGroup;
}

export interface AppHomeEndedMatch extends AppMatchPhaseSource {
  name: string;
  host_team_name: string;
  opponent_name: string;
  location: string;
}

export interface AppMatchSummary extends AppMatchPhaseSource {
  name: string;
  publication_mode: "offline_confirmed" | "online_team" | "online_individual";
  opponent_state: "no_recruitment" | "recruiting" | "confirmed";
  host_team_id: number;
  host_team_name: string;
  away_team_id: number | null;
  away_team_name: string | null;
  opponent_name: string | null;
  players_per_team: number;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppMatchHomeResponse {
  action_items: AppHomeActionMatch[];
  ended_items: AppHomeEndedMatch[];
  ended_has_more: boolean;
}

export interface AppMatchListResponse {
  items: AppMatchSummary[];
  total: number;
  page: number;
  page_size: number;
}
```

- [ ] **Step 4: Implement the API wrapper and make the contract test GREEN**

Create `src/api/match.ts`:

```ts
import type { AppMatchHomeResponse, AppMatchListResponse } from "@/types/match";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function getMatchHome() {
  return requestApi<AppMatchHomeResponse>({ url: "/matches/home", auth: true });
}

export function listMyMatches(params: { page: number; pageSize: number }) {
  const query = buildQueryString({ scope: "mine", page: params.page, page_size: params.pageSize });
  return requestApi<AppMatchListResponse>({ url: `/matches?${query}`, auth: true });
}
```

Run `bun test src/api/__tests__/matchApi.test.ts` and expect 2 PASS.

- [ ] **Step 5: Add realistic dynamic Match mock data and handlers**

Create `src/mock/data/matches.ts` with a helper that returns ISO timestamps relative to `Date.now()`. Export:

```ts
export const mockMatchHome: AppMatchHomeResponse;
export const mockMyMatches: AppMatchSummary[];
```

The data set must include at least: two future `registering`, two currently active (`start_time < now < end_time`), two time-ended but still `ongoing/registering`, two explicit `ended`, and one `cancelled`. Use stable UUID-like IDs and the existing team names.

Register in `src/mock/handlers.ts`:

```ts
{
  method: "GET",
  pattern: "/matches/home",
  handler: () => mockMatchHome,
},
{
  method: "GET",
  pattern: "/matches",
  handler: (req) => paginateMockMatches(mockMyMatches, req.query),
},
```

`paginateMockMatches` must honor `page` and `page_size` and return `{ items, total, page, page_size }`.

- [ ] **Step 6: Verify and commit Task 1**

Run:

```bash
bun test src/api/__tests__/matchApi.test.ts
bun run type-check
```

Then commit:

```bash
git add registration_system_mini/src/types/match.ts registration_system_mini/src/api/match.ts registration_system_mini/src/api/__tests__/matchApi.test.ts registration_system_mini/src/mock/data/matches.ts registration_system_mini/src/mock/handlers.ts
git commit -m "feat(mini): add Go match client and mock contract"
```

---

### Task 2: Build the Shared Match Phase and ViewModel Layer

**Files:**
- Create: `registration_system_mini/src/pages/home/homeMatchState.ts`
- Create: `registration_system_mini/src/pages/home/__tests__/homeMatchState.test.ts`
- Modify: `registration_system_mini/src/types/viewModels.ts`

**Interfaces:**
- Consumes: `AppMatchPhaseSource`, `AppMatchUiPhase`, home response DTOs and list DTOs from Task 1.
- Produces: `resolveMatchPhase(match, now): AppMatchUiPhase`.
- Produces: `groupMatchesByPhase(items, now)` and `buildHomeMatchSections(response, now, limit)`.
- Produces: `toGoHomeMatchCard(item, phase): HomeMatchCardViewModel`.

- [ ] **Step 1: Write failing boundary and sorting tests**

Create `src/pages/home/__tests__/homeMatchState.test.ts` with fixed UTC timestamps. Include these exact assertions:

```ts
expect(resolveMatchPhase(cancelled, now)).toBe("excluded");
expect(resolveMatchPhase(explicitEnded, now)).toBe("ended");
expect(resolveMatchPhase({ ...base, status: "ongoing", end_time: nowIso }, now)).toBe("ended");
expect(resolveMatchPhase({ ...base, start_time: nowIso, end_time: laterIso }, now)).toBe("ongoing");
expect(resolveMatchPhase({ ...base, start_time: laterIso }, now)).toBe("upcoming");
```

Add a home response containing a duplicate ID in both arrays, three ongoing items with different starts, and three ended items with different ends. Assert one copy per ID, ongoing/ended descending order, and each returned section length equals 2.

- [ ] **Step 2: Run the test and verify RED**

Run `bun test src/pages/home/__tests__/homeMatchState.test.ts`.

Expected: FAIL because `homeMatchState.ts` does not exist.

- [ ] **Step 3: Extend the card ViewModel for phase-aware rendering**

Modify `HomeMatchCardViewModel` in `src/types/viewModels.ts`:

```ts
phase: Exclude<AppMatchUiPhase, "excluded">;
dateNote: string;
showRegistrationProgress: boolean;
showParticipantAvatars: boolean;
canOpenDetail: boolean;
```

Keep existing numeric progress fields so the existing `NeoProgress` contract stays stable.

- [ ] **Step 4: Implement the minimal pure state functions**

In `homeMatchState.ts` implement:

```ts
export function resolveMatchPhase(match: AppMatchPhaseSource, now: Date): AppMatchUiPhase {
  if (match.status === "cancelled") return "excluded";
  if (match.status === "ended") return "ended";
  const nowMs = now.getTime();
  if (parseDateValue(match.end_time).getTime() <= nowMs) return "ended";
  if (parseDateValue(match.start_time).getTime() <= nowMs) return "ongoing";
  return "upcoming";
}
```

Implement generic dedupe by `id`; upcoming sort by `start_time` ascending, ongoing by `start_time` descending, ended by `end_time` descending. `buildHomeMatchSections` merges `action_items` first and `ended_items` second, keeps the richer action item on duplicate IDs, groups, maps to cards, and applies the supplied section limit.

Map home/list DTOs to cards with:

- `ongoing`: `stage = "进行中"`, `dateNote = "报名已结束"`, `actionLabel = "查看比赛"`, `canRegister = false`.
- `ended`: `stage = "已结束"`, `dateNote = "比赛已结束"`, `actionLabel = "查看比赛"`, `canRegister = false`.
- `upcoming`: `stage = "报名中"`, `dateNote = "截止报名"`, action based on the group openness.
- `showRegistrationProgress = true` only when a home action item has group counts.
- `canOpenDetail = true` for all three visible phases.

- [ ] **Step 5: Verify GREEN and commit Task 2**

Run:

```bash
bun test src/pages/home/__tests__/homeMatchState.test.ts
bun run type-check
```

Then commit:

```bash
git add registration_system_mini/src/pages/home/homeMatchState.ts registration_system_mini/src/pages/home/__tests__/homeMatchState.test.ts registration_system_mini/src/types/viewModels.ts
git commit -m "feat(mini): classify Go matches by display phase"
```

---

### Task 3: Make the Match Card Reusable Across Three Phases

**Files:**
- Create: `registration_system_mini/src/pages/home/components/HomeMatchCard.vue`
- Modify: `registration_system_mini/src/pages/home/components/HomeMatchList.vue`

**Interfaces:**
- Consumes: phase-aware `HomeMatchCardViewModel` from Task 2.
- Produces: one `matchTap` intent for any card where `canOpenDetail` is true.
- Keeps `HomeMatchList` public props and event name stable for both parent pages.

- [ ] **Step 1: Extract the card without changing visual tokens**

Move the per-card markup and card-specific scoped styles from `HomeMatchList.vue` into `HomeMatchCard.vue`. The new component receives:

```ts
defineProps<{
  match: HomeMatchCardViewModel;
  variant: "default" | "brutalist";
  isGuestMode: boolean;
  isNavigating: boolean;
  formatMatchDateBlock: (dateLabel: string) => {
    monthDay: string;
    weekday: string;
    timeLabel: string;
  };
  progressBaseWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressExtraWidth: (joinedPlayers: number, requiredPlayers: number, maxPlayers: number) => string;
  progressSplitLeft: (requiredPlayers: number, maxPlayers: number) => string;
  stageClass: (stage: string) => string;
  statusClass: (status: string) => string;
}>();
```

Export the shared prop interface from a small local type declaration in `HomeMatchList.vue` or duplicate only function signatures; do not introduce a global component registry.

- [ ] **Step 2: Add phase-driven presentation conditions**

Use ViewModel fields only:

```vue
<text class="home-match-time-note">{{ match.dateNote }}</text>
<NeoProgress
  v-if="match.showRegistrationProgress"
  label="报名进度"
  :value="match.joinedPlayers"
  :target="match.requiredPlayers"
  :max="match.maxPlayers || match.requiredPlayers"
  :value-text="`${match.joinedPlayers}/${match.requiredPlayers}`"
/>
<view v-if="match.showParticipantAvatars" class="home-avatars-row">
  <view class="home-avatars">
    <view v-for="avatar in match.participantAvatars" :key="avatar.userId" class="home-avatar">
      <image v-if="avatar.avatarUrl" class="home-avatar-image" :src="avatar.avatarUrl" mode="aspectFill" />
      <text v-else class="home-avatar-text">{{ avatar.displayText }}</text>
    </view>
  </view>
  <text class="home-avatar-summary">{{ match.remainingPlayersLabel }}</text>
</view>
<NeoButton :variant="match.canRegister ? 'dark' : 'outline'">
  {{ match.actionLabel }}
</NeoButton>
```

Do not block card taps when `canRegister` is false. `canRegister` controls action styling and copy; `canOpenDetail` controls navigation availability.

- [ ] **Step 3: Reduce `HomeMatchList` to list orchestration**

Keep the outer list and `v-for`, render `HomeMatchCard`, and forward `matchTap`. Preserve stable spacing and the `brutalist` variant.

- [ ] **Step 4: Verify the component extraction**

Run:

```bash
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

Expected: all commands exit 0; no new unit test is required for a mechanical visual extraction.

- [ ] **Step 5: Commit Task 3**

```bash
git add registration_system_mini/src/pages/home/components/HomeMatchCard.vue registration_system_mini/src/pages/home/components/HomeMatchList.vue
git commit -m "refactor(mini): reuse home match cards across phases"
```

---

### Task 4: Migrate the Home Page to Go and Render Three Match Sections

**Files:**
- Modify: `registration_system_mini/src/pages/home/index.vue`
- Modify: `registration_system_mini/src/pages/__tests__/homePageLoading.test.ts`

**Interfaces:**
- Consumes: `getMatchHome()` and `buildHomeMatchSections()`.
- Produces routes `/pages/home/matches/index?phase=upcoming|ongoing|ended`.
- Preserves login completion, pull-to-refresh, hidden-duration refresh, sharing, Hero and bottom tab behavior.

- [ ] **Step 1: Replace stale source assertions with a failing Go migration assertion**

Update `homePageLoading.test.ts` to resolve files relative to `import.meta.url`, retain the first-load skeleton/refresh lifecycle assertions, and replace old activity/challenge assertions with:

```ts
expect(source.includes('import { getMatchHome } from "@/api/match";')).toBe(true);
expect(source.includes("buildHomeMatchSections")).toBe(true);
expect(source.includes('openMatchList("ongoing")')).toBe(true);
expect(source.includes('openMatchList("ended")')).toBe(true);
expect(source.includes("HomeOpportunityList")).toBe(false);
expect(source.includes("listChallenges")).toBe(false);
expect(source.includes("listActivities")).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `bun test src/pages/__tests__/homePageLoading.test.ts`.

Expected: FAIL because the current page still imports old activity/challenge APIs.

- [ ] **Step 3: Replace old home domain state with Go section state**

In `index.vue`:

- Remove activity, user-list, challenge, runtime visibility and opportunity imports/state/actions.
- Set Hero banners from `defaultMiniAppRuntimeConfig.home.hero_banners` without calling the unsupported system config endpoint.
- Add `upcomingMatches`, `ongoingMatches`, and `endedMatches` refs.
- In authenticated `loadPageData`, call `await ensureSessionReady()` and then `getMatchHome()`.
- Build all three arrays with one `buildHomeMatchSections(response, new Date(), 2)` call.
- In guest mode, clear all arrays and do not call protected Match APIs.
- Keep `syncUnreadCount({ skipEnsure: true })` as a non-blocking authenticated side effect.

- [ ] **Step 4: Render the three sections and remove opportunity UI**

Use `NeoSectionHeader + HomeMatchList + compact empty state` for each section:

```vue
<NeoSectionHeader title="最近要处理的比赛" marker="热" action-label="更多" @action="openMatchList('upcoming')" />
<NeoSectionHeader v-if="!isGuestMode" title="进行中的比赛" marker="赛" action-label="更多" @action="openMatchList('ongoing')" />
<NeoSectionHeader v-if="!isGuestMode" title="已结束的比赛" marker="终" action-label="更多" @action="openMatchList('ended')" />
```

Only provide `action-label` when the corresponding array is non-empty. Remove `HomeOpportunityList`, opportunity empty copy, acceptance/cancellation handlers, challenge-derived state, and `submitting`.

Update `handleMatchTap` to block only when `!match.canOpenDetail`; ongoing and ended cards must navigate to `match.detailUrl`.

- [ ] **Step 5: Verify GREEN and commit Task 4**

Run:

```bash
bun test src/pages/__tests__/homePageLoading.test.ts src/pages/home/__tests__/homeMatchState.test.ts
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

Then commit:

```bash
git add registration_system_mini/src/pages/home/index.vue registration_system_mini/src/pages/__tests__/homePageLoading.test.ts
git commit -m "feat(mini): split Go home matches into three sections"
```

---

### Task 5: Implement the Complete Phase-Specific Secondary List

**Files:**
- Create: `registration_system_mini/src/pages/home/matches/homeMatchPagination.ts`
- Create: `registration_system_mini/src/pages/home/matches/__tests__/homeMatchPagination.test.ts`
- Modify: `registration_system_mini/src/pages/home/matches/index.vue`

**Interfaces:**
- Consumes: `listMyMatches`, `resolveMatchPhase`, `groupMatchesByPhase`, and `toGoHomeMatchCard`.
- Produces: `loadNextVisiblePhaseBatch(state, phase, now, fetchPage)` that advances source pagination until visible rows grow or the source is exhausted.
- Page accepts `phase=upcoming|ongoing|ended`; invalid or missing values fall back to `upcoming`.

- [ ] **Step 1: Write a failing pagination behavior test**

Test with three fake source pages where page 1 has only upcoming, page 2 only cancelled, and page 3 contains ended items. For an `ended` target assert:

- The loader calls pages 1, 2 and 3 in order.
- It does not stop after an empty filtered page.
- Duplicate IDs are removed.
- `sourceLoaded` and `total` terminate future loads after all source rows are consumed.

- [ ] **Step 2: Run the pagination test and verify RED**

Run `bun test src/pages/home/matches/__tests__/homeMatchPagination.test.ts`.

Expected: FAIL because `homeMatchPagination.ts` does not exist.

- [ ] **Step 3: Implement the pagination state machine**

Define:

```ts
export interface HomeMatchPaginationState {
  sourceItems: AppMatchSummary[];
  nextPage: number;
  total: number;
  pageSize: number;
}

export async function loadNextVisiblePhaseBatch(
  state: HomeMatchPaginationState,
  phase: Exclude<AppMatchUiPhase, "excluded">,
  now: Date,
  fetchPage: (page: number, pageSize: number) => Promise<AppMatchListResponse>,
): Promise<HomeMatchPaginationState>;
```

The loop compares target-phase visible count before and after each appended page. Stop when the count grows, when unique source item count reaches `total`, or when a response returns no items. Deduplicate by ID while preserving the latest page data.

- [ ] **Step 4: Replace the old activity secondary page**

In `pages/home/matches/index.vue`:

- Parse `phase` in `onLoad` and derive title/copy/empty text from a constant map.
- Remove team context and all old activity/user/runtime-config calls.
- On first `onShow`, reset and call `loadNextVisiblePhaseBatch`.
- Register `onReachBottom` to fetch the next visible batch unless loading or exhausted.
- Recompute visible cards with the shared classifier and phase-specific sorter.
- Always allow card taps to open `` `/pages/matches/detail?id=${match.id}` ``.
- Show `加载更多...`, `没有更多比赛了`, or retry copy without shifting existing content.

- [ ] **Step 5: Verify GREEN and commit Task 5**

Run:

```bash
bun test src/pages/home/matches/__tests__/homeMatchPagination.test.ts src/pages/home/__tests__/homeMatchState.test.ts
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

Then commit:

```bash
git add registration_system_mini/src/pages/home/matches/homeMatchPagination.ts registration_system_mini/src/pages/home/matches/__tests__/homeMatchPagination.test.ts registration_system_mini/src/pages/home/matches/index.vue
git commit -m "feat(mini): add phase-specific match history lists"
```

---

### Task 6: Integration Verification and Visual QA

**Files:**
- Modify only files from Tasks 1-5 if verification finds an in-scope defect.

**Interfaces:**
- Verifies the committed feature against the approved spec and both runtime targets.

- [ ] **Step 1: Run all focused behavior tests**

```bash
cd registration_system_mini
bun test \
  src/api/__tests__/matchApi.test.ts \
  src/pages/home/__tests__/homeMatchState.test.ts \
  src/pages/home/matches/__tests__/homeMatchPagination.test.ts \
  src/pages/__tests__/homePageLoading.test.ts \
  src/config/__tests__/apiBase.test.ts \
  src/utils/__tests__/request.test.ts \
  src/stores/__tests__/goAuthFoundation.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run both platform builds**

```bash
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

Expected: all commands exit 0.

- [ ] **Step 3: Start a mock H5 visual-check server**

Use a free port and explicit environment:

```bash
lsof -nP -iTCP:5176 -sTCP:LISTEN
VITE_USE_MOCK=true VITE_ENABLE_H5_TEST_LOGIN=true VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app \
  bun run dev:h5 -- --host 0.0.0.0 --port 5176
```

The first command must return no listener before starting Vite. If `5176` is occupied by a process outside this task, use `5177` consistently for this verification instead of terminating it.

Verify in the in-app browser at phone width and desktop width:

- Hero is visible.
- “约队机会” is absent.
- Three match sections are ordered correctly.
- Ongoing and ended sections each show at most 2 cards.
- Ongoing/ended cards say “查看比赛” and remain clickable.
- “更多” opens the correct phase title and list.
- No text overlap or card layout shift occurs.

- [ ] **Step 4: Verify real Go mode does not call removed endpoints**

Run H5 with `VITE_USE_MOCK=false` against `http://127.0.0.1:18080/api/v1/app`, use H5 test login, and inspect network/server logs. Expected homepage calls include `/matches/home` and exclude `/activity/infos`, `/challenges`, and `/system/mini-app-runtime-config`.

- [ ] **Step 5: Check diff hygiene and commit any verification fix**

```bash
git diff --check
git status --short
```

If Task 6 required a fix, rerun the affected focused test and both builds, then commit only that fix:

```bash
git add \
  registration_system_mini/src/types/match.ts \
  registration_system_mini/src/types/viewModels.ts \
  registration_system_mini/src/api/match.ts \
  registration_system_mini/src/api/__tests__/matchApi.test.ts \
  registration_system_mini/src/mock/data/matches.ts \
  registration_system_mini/src/mock/handlers.ts \
  registration_system_mini/src/pages/home \
  registration_system_mini/src/pages/__tests__/homePageLoading.test.ts
git commit -m "fix(mini): polish home match phase sections"
```

If no fix was required, do not create an empty commit.
