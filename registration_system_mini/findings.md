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

## 2026-05-16 退出登录后刷新状态发现

- 我的页退出登录调用 `clearSession()`，会清理 token、当前球队、当前身份并写入手动退出标记。
- App 冷启动调用 `restoreSessionFromStorage()`；如果该恢复逻辑只看 token，就可能在本地仍残留 token 时重新恢复登录态。
- 正确策略是两层保证：退出动作本身必须删除 token；同时冷启动看到手动退出后直接进入游客态并清理残留 token、当前球队和当前身份选择。
- 由于登录流程存在异步请求，退出后旧登录请求返回时也不能再次写入 token；需要在 token 写入前后检查会话版本和手动退出标记。

## 2026-05-16 清缓存后自动登录发现

- 清除缓存会同时删除 token 和 `registration_system_mini_manual_logout` 手动退出标记；此时 App 冷启动恢复本身会保持游客态。
- 自动登录来自页面层：个人中心 `onShow -> loadPageData()` 原先无条件调用 `ensureSessionReady()`，在无 token 且无手动退出标记时会走微信登录。
- 个人中心应和首页一致采用游客优先：无 token 时展示未登录态，点击“去登录”才主动触发 `refreshSessionContext()`。

## 2026-05-17 首页待办详情返回抖动发现

- 首页 `onShow()` 当前会在每次页面显示时调用 `loadPageData({ preserveContent: hasLoadedOnce.value })`。
- 从“最近要处理的比赛”卡片进入报名详情再回退，也会触发首页 `onShow()`；虽然不会重新显示首屏骨架屏，但会进入 `isRefreshing` 并重算卡片，造成视觉抖动。
- 待办卡片跳转详情属于短路径查看，返回时可以跳过下一次首页 `onShow` 刷新；登录完成、tab 切换等其他路径仍应保留刷新。

## 2026-05-17 自定义 Tabbar 快捷菜单发现

- 当前项目的 tabbar 实际由 `src/components/BottomTabBar.vue` 页面内自定义组件渲染，`pages.json` 仍保留原生 tabBar 配置用于 `switchTab` 页面声明。
- 现有中间创建按钮已经是自定义入口，适合改成截图里的 FAB 展开态，不需要接入微信 `custom-tab-bar` 目录。
- 截图风格只应影响点击后的展开态；常驻 tabbar 的颜色、底座、尺寸和选中态应继续沿用项目原来的 `uni.css` 样式。
- 展开态更适合覆盖一个全屏暗色模糊遮罩，三个快捷入口围绕中心按钮展开；纯底部抽屉不符合目标视觉。

## 2026-05-17 首页 onShow 策略改造发现

- 上一轮加的 `shouldSkipNextShowRefresh` 只覆盖"最近要处理的比赛"卡片入口，且 flag 在 `uni.navigateTo` 的 success 异步回调里设置，跨平台时机不稳；其他入口（约队卡、tab 切换、管理页、个人中心）回首页都还是 reload。
- 抖动的次级来源：`navigatingMatchId` 用 `setTimeout(500ms)` 异步清；改成 `onHide` 同步清，时机更准且避免可能的回弹。
- 简版"事件标志 + 遮蔽时长阈值"已经覆盖用户原始抱怨："看一眼详情就回来" → 时间窗口短路径 skip；"做了报名/接约再回来" → 事件触发显式 reload；"两分钟以上离开再回来" → 兜底 reload；"任何时候用户主动想要最新" → 下拉刷新。
- 没做局部 patch（事件不带 payload），原因：详情页操作过的约队/比赛**可能根本不在首页 limit 截取的列表里**，patch 难以稳定生效；统一 reload 简单可靠，"更新中..."浮标可接受。
- pages.json 首页 `navigationStyle: custom` 不影响 `enablePullDownRefresh`；下拉时露出的 `backgroundColor` 需要和页面渐变底色对齐（`#eef2e9`），否则会闪一截白边。
- `homePageLoading.test.ts` 把上一轮 `shouldSkipNextShowRefresh` 整套源码字符串钉死，是上一轮约束不回归的副作用；新策略改造时必须同步更新断言，否则会误以为是回归。

## 2026-05-17 资料页手机号绑定配置发现

- 小程序资料页原本始终渲染手机号输入和微信绑定按钮，并且保存资料时只要 `phoneInput` 有值就会调用 `/api/user/phone`。
- `loadMiniAppRuntimeConfig()` 已经提供接口失败 fallback，默认配置适合作为“隐藏手机号绑定区域”的兜底。
- 显示门控和提交门控需要同时加：只隐藏 UI 不够，旧 `phoneInput` 或历史用户手机号仍可能在保存资料时触发绑定请求。
- 本轮不把手机号纳入 `canSubmit`，因为用户要求是“默认不显示/不绑定”，不是开启后强制必填。
