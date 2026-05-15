# 小程序发现记录

## 2026-05-14 队员会员标识

- 小程序队员数据入口是 `src/types/backend.ts` 的 `BackendTeamMember` 和 `src/api/team.ts` 的 `addTeamMember` / `updateTeamMember`。
- 队员管理页面已经拆成 `index.vue`、`teamManageActions.ts`、`TeamMemberManager.vue`、`MemberEditPopup.vue`、`TeamMemberSection.vue`，本次按现有拆分点小步修改。
- uni `switch` 在 Vue 模板类型里按普通 `Event` 推断，读取 `event.detail.value` 时需要在 handler 内窄化。
- 前端不按 TDD 方式推进，本次只补齐已有测试夹具的必填字段并执行类型检查。

## 2026-05-15 报名详情队员三栏头像列表

- 比赛报名详情页已有头像展示语言集中在 `IndividualCountdownCard`：叠放头像、白色描边、一行状态说明。
- 新增三栏状态区域需要表达“头像移动到对应区域”，但不适合继续用人员大卡片或胶囊列表，否则视觉重量高于主报名信息。
- 当前用户只需要轻量突出：保留头像本体，增加黑色描边和小“我”标记，避免额外姓名/球衣号文本撑高列表。
- 点击头像查看姓名不适合用全局 toast 或 popup；区域内姓名条与头像位置关系更清楚，也能避开小程序弹层裁剪和滚动联动问题。

## 2026-05-15 散人约队报名页对齐比赛报名

- 散人约队当前有报名/取消报名能力，但 UI 仍是约队详情页风格：约队主信息卡、报名进度卡、底部独立按钮条。
- 用户期望散人报名页和比赛报名页风格/操作一致；差异仅是散人约队没有球队三栏状态区域。
- 更稳的实现是只对 `challenge.kind === "individual"` 分流到新的个人报名视图，球队约队详情保持现有结构，避免影响队长接约流程。
## 2026-05-15 场馆角色与约队发布权限发现

- `src/pages/activities/index.vue` 的发布按钮目前只依赖当前球队 `canManageTeam`。
- `src/pages/challenges/create-individual/index.vue` 当前要求 `currentTeam.value?.canManageTeam`，提交时必须传 `host_team_id`。
- `src/api/challenge.ts` 与 `src/types/backend.ts` 都把 `host_team_id` 视为必填字段。
- `src/stores/appSession.ts` 当前只加载用户资料和我的球队；场馆身份如果作为用户级角色，需要在 `BackendUser` 与 session view model 中新增字段。
- 如果场馆不绑定球队，小程序发布页需要支持“无当前球队但有场馆权限”的分支，并调整发布者名称展示。
- 场馆身份落为 `BackendUser.is_venue`；发布权限需要和 `currentTeam.canManageTeam` 做 OR 判断。
- 场馆发布球队约队复用 `pages/challenges/create-individual/index.vue?kind=team`，避免走比赛创建页生成活动。
- 当前用户无球队时，约队大厅应使用公开列表加载，不能直接清空，否则纯场馆账号无法浏览和发布。
- 场馆发布者取消无主队约队时，前端需要按 `host_user_id === currentUser.id && is_venue` 展示取消入口。
- 场馆撮合球队约队第一支球队占位后，卡片应显示“等待对手”；其他球队看到同一条约队时应显示“去应战”。

## 2026-05-15 当前发布身份切换发现

- 小程序已有当前球队切换，但当前球队还承担首页、统计、报名、账单等上下文，不应直接替代“发布主体”。
- 当前发布身份适合放在 `appSession`，从 `teamProfiles.filter(canManageTeam)` 和 `currentUser.is_venue` 派生，并用 storage 记住用户选择。
- “当前身份”只影响发布约队；场馆用户仍可以作为球员参与报名，报名流程继续使用当前用户和当前球队上下文。
- 球队约队发布现在应统一走 `pages/challenges/create-individual/index?kind=team`，避免队长身份继续跳到创建比赛页而绕开 `createChallenge` 的发布主体判断。
- 当前身份是球队时提交 `host_team_id = identity.teamId`；当前身份是场馆时省略 `host_team_id`。

## 2026-05-15 我的页钱包加载优化发现

- `pages/user/index.vue` 原先首屏同时请求 `getMyBalance()` 和 `getMyBillingFlow()`，后者慢时会影响整个“我的”页数据落地。
- “我的钱包”卡片只需要展示余额摘要和入口，不需要在首屏展示最新流水详情。
- 二级账单页 `pages/billing/index.vue` 已经是完整账单明细页，保留 `getMyBillingFlow()` 更符合信息层级。
- 调整后“我的”页不再 import 或调用 `getMyBillingFlow()`，钱包卡片点击后进入 `/pages/billing/index` 查看充值、扣费、罚款和流水余额。

## 2026-05-15 场馆球队约队详情展示发现

- 场馆刚发布球队约队时 `host_team_id = null`，`host_team_name` 是后端为了卡片发布方展示兜底出来的场馆/发布人名，不代表主队。
- 约队详情“对阵进度”必须以 `challenge.host_team_id` 判断左侧主队是否已确定；为空时左侧也显示“等待接约 / 未确定”，和右侧客队占位一致。
- 第一支球队接约占位后，后端会写入 `host_team_id`，此时左侧才显示该球队为主队。

## 2026-05-15 首页约队机会排序与详情跳转发现

- 首页“约队机会”此前按 `credit_desc` 请求约队，时间更晚的约队不一定排在前面。
- 首页会过滤运行配置可见性并截取展示数量；过滤后需要本地再按 `holding_date` 倒序、同日按 `start_time` 倒序排序，避免截断前顺序不稳定。
- 约队详情路由已经存在，首页卡片只需要通过 emit 把 `challengeId` 交给页面层统一 `uni.navigateTo`。

## 2026-05-15 首页配色微调发现

- 本次用户只要求改配色，不改页面结构、组件结构、脚本逻辑和业务流程。
- 首页主要配色入口在 `pages/home/index.vue`、`HomeHeroSection`、`HomeMatchList`、`HomeOpportunityList`、`HomeDigestGrid` 的 scoped style。
- 最终采用暖黑/墨绿黑、草地绿、暖白和雾灰绿；红/蓝状态色只降低刺激感，保留语义区分。

## 2026-05-15 首页字体排版微调发现

- 本次用户确认先看静态稿，再把真实页面做同方向字体调整。
- 真实页面只需要改 scoped style：`font-size`、`font-weight`、`line-height`、`letter-spacing`。
- 中文标题不适合负字距；banner 标题改回 `letter-spacing: 0`，并用更温和的字重和行高保持冲击力。

## 2026-05-15 散人报名重复标题移除发现

- `pages/challenges/detail.vue` 的 `pageTitle` 已经在散人约队时显示“散人报名”。
- `ChallengeIndividualRegistration.vue` 里的 `challenge-tabs` 只重复展示同一文案，没有切换功能；删除后首屏更聚焦到核心报名卡。
