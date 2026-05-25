# 小程序发现记录

## 2026-05-23 散人约队支付方式发现

- `pages/challenges/create-individual/index.vue` 当前 `form.title` 默认 `"周三晚散人局"`，散人约队创建需要改为空值。
- 同一创建页也支持 `kind=team`，原代码会在 team 模式把默认标题改为 `"周三晚球队约队"`；本轮要避免把散人标题默认值需求误扩大到球队约队。
- `src/api/payment.ts` 当前只有充值、球队会员、订单查询/同步/取消，没有散人约队支付下单接口。
- `pages/challenges/detail.vue` 和 `ChallengeIndividualRegistration` 当前只展示报名/取消报名，不展示当前用户散人报名支付状态。
- 当前倒计时 `individualCountdownText` 是开场倒计时，不是支付截止倒计时；支付倒计时需要后端返回当前用户报名支付截止时间。
- 小程序详情页应以 `BackendChallengeDetail.current_user_acceptance` 作为支付面板显示依据；未报名时不显示支付面板。
- 报名成功后不能只本地 patch `accepted_count`，需要重新拉取详情，才能拿到后端写入的 `payment_deadline_at`。
- 赛后支付没有倒计时，但仍可以直接展示支付按钮；赛前支付只有 deadline 未过期时才允许点击支付。

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

## 2026-05-19 球队活动报名人数上限发现

- `pages/matches/useMatchDetailPage.ts` 原先把 `maxPlayers` 定义为 `requiredPlayers + 2`，其中 `requiredPlayers` 来自 `activity.players_per_team`。
- 这个上限同时影响报名截止卡的人数语义和个人报名 CTA 的满员拦截。
- 球队活动当前只需要展示“达到成行人数”的进度；`/players_per_team` 可以保留作为最低成行人数，但不能限制最大报名人数。
- 成行人数分割线应该保留在进度条里；超过成行人数后的红色段只表示“超过最低人数”，不再承担容量比例含义。

## 2026-05-20 比赛报名状态按钮发现

- `TeamMemberRegistrationBoard` 已有当前用户标记 `isCurrentUser`，可直接派生当前用户处于已报名、已请假或未报名状态。
- 三个并排按钮放在内容卡片中，滚动后不可见；底部固定横条更符合高频操作位置。
- “取消报名”在已报名状态下按用户要求等同请假，应提交 `stand=2`。

## 2026-05-20 Wot UI v2 Dialog 迁移发现

- 官方 Wot UI v2 Dialog 写法为 `<wd-dialog />` 搭配 `useDialog().confirm()`；项目原先的 `wot-design-uni@1.14.0` 只提供 `<wd-message-box />` 和 `useMessage()`。
- 用户要求使用最新 2.x，因此本轮不保留 1.x MessageBox 兼容路径，easycom 统一指向 `@wot-ui/ui/components/wd-$1/wd-$1.vue`。
- 右上角关闭按钮、遮罩、动作按钮这些标准能力用 Wot 接入很快，但要完全贴合当前报名页风格时，函数式 Dialog 的收益会迅速下降。
- v2 `wd-picker` 的单列选择器也使用数组 model，旧的 number/string v-model 会在类型检查中报错，需要包装为 `[value]`。
- `@wot-ui/ui@2.0.8` npm 包当前以 TS/Vue 源码发布，`vue-tsc` 会检查依赖源码并暴露第三方包内部类型问题；本轮为 `@wot-ui/ui` 增加本地类型声明映射，只约束项目实际使用到的 `useDialog()` 类型，不影响运行时构建路径。
- Wot Dialog 默认圆角和蓝色按钮与当前报名页不协调；这次最终没有继续深调 Wot Dialog，而是直接收口为页面内自定义业务弹窗。
- 这次反复不生效的根因主要有两个：一是函数式 Dialog 的真实节点不在组件 scoped 样式作用域里；二是用透明 fixed 层锁滚动会拦截点击，容易把按钮一起挡住。最终稳定方案是把弹窗可见状态上抛到 `pages/matches/detail.vue`，用 `page-meta` 做页面级 `overflow: hidden`，同时弹窗本体完全由业务组件自己渲染。
- 报名截止卡顶部头像预览原先只取 `joinedRegistrations.value.slice(0, 5)`，所以已报 10 人时也只会展示 5 个头像；要显示完整已报名队员，需要直接遍历全部 `joinedRegistrations`。
- 队员报名状态三栏原先通过 `border`、`border-color` 和 `box-shadow` 突出当前用户与选中态；如果视觉要求是“完全无边框，只靠放大”，这些样式都要从头像容器上移除。

## 2026-05-20 比赛报名下半区职责重构发现

- 当前页面最自然的职责边界是：`IndividualCountdownCard` 负责整体报名概览，`TeamMemberRegistrationBoard` 负责队员状态查看和操作。
- 如果 `TeamMemberRegistrationBoard` 同时展开“已报名 / 请假 / 未报名”三块大区域，会和上方“已报名头像总览”形成重复，并让页面重心下沉。
- 新结构用 `selectedGroup` 切换当前分组，用 `activeSection` 只渲染一个分组列表，更符合“操作面板”而不是“第二张概览卡”的定位。
- 右上角摘要改成总人数 `N人` 后，可以避开上方 `/8` 的最低成行人数语义，不会再次制造“上限/阈值”混淆。

## 2026-05-20 创建球队审核态与版本统一发现

- `TeamCreatePanel` 当前是纯展示组件，天然适合通过 props 切换“正常态 / 审核态”，不用拆第二个页面。
- 如果直接在运行时代码里读取 `manifest.json`，uni-app / 小程序构建兼容性不够稳；更可靠的是构建前生成 `generatedMiniProgramVersion.ts`。
- mini_review 公开查询接口是独立服务，不走当前小程序后端 `getApiBaseUrl()`；因此这里应直接请求完整 HTTPS 地址。
- 共享 CLI 已经会在上传成功后把 `.env.ci.local` 的 `MINI_PROGRAM_VERSION` 回写为新版本，但如果项目层只在上传前做一次 manifest 同步，页面里的版本常量还会停在旧值。
- 为了让审核查询版本、上传版本和下一次上传基线完全闭环，项目层 wrapper 必须显式传入本次 `uploadVersion`，并在共享 CLI 成功回写后再次同步 manifest/generated version。
- 审核态是全局产品状态，不只是创建球队页的局部 UI；底部创建菜单、约队大厅发布按钮和球队管理页的“创建球队”模式都要跟随同一个全局开关。
- 生产环境下，在 mini_review 状态尚未返回之前也应先隐藏创建入口，避免首屏闪出创建按钮后又消失。

## 2026-05-20 审核态隐藏我的钱包发现

- “我的钱包”卡片由 `pages/user/index.vue` 直接渲染 `MineWalletSection`。
- 该卡片会进入账单明细二级页，属于审核态下不应暴露的资金业务入口。
- 复用 `useMiniReviewStatus().shouldHideCreationEntrances` 控制卡片显隐即可，账单二级页和 billing API 本轮不需要改动。

## 2026-05-20 首页装修配置接入发现

- 首页运行配置已经在 `loadPageData()`、游客约队加载和接约/取消报名后刷新时读取；`hero_banners` 应在这些读取点同步更新，避免操作后回到旧卡片配置。
- `HomeHeroSection` 是首页 hero 展示组件，适合只接收已 sanitize 的 banner 配置，不直接调用接口。
- 小程序端仍需要本地默认“约球开踢”卡片，避免后台未配置、接口失败或全部停用时首页顶部为空。
- 配置图片只需要作为背景图展示；没有图片时继续使用原 CSS 球场装饰，保持上线前默认视觉稳定。

## 2026-05-23 散人约队最少/最多人数配置发现

- 小程序发布页 `create-individual/index.vue` 同时支持球队约队和散人约队，因此人数高级设置必须只在 `challengeKind === "individual"` 时展示和提交。
- `BackendChallenge` 原先没有 `min_players` / `max_players`，`viewModels.ts` 和详情页都把 `players_per_team * 2` 当散人容量。
- 新语义下 `capacity` 更适合继续代表最多报名人数，同时新增 `minPlayers` / `maxPlayers` 给详情组件展示成行阈值和最多名额。
- 散人 `matched` 应显示为“已成行”，不是“已满员”；满员要看 `accepted_count >= maxPlayers`。
