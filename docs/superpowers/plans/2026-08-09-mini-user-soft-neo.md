# Mini User Soft Neo-Brutalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小程序/H5“我的”页完整改造成已确认的个人战绩档案式 Soft Neo-Brutalism 页面，并将资料、球队身份、统计、比赛与账户服务拆成稳定组件。

**Architecture:** `src/pages/user/index.vue` 保留所有接口、Store、导航、登录、支付和权限编排。页面专属组件只通过 `props` 接收展示数据并通过 `emits` 发出意图；通用交互继续通过 `src/components/neo/` 包装 Wot UI。

**Tech Stack:** uni-app、Vue 3 `<script setup>`、TypeScript、Vite、Wot UI 2、现有 Neo 视觉组件。

## Global Constraints

- 只修改 `registration_system_mini/` 的“我的”页及其页面专属组件，不改接口、DTO、Store、路由、支付和权限规则。
- 修改 Wot UI 相关代码前阅读 `.agents/skills/wot-ui-v2/SKILL.md`，并查询项目配置的 `wot-ui` MCP 版本 API。
- 页面不直接散落 `wd-button` 或 `wd-tag`；使用 `NeoButton`、`NeoTag`、`NeoSurface`、`NeoSectionHeader` 和 `NeoSegmentedControl`。
- 所有新增样式使用 `rpx`，交互反馈使用 `hover-class`，不使用 `:hover`、DOM API、`window` 或 `document`。
- 页面子组件不直接调用业务 API 或操作 Store。
- 保留 dirty worktree 中与本任务无关的修改，不执行 reset、checkout 或清理。
- 不创建提交，除非用户后续明确要求。
- 纯视觉改造不机械新增单元测试；每项任务使用类型检查、构建和浏览器验收验证。

---

## File Structure

### Create

- `registration_system_mini/src/pages/user/mineTypes.ts`：页面组件共享的统计项与比赛摘要类型。
- `registration_system_mini/src/pages/user/components/MineProfileHero.vue`：登录/未登录个人档案 Hero。
- `registration_system_mini/src/pages/user/components/MineTeamIdentityPanel.vue`：球队、身份和球队管理上下文。
- `registration_system_mini/src/pages/user/components/MineStatsGrid.vue`：2×2 统计数据板。
- `registration_system_mini/src/pages/user/components/MineServiceGrid.vue`：消息、信用和会员续费服务区。

### Modify

- `registration_system_mini/src/pages/user/index.vue`：数据编排、展示模型、组件接线、错误提示和页面背景。
- `registration_system_mini/src/pages/user/components/MineMatchSection.vue`：Soft Neo 比赛列表。
- `registration_system_mini/src/pages/user/components/MineWalletSection.vue`：Soft Neo 钱包条。
- `registration_system_mini/src/pages/user/components/MineSkeleton.vue`：匹配新首屏结构的骨架。

### Remove After Rewiring

- `registration_system_mini/src/pages/user/components/MineHeroProfile.vue`：由三个职责明确的组件替代。
- `registration_system_mini/src/pages/user/components/MineMiniCards.vue`：由 `MineServiceGrid.vue` 替代。

---

### Task 1: 建立页面类型与个人档案 Hero

**Files:**

- Create: `registration_system_mini/src/pages/user/mineTypes.ts`
- Create: `registration_system_mini/src/pages/user/components/MineProfileHero.vue`

**Interfaces:**

- Produces:

```ts
export type MineStatTone = "lime" | "blue" | "amber" | "coral";

export interface MineStatItem {
  key: "matches" | "teams" | "hours" | "joinedDays";
  label: string;
  value: string;
  unit?: string;
  tone: MineStatTone;
}

export interface MineMatchSummary {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  myStatus: string;
}
```

`MineProfileHero` props：

```ts
{
  currentUser: BackendUser | null;
  displayName: string;
  teamJoinedDaysLabel?: string;
}
```

`MineProfileHero` emits：`editProfile`、`login`、`logout`。

- [ ] **Step 1: 创建共享页面类型**

将上述 `MineStatTone`、`MineStatItem` 和 `MineMatchSummary` 写入 `mineTypes.ts`。比赛摘要不再从 `MineMatchSection.vue` 导出，避免页面层依赖组件内部类型。

- [ ] **Step 2: 实现登录态 Hero**

使用 `NeoSurface variant="dark"` 作为稳定主容器。头像优先渲染 `currentUser.avatar_url`，缺失或加载失败时显示本地默认头像图标；Hero 只显示一处名称和所选球队的加入天数，球队名称与角色统一在下方球队与身份组件展示。加入天数由选中球队详情中的当前用户成员记录计算，切换球队后同步更新。编辑资料使用 `NeoButton variant="lime" size="sm"`，退出使用 `NeoButton variant="outline" size="sm"`。

- [ ] **Step 3: 实现未登录 Hero**

未登录状态保持同一个深色容器尺寸，主按钮触发 `login`，只展示比赛记录、球队身份、钱包通知三项简短预告，不渲染余额、信用或虚构统计。

- [ ] **Step 4: 添加跨端样式**

Hero 使用 `2rpx` 深色边框、`8rpx 8rpx 0` 荧光绿偏移阴影和 `16rpx` 圆角。头像使用固定 `112rpx × 112rpx`；操作区允许换行，最长名称使用 `word-break: break-word`，避免窄屏溢出。

- [ ] **Step 5: 验证新增组件可被 Vue TypeScript 编译器解析**

Run:

```bash
cd registration_system_mini && bun run type-check
```

Expected: 命令退出码为 0；没有新增的 Vue props、emit 或导入错误。

---

### Task 2: 拆分球队身份区与统计数据板

**Files:**

- Create: `registration_system_mini/src/pages/user/components/MineTeamIdentityPanel.vue`
- Create: `registration_system_mini/src/pages/user/components/MineStatsGrid.vue`

**Interfaces:**

`MineTeamIdentityPanel` consumes：

```ts
{
  availableIdentities: CurrentIdentityViewModel[];
  currentIdentity: CurrentIdentityViewModel | null;
  currentTeam: TeamProfileViewModel | null;
  teamProfiles: TeamProfileViewModel[];
  isSwitchingTeam: boolean;
}
```

`MineTeamIdentityPanel` emits：

```ts
{
  switchIdentity: [identityId: string];
  switchTeam: [teamId: number];
  manageTeam: [teamId?: number];
}
```

`MineStatsGrid` consumes：`items: MineStatItem[]`。

- [ ] **Step 1: 实现球队上下文**

使用 `NeoSectionHeader title="球队与身份"` 和 `NeoSurface`。当前球队在顶部显示名称、角色和人数。`teamProfiles.length <= 3` 时把球队映射为 `NeoSegmentedControl` 的字符串 `value`；超过 3 支时改为横向 `scroll-view` 硬边选项。选择后把字符串 ID 转回 `number` 并发出 `switchTeam`。

- [ ] **Step 2: 实现球队管理入口**

过滤 `teamProfiles.filter(team => team.canManageTeam)`。每个可管理球队显示队徽占位、名称、角色和人数，并发出 `manageTeam(team.id)`；没有权限时整个管理区域不渲染。`isSwitchingTeam` 时禁用重复切换并降低非当前项透明度。

- [ ] **Step 3: 实现身份切换**

`availableIdentities.length <= 3` 时使用 `NeoSegmentedControl`，选项标签由 `identity.label` 和 `identity.roleLabel` 组成；超过 3 个身份时使用横向 `scroll-view`。无身份时显示“当前球队暂无可切换身份”的紧凑空状态。

- [ ] **Step 4: 实现统计数据板**

使用固定两列网格渲染 `MineStatItem[]`，各 tone 对应：`lime` 荧光绿、`blue` 浅蓝、`amber` 黄色、`coral` 珊瑚红。每格固定最小高度，分别显示 `value`、可选 `unit` 和 `label`，组件不计算业务值。

- [ ] **Step 5: 验证组件类型契约**

Run:

```bash
cd registration_system_mini && bun run type-check
```

Expected: 命令退出码为 0；数字球队 ID 与字符串分段控件值之间不存在 TypeScript 错误。

---

### Task 3: 改造比赛、钱包和账户服务区

**Files:**

- Modify: `registration_system_mini/src/pages/user/components/MineMatchSection.vue`
- Modify: `registration_system_mini/src/pages/user/components/MineWalletSection.vue`
- Create: `registration_system_mini/src/pages/user/components/MineServiceGrid.vue`

**Interfaces:**

`MineMatchSection` consumes：

```ts
{
  matches: MineMatchSummary[];
  statusTone: (status: string) => NeoTagTone;
}
```

`MineMatchSection` emits：`openAll`、`openMatch(matchId: string)`。

`MineWalletSection` 保持现有 `walletSummary` prop 和 `openBilling` emit。

`MineServiceGrid` 保持现有服务数据：

```ts
{
  currentTeam: TeamProfileViewModel | null;
  messageSummary: string;
  creditCardSummary: string;
  isPayingMembership: boolean;
}
```

`MineServiceGrid` emits：`openNotifications`、`renewMembership`。

- [ ] **Step 1: 改造比赛区标题和列表**

使用 `NeoSectionHeader` 提供“我的比赛”和“全部比赛”操作。每场比赛使用 `NeoSurface interactive`，使用 `NeoTag` 显示 `myStatus`，日期、标题和场地保持稳定三层结构，右侧 `NeoButton variant="lime" size="sm"` 触发同一个 `openMatch`。

- [ ] **Step 2: 实现比赛空状态**

空列表渲染最小高度 `160rpx` 的硬边区域，文案为“当前球队下还没有可展示的比赛记录。”，不隐藏区块标题。

- [ ] **Step 3: 改造钱包条**

使用黄色 `NeoSurface` 风格容器，左侧显示“钱包余额”和 `balanceLabel`，右侧 `NeoButton variant="dark" size="sm"` 发出 `openBilling`。保留 `totalExpenseLabel` 和 `latestExpenseLabel` 的接口兼容性，但不在主视觉重复展示无关摘要。

- [ ] **Step 4: 实现账户服务网格**

用 `MineServiceGrid` 取代 `MineMiniCards`。消息卡可点击并显示未读摘要；信用卡显示 `creditScore`、`trustLabel` 和最新记录；仅当 `currentTeam?.canManageTeam` 时显示会员续费卡，按钮绑定 `loading` 和 `disabled` 到 `isPayingMembership`。

- [ ] **Step 5: 验证三个内容组件**

Run:

```bash
cd registration_system_mini && bun run type-check
```

Expected: 命令退出码为 0；`NeoTagTone`、比赛事件和续费 loading props 类型正确。

---

### Task 4: 重组页面编排并接入完整状态

**Files:**

- Modify: `registration_system_mini/src/pages/user/index.vue`
- Remove: `registration_system_mini/src/pages/user/components/MineHeroProfile.vue`
- Remove: `registration_system_mini/src/pages/user/components/MineMiniCards.vue`

**Interfaces:**

- Consumes: Tasks 1–3 中定义的所有组件和 `MineStatItem`、`MineMatchSummary`。
- Preserves: `loadPageData`、`handleLogin`、`handleLogout`、`handleSwitchTeam`、`handleSwitchIdentity`、`openTeamManage`、所有导航函数和 `handleMembershipRenewal`。

- [ ] **Step 1: 更新导入和页面展示模型**

删除背景图、`MineHeroProfile`、`MineMiniCards` 和组件内部比赛类型导入；导入新组件与 `mineTypes.ts`。新增：

```ts
const mineStats = computed<MineStatItem[]>(() => [
  { key: "matches", label: "今年比赛", value: String(overviewDigest.value.activityCount), unit: "次", tone: "lime" },
  { key: "teams", label: "加入球队", value: String(overviewDigest.value.teamCount), unit: "支", tone: "blue" },
  { key: "hours", label: "今年时长", value: overviewDigest.value.totalHoursLabel, tone: "amber" },
  { key: "joinedDays", label: "加入当前球队", value: currentTeamJoinedDaysLabel.value, tone: "coral" },
]);
```

新增 `matchStatusTone(status: string): NeoTagTone`，将 `attendanceStatusTone` 的 `join/leave/late/pending` 映射为 `green/muted/amber/blue`。

- [ ] **Step 2: 重组模板顺序**

依次渲染 `MineProfileHero`、登录态下的 `MineTeamIdentityPanel`、`MineStatsGrid`、`MineMatchSection`、按审核状态显示的 `MineWalletSection`、`MineServiceGrid`。保留 `AppTabHeader`、`BottomTabBar` 和底部安全区。

- [ ] **Step 3: 接入错误与未登录状态**

新增：

```ts
const visibleErrorMessage = computed(() => currentUser.value ? errorMessage.value : "");
```

在个人 Hero 后渲染 `visibleErrorMessage` 的红色硬边提示条。未登录时不渲染球队、统计、比赛、钱包和服务区，登录按钮继续调用现有 `handleLogin`。

- [ ] **Step 4: 更新页面样式**

页面背景改为 `var(--neo-color-canvas)` 或与现有 tokens 等价的浅灰绿色；移除 `.mine-page-bg`、`.mine-page-overlay` 及相关渐变。桌面 H5 使用受控最大宽度并保持居中，移动端继续使用 `28rpx` 水平内边距；底部保留 `calc(168rpx + env(safe-area-inset-bottom))`。

- [ ] **Step 5: 删除旧组件并检查引用**

删除两个已被替代文件后执行：

```bash
cd registration_system_mini && rg -n "MineHeroProfile|MineMiniCards" src || true
```

Expected: 没有残留源码引用。

- [ ] **Step 6: 验证页面接线**

Run:

```bash
cd registration_system_mini && bun run type-check
```

Expected: 命令退出码为 0；现有 API、Store、支付和导航函数没有未使用或类型错误。

---

### Task 5: 同步骨架并完成跨端验收

**Files:**

- Modify: `registration_system_mini/src/pages/user/components/MineSkeleton.vue`
- Verify: `registration_system_mini/src/pages/user/index.vue`
- Verify: `registration_system_mini/src/pages/user/components/*.vue`

**Interfaces:**

- Consumes: 最终页面首屏结构。
- Produces: H5 和微信小程序均可编译、目标视口通过视觉验收的完整页面。

- [ ] **Step 1: 重做首屏骨架**

骨架固定包含深色 Hero 占位、球队身份面板占位和 2×2 统计占位。使用纯色块和透明度动画，不使用背景图或渐变；尺寸与最终组件一致，避免首次加载跳动。

- [ ] **Step 2: 执行格式和差异检查**

Run:

```bash
cd registration_system_mini && git diff --check -- src/pages/user
```

Expected: 无尾随空格、冲突标记或空白错误。

- [ ] **Step 3: 执行类型检查**

Run:

```bash
cd registration_system_mini && bun run type-check
```

Expected: 退出码为 0。

- [ ] **Step 4: 构建 H5**

Run:

```bash
cd registration_system_mini && bun run build:h5
```

Expected: 构建成功；没有本次改造新增的错误。

- [ ] **Step 5: 构建微信小程序**

Run:

```bash
cd registration_system_mini && bun run build:mp-weixin
```

Expected: 构建成功；允许记录仓库既有的 `utils/request -> mock/index -> mock/handlers -> config/runtimeConfig -> api/system -> utils/request` 循环 chunk warning，但不允许出现新的编译错误。

- [ ] **Step 6: 启动或复用 H5 开发服务**

Run:

```bash
cd registration_system_mini && bun run dev:h5 -- --host 0.0.0.0
```

Expected: 输出可访问的 localhost URL；如 `5174` 已被本项目占用，先确认其健康状态并复用，不能终止用户的无关服务。

- [ ] **Step 7: 浏览器移动端视觉与交互验收**

在 390×844 视口打开 `#/pages/user/index`，检查：个人 Hero、球队/身份切换、2×2 统计、最近比赛、钱包、消息、信用、续费、底部 Tab Bar；确认无溢出、遮挡和布局跳动。点击比赛、账单、消息、球队管理入口，确认 URL 或页面导航与改造前一致。

- [ ] **Step 8: 浏览器桌面视觉验收**

在 1280×900 视口打开同一路由，确认内容居中、最大宽度合理、卡片没有被无限拉宽、页面能够完整滚动且底部操作不与 Tab Bar 重叠。

- [ ] **Step 9: 验收未登录和异常状态**

使用现有 Mock/会话开关验证未登录 Hero 不展示账户数据；再验证无球队、无比赛和已有 `errorMessage` 时页面结构稳定。若现有环境无法安全切换某个状态，记录未验证状态及原因，不为视觉验收修改认证业务逻辑。
