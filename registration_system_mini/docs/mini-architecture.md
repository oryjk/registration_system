# 小程序端结构与重构规范

本文档给新开的 AI / Agent 快速理解小程序端结构、职责边界和页面重构方式。修改代码前仍需先阅读仓库根目录与本目录的 `AGENTS.md`。

## 目录职责

```text
src/
  api/                 # 按业务域封装后端 API 原子调用
  components/          # 跨页面通用组件
  config/              # 运行时与环境配置
  pages/               # 小程序页面与页面局部模块
  static/              # 图片、图标等静态资源
  stores/              # 跨页面状态与 session/team 上下文
  types/               # 后端 DTO、视图模型等共享类型
  utils/               # 请求、日期、支付、位置、view model 等工具
```

核心原则：

- `src/api/` 只做接口请求封装和参数适配，不承载页面 UI 状态。
- `src/stores/` 放跨页面共享状态，例如登录态、当前球队、通知未读数。
- `src/utils/viewModels.ts` 放可复用的后端数据到页面视图模型转换。
- `src/pages/<domain>/index.vue` 或详情页 SFC 只做页面编排，不继续堆叠所有模板、接口调用和业务判断。
- `src/pages/<domain>/components/` 放页面局部组件，适合承载页面专属 UI 块。
- `src/components/` 只放真正跨页面复用且 API 稳定的组件，例如导航、底部 tab、通用登录提示。

## 页面拆分模式

优先采用以下结构：

```text
src/pages/<domain>/
  index.vue                 # 页面编排：生命周期、加载状态、导航、事件 wiring
  use<Domain>Page.ts        # 页面级组合逻辑，可选；适合承载较重的状态、生命周期和动作编排
  <domain>Data.ts           # 页面级数据加载组合，可选
  <domain>Actions.ts        # 页面级提交动作和 API 编排，可选
  <domain>State.ts          # 纯计算、格式化、状态 patch helper，可选
  components/
    XxxPanel.vue            # 页面局部 UI 组件
    XxxCard.vue
    XxxSkeleton.vue
```

拆分时的职责边界：

- 父页面保留：页面生命周期、当前页面业务状态、异步流程、错误处理、路由跳转、Toast/Confirm、核心权限入口。
- 子组件负责：展示结构、局部交互、表单输入事件、列表/卡片/弹层渲染。
- 子组件通过 `props` 接收数据，通过 `emits` 发出意图；不要在页面局部展示组件里直接调用业务 API。
- 纯函数和格式化如果会被多个页面复用，放到 `src/utils/`；如果只服务当前页面，放到同目录 `*State.ts`。
- API 原子调用始终放在 `src/api/<domain>.ts`，页面级组合逻辑才放 `*Data.ts` / `*Actions.ts`。
- 当页面状态和异步流程较重时，可以抽 `use<Domain>Page.ts` 作为页面局部 composable；它仍属于页面编排层，不应替代 `src/api/` 的原子接口封装。

## 已采用的拆分案例

当前已按上述模式拆分的页面：

- `src/pages/home/index.vue`
  - 局部组件：`HomeSkeleton`、`HomeHeroSection`、`HomeMatchList`、`HomeOpportunityList`、`HomeDigestGrid`
  - 父页面保留首页数据加载、团队切换、跳转和刷新逻辑。
- `src/pages/matches/detail.vue`
  - 页面门面：`useMatchDetailPage.ts`
  - 业务组合模块：`useMatchRegistration.ts`、`useMatchCheckInReview.ts`、`useMatchSettlement.ts`
  - 局部模块：`detailData.ts`、`detailState.ts`、`detailActions.ts`、`registrationVisibility.ts`
  - 局部组件：`MatchDetailSkeleton`、`MatchIndividualRegistration`、`MatchTeamRegistration`
  - 报名子组件继续拆分为 `IndividualMatchupHero`、`IndividualCountdownCard`、`IndividualInfoCard`、`IndividualPromoBanner`、`InterestMatchGrid`、`TeamRegistrationHero`、`TeamRegistrationFormCard`、`TeamMatchInfoCard`、`TeamCheckInPanel`、`TeamCheckInSettingsCard`、`TeamActivityReviewCard`
  - 父页面保留详情页布局编排；门面负责加载与生命周期，报名、签到/互评和结算按业务域拆分。
- `src/pages/teams/manage/index.vue`
  - 页面门面：`useTeamManagePage.ts`
  - 业务组合模块：`useTeamProfile.ts`、`useTeamMembership.ts`、`useTeamAttendance.ts`
  - 局部模块：`teamManageActions.ts`、`teamManageState.ts`
  - 局部组件：`TeamProfilePanel`、`TeamCreatePanel`、`TeamJoinPanel`、`TeamMemberManager`、`MemberEditPopup`、`MemberAttendancePopup`
  - 父页面只保留组件编排；门面负责模式切换与加载，资料、成员和出勤流程按业务域拆分。
- `src/pages/activities/index.vue`
  - 局部组件：`ActivitiesToolbar`、`ActivitiesSkeleton`、`PublishTypeSheet`、`ChallengeHallSections`、`ChallengeHallCard`
  - 父页面保留约队加载、筛选计算、接约、发布跳转和通知同步。
- `src/pages/user/index.vue`
  - 局部组件：`MineSkeleton`、`MineHeroProfile`、`MineMiniCards`、`MineMatchSection`、`MineWalletSection`
  - 父页面保留登录态、球队上下文、钱包/比赛摘要加载和页面跳转。
- `src/pages/teams/index.vue`
  - 局部模块：`teamStatsState.ts`
  - 局部组件：`StatsSkeleton`、`StatsOverview`、`AttendanceRecordCard`、`AttendanceRankingCard`
  - 父页面保留球队上下文、统计数据加载、登录态分支和刷新逻辑。
- `src/pages/challenges/detail.vue`
  - 局部模块：`detailState.ts`
  - 局部组件：`ChallengeDetailSkeleton`、`ChallengeHeroCard`、`ChallengeInfoCard`、`ChallengeTeamProgressCard`、`ChallengeIndividualProgressCard`、`ChallengeActions`
  - 父页面保留约队详情加载、接约/取消动作、状态同步和跳转。
- `src/pages/user/matches/index.vue`
  - 局部模块：`userMatchesState.ts`
  - 局部组件：`UserMatchesSkeleton`、`UserMatchList`
  - 父页面保留我的比赛加载、当前球队提示、刷新和详情跳转。

这些页面应作为后续小程序页面重构的主要参考。

## 文件规模判断

行数不是唯一标准，但能提示维护风险：

- 非声明式页面 / 组件超过约 `600` 行：修改前评估是否存在可抽边界。
- 超过约 `1000` 行：优先安排小步拆分，不继续叠加新功能。
- 配置、路由表、类型定义、静态映射等声明式文件可以更大，但必须分区清楚。

拆分优先级看职责和变化原因，而不是机械缩短文件。常一起修改的逻辑可以留在一起，不常一起修改的展示、动作、计算应拆开。

## 当前重构观察

截至当前结构扫描，比赛详情和球队管理已经完成业务组合逻辑拆分。后续优先关注：

- `src/pages/billing/index.vue`：接近 600 行，若继续加支付、流水筛选或订单管理能力，应优先拆 wallet summary、record list、payment order list 和 payment actions。
- `src/pages/teams/manage/components/TeamMemberManager.vue`：成员管理组件接近 600 行，后续可按成员列表、角色操作、空态/权限提示继续拆分。
- `src/pages/activities/index.vue`：页面脚本仍承担筛选、加载、权限与接约状态同步；继续增加大厅功能前可抽页面级 composable。
- `src/pages/matches/create/index.vue`、`src/pages/notifications/index.vue`、`src/pages/profile/setup/index.vue`：体量中等，若继续加复杂表单、消息筛选或资料校验，应按局部组件和 `*State.ts` 小步拆分。

这些不是必须一次完成的任务。后续改到相关页面时，按最小范围顺手拆清楚边界。

## 新增页面 Checklist

新增或大改页面时，先检查：

- 是否已有同类页面、组件、view model 或 API wrapper 可复用。
- 后端字段是否来自现有 `src/types/backend.ts` 和 `src/api/`，不要臆造字段。
- 页面是否只负责编排，是否需要页面局部 `components/`。
- 复杂数据转换是否应放到 `src/utils/viewModels.ts` 或页面局部 `*State.ts`。
- 多接口组合或提交动作是否应放到页面局部 `*Data.ts` / `*Actions.ts`。
- 是否涉及路由、接口调用、权限、数据提交、共享工具函数或关键业务状态变化；如果涉及，按风险补充或更新测试。
- UI/样式/布局调整默认不要求 TDD，以 `bun run type-check`、必要时 `bun run build:mp-weixin` 和模拟器/截图验证为主。

## 验证建议

常用验证命令：

```bash
bun test
bun run type-check
bun run build:mp-weixin
```

小范围页面拆分可以先跑相关测试和 `bun run type-check`；完成一批重构后再跑全量 `bun test` 和小程序构建。
