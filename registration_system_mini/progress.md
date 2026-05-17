# 小程序进度记录

## 2026-05-14

- 已新增 `BackendTeamMember.is_member`。
- 已在队员添加和编辑 payload 中传递 `is_member`。
- 已在添加队员和编辑队员 UI 中增加“队员会员”开关。
- 已在队员列表中增加会员/普通 badge，并把元信息同步显示为“队员会员/普通队员”。
- 验证通过：`bun run type-check`。

## 2026-05-15

- 已将 `TeamMemberRegistrationBoard` 三栏内的头像列表从胶囊卡片样式改为轻量叠放头像列表。
- 当前用户头像现在通过黑色描边和“我”标记突出，三栏仍保留报名/请假/未报名人数与空状态。
- 已支持点击头像在对应区域显示姓名和当前状态，再点同一头像收起；切换报名状态时会清除已选姓名。
- 已为选中头像增加轻微放大和上浮过渡效果。
- 已将三栏头像尺寸从 58rpx 调整为 72rpx，并同步放大“我”标记。
- 验证通过：`bun run type-check`。

## 2026-05-15 散人约队报名页

- 已新增 `ChallengeIndividualRegistration`，散人约队详情使用比赛报名式个人报名视图。
- 散人约队报名/取消报名入口已放入报名截止卡内，移除散人模式下旧的底部按钮条。
- 球队约队详情仍使用原有约队详情结构。
- 散人约队详情页标题改为“比赛报名”。
- 散人约队黑色信息卡内地址支持点击打开地图；无坐标或开发者工具不支持时给出提示。
- 散人约队详情标题和 tab 已改为“散人报名”，报名截止卡补齐倒计时、比赛说明、底部 banner 和“回到大厅”按钮。
- 散人报名按钮右侧费用改为读取约队费用信息，不再写死“免费”。
- 已移除散人约队黑色信息卡中间的 `JOIN` 圆标。
- 约队大厅散人卡片支持未报名显示报名、已报名显示取消报名；报名和取消报名都需要二次确认。
- 验证通过：`bun run type-check`。

## 2026-05-16 我的钱包卡片

- 已移除“我的钱包”中的二级页面说明内嵌卡片和“账单明细已移到二级页面”文案。
- 钱包卡片保留当前余额和查看账单入口。
- 验证通过：`bun run type-check`、`bun test src/pages/__tests__/userPageBackground.test.ts`。
## 2026-05-15 场馆角色与约队发布权限

- 已读取小程序协作文档和 `docs/mini-architecture.md`。
- 已定位约队大厅发布权限、散人约队创建页校验、`createChallenge` API 类型和会话上下文字段。
- 已同步 `BackendUser.is_venue` 和 `BackendChallenge.host_team_id?: number | null`。
- 已将约队大厅发布权限改为队长/领队或场馆；场馆无可管理球队时发布球队约队跳到约队创建页并传 `kind=team`。
- 已将约队创建页校验改为队长/领队或场馆；只有可管理当前球队时才提交 `host_team_id`，场馆单独发布时留空。
- 已修正约队详情：场馆发布者可取消自己发布的无主队约队；场馆约队被球队接约后的本地 activity 主客队 ID 与后端语义一致。
- 已放开约队大厅无当前球队时的加载限制，纯场馆账号也能浏览公开大厅。
- 验证通过：`bun run type-check`；`bun test src/pages/__tests__/activitiesPageSections.test.ts src/utils/__tests__/viewModels.test.ts src/utils/__tests__/profileCompletion.test.ts`。
- 已同步场馆两阶段撮合语义：第一支球队占位后本队卡片显示“等待对手”，并已有待对手比赛可进入最近比赛；其他球队显示“去应战”，第二支球队接约后再跳转正式双方比赛。
- 已新增 `buildChallengeCards` 场馆撮合卡片文案测试。
- 追加验证通过：`bun run type-check`；`bun test src/utils/__tests__/viewModels.test.ts src/pages/__tests__/activitiesPageSections.test.ts`。

## 2026-05-15 当前发布身份切换

- 已新增 `CurrentIdentityViewModel`、`stores/currentIdentity.ts` 和 auth storage 当前身份读写。
- `appSession` 已暴露 `availableIdentities`、`currentIdentity`、`switchIdentity`；退出登录会清理当前身份。
- “我的”页 `MineHeroProfile` 已在球队切换下方增加“当前身份”切换条，可在队长/领队球队身份与场馆身份之间切换。
- 约队大厅发布按钮改为读取 `currentIdentity`；“球队约队”发布统一进入约队创建页 `?kind=team`。
- 约队创建页按当前身份展示发布主体；球队身份提交 `host_team_id`，场馆身份不提交；球队约队默认标题改为“周三晚球队约队”。
- 验证通过：`bun test src/stores/__tests__/currentIdentity.test.ts src/pages/__tests__/activitiesPageSections.test.ts src/utils/__tests__/viewModels.test.ts src/utils/__tests__/profileCompletion.test.ts`；`bun run type-check`。

## 2026-05-15 我的页钱包加载优化

- 已确认 `getMyBillingFlow()` 原先会参与“我的”页首屏 `Promise.all`，慢接口会拖慢钱包卡片和页面整体展示。
- 已将“我的”页钱包卡片改为只读取 `getMyBalance()`；卡片展示余额、累计扣费和“查看账单”入口，不再展示最新流水。
- 账单二级页 `pages/billing/index.vue` 继续加载 `getMyBillingFlow()` 和支付订单，承担完整明细查看。
- 已新增静态测试约束“我的”页不再包含 `getMyBillingFlow`，账单页仍包含该接口。
- 验证通过：`bun test src/pages/__tests__/userPageBackground.test.ts src/pages/__tests__/miniRemainingFeaturesIntegration.test.ts`；`bun run type-check`。

## 2026-05-15 场馆球队约队详情展示

- 已修正 `ChallengeTeamProgressCard`：场馆发布且尚无球队占位时，左侧主队不再显示发布人/场馆名，而是显示“等待接约 / 未确定”和灰色问号头像。
- 已新增静态测试约束该组件用 `challenge.host_team_id` 判断主队是否确认。
- 验证通过：`bun test src/pages/__tests__/activitiesPageSections.test.ts`；`bun run type-check`；`git diff --check`。

## 2026-05-15 报名三栏头像尺寸微调

- 保留普通头像白色描边，保留当前用户头像黑色描边和“我”角标。
- 将 `TeamMemberRegistrationBoard` 三栏头像从 72rpx 调整为 80rpx，同步放大“我”角标，并略微增加叠放间距。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts`；`bun run type-check`；`git diff --check`。

## 2026-05-15 首页约队机会排序与详情跳转

- 已将首页游客态和登录态 `listChallenges` 请求排序从 `credit_desc` 改为 `holding_date_desc`。
- 已新增首页本地排序：运行配置过滤后按 `holding_date` 倒序，同一天按 `start_time` 倒序，再截取首页展示数量。
- 已为 `HomeOpportunityList` 增加 `openChallenge` emit，点击任意约队卡片跳转到 `/pages/challenges/detail?id=...`。
- 已新增首页静态测试约束排序和跳转 wiring。
- 验证通过：`bun test src/pages/__tests__/homePageLoading.test.ts`；`bun run type-check`；`bun run build:mp-weixin`；`git diff --check`。

## 2026-05-15 首页配色微调

- 已按静态稿将首页背景、banner、球队卡、比赛卡、约队机会卡和球队数据卡调整为暖黑/草地绿/雾灰配色。
- 本轮只改 scoped style 中的颜色、阴影和渐变色值，未改模板结构、script 逻辑、接口或路由。
- 验证通过：`bun run type-check`；`bun run build:mp-weixin`；`git diff --check`。

## 2026-05-15 首页字体排版微调

- 已新增字体排版静态稿 `docs/home-typography-preview.html` 和截图 `home-typography-preview.png`。
- 已将首页 banner、section 标题、比赛卡、约队机会卡和数据卡的字重从普遍 900 调整为分层的 520/650/750/800/850。
- 已调整部分标题字号、行高和 banner 中文负字距，保持结构和业务逻辑不变。
- 验证通过：`bun run type-check`；`bun run build:mp-weixin`；`git diff --check`。

## 2026-05-15 散人报名重复标题移除

- 已删除 `ChallengeIndividualRegistration` 顶部重复的“散人报名”tabs 胶囊，页面仍由 `AppTabHeader` 显示“散人报名”。
- 已新增静态测试约束该组件不再包含 `challenge-tabs` / `challenge-tab-active`。
- 验证通过：`bun test src/pages/__tests__/activitiesPageSections.test.ts`；`bun run type-check`；`bun run build:mp-weixin`；`git diff --check`。

## 2026-05-16 我的页登录徽标修正

- 已修正头像昵称旁的徽标逻辑：只有真正没有 `currentUser` 时显示“未登录”；已登录但未加入球队时显示“未加入球队”。
- 已补充我的页静态回归约束，避免后续把球队状态再次误显示为登录状态。

## 2026-05-16 首页空球队卡片隐藏

- 已修正首页顶部球队卡片渲染条件：只有登录且存在 `currentTeam` 时展示球队卡，已登录但未加入球队时不再显示“我的球队”空壳卡片。
- 已补充首页静态回归约束，避免空球队状态再次显示该卡片。

## 2026-05-16 首页最近比赛待办

- 已将首页“最近要处理的比赛”定义为登录后的待办区：有球队时保留当前球队比赛逻辑，并追加当前用户已报名的散人约队。
- 已登录但未加入球队时只展示当前用户已报名的散人约队；没有相关散人报名时不展示该区域。
- 游客态不展示比赛卡，只显示“登录后可以查看最近要处理的比赛”的提示文案；散人约队待办状态显示为“已报名”。

## 2026-05-16 首页约队机会卡片统一

- 已将首页“约队机会”列表从紧凑条目改为与待办比赛一致的比赛卡片结构：左侧日期时间块、右侧标题标签、地点费用、进度条和底部操作。
- 类型信息从左侧时间块移到右上角标签，并按“散人报名 / 球队约队”使用不同颜色区分。
- 首页机会卡底部按钮已接入约队大厅同款操作逻辑：散人可报名/取消报名，且均有二次确认；球队约队沿用接约/详情跳转逻辑。
- 首页机会卡报名/取消报名成功后，会用同一份约队原始数据同步刷新“约队机会”和“最近要处理的比赛”，散人报名待办不再等页面重载才更新。
- 已修正公开散人局在后端 `can_accept=false` 但状态为 open 时仍显示“看详情”的问题；现在开放散人局会显示“去报名”并进入确认报名流程。
- 验证通过：`bun test src/pages/__tests__/homePageLoading.test.ts src/utils/__tests__/viewModels.test.ts`；`bun run type-check`。

## 2026-05-16 报名详情分享

- 比赛报名详情页 `pages/matches/detail` 已支持微信小程序分享和朋友圈分享，分享路径携带当前比赛 `id`。
- 散人报名/约队详情页 `pages/challenges/detail` 已支持微信小程序分享和朋友圈分享，分享路径携带当前约队 `id`。
- 分享标题会优先使用已加载的比赛/约队名称，页面未加载完成时使用兜底标题。
- 验证通过：`bun test src/pages/__tests__/matchDetailRegistrationDesign.test.ts src/pages/__tests__/activitiesPageSections.test.ts`；`bun run type-check`。

## 2026-05-16 公共页面分享封面

- 首页 `pages/home/index` 和约队大厅 `pages/activities/index` 已支持微信小程序分享和朋友圈分享。
- 比赛报名详情、散人报名/约队详情、首页、约队大厅统一使用默认分享封面 `src/static/share/share-cover.png`。
- 默认分享封面路径集中在 `src/utils/share.ts`，后续替换品牌图只需要改一个常量。

## 2026-05-16 不存在页面兜底

- 已确认此前没有注册 `onPageNotFound`，进入不存在路径时会走微信原生页面不存在提示。
- 已在 `App.vue` 增加应用级 `onPageNotFound` 处理，统一 `reLaunch` 到首页 `/pages/home/index`。
- 已新增静态测试约束该兜底逻辑。

## 2026-05-16 游客优先启动

- 已将 App 冷启动会话策略改为只恢复本地已有 token；没有 token 时保持游客态，不再自动调用微信登录。
- 首页没有 token 或手动退出时直接加载公开约队数据；已有 token 才加载个人待办、球队数据和未读消息。
- 约队大厅没有 token 时按公开数据加载；报名、取消报名、接约、发布约队时才触发登录。
- 已更新静态测试约束冷启动不再导入 `ensureSessionReady`，并约束首页/约队大厅游客加载路径。

## 2026-05-16 退出登录后刷新状态修复

- 已重新定位退出后强制刷新仍恢复登录态的根因：`clearSession()` 已写入手动退出标记，但 `restoreSessionFromStorage()` 冷启动恢复只看本地 token，没有把手动退出标记纳入判断。
- `restoreSessionFromStorage()` 现在会把手动退出视为游客态；即使本地残留 token，也会清理 token、当前球队和当前身份选择，并重置页面会话状态。
- `clearSession()` 现在统一调用 `clearLocalSessionStorage()`，确保退出动作本身一定清理 token、当前球队和当前身份；已新增 storage 单测约束该行为。
- 登录写 token 前后增加会话版本检查；如果退出后旧登录请求才返回，会再次清理本地会话并阻止旧请求把 token 写回。
- `resolveStoredSessionStrategy` 已增加手动退出场景测试，约束“手动退出优先于 token 恢复”。
- 验证通过：`bun test src/stores/__tests__/appSession.test.ts src/utils/__tests__/authStorage.test.ts`；`bun run type-check`；`git diff --check`。

## 2026-05-16 清缓存后个人中心自动登录修复

- 已定位清缓存后刷新又自动登录的原因：清缓存会删除手动退出标记，个人中心 `loadPageData()` 又无条件调用 `ensureSessionReady()`，于是无 token 时重新触发微信登录。
- “我的”页现在先检查本地 token；没有 token 时展示未登录态并清空个人数据，不再自动调用登录流程。
- `MineHeroProfile` 未登录时显示“去登录”，并隐藏“退出登录”；只有用户主动点击“去登录”才调用 `refreshSessionContext()`。
- 验证通过：`bun test src/pages/__tests__/userPageBackground.test.ts src/stores/__tests__/appSession.test.ts src/utils/__tests__/authStorage.test.ts`；`bun run type-check`；`git diff --check`。

## 2026-05-17 首页待办详情返回防抖

- 已定位“最近要处理的比赛”进入详情再返回首页抖动的原因：首页 `onShow()` 每次都会调用 `loadPageData({ preserveContent: hasLoadedOnce.value })`，回退也会触发一次刷新遮罩和卡片重算。
- 点击待办比赛卡进入详情成功后，现在会设置一次性 `shouldSkipNextShowRefresh` 标记；从详情回到首页时只消费标记，不再立即刷新首页。
- 其他进入首页的路径仍保留原来的 `onShow` 刷新逻辑。
- 验证通过：`bun test src/pages/__tests__/homePageLoading.test.ts`；`bun run type-check`；`git diff --check`。

## 2026-05-17 自定义 Tabbar 快捷创建菜单

- 已在独立分支 `codex/tabbar-fab-menu` 上修改 `BottomTabBar`。
- 中间创建按钮点击后不再显示底部抽屉，改为截图风格的全屏暗色模糊遮罩、三枚圆形快捷入口和中心按钮 `+ / ×` 切换。
- 已按反馈撤回对常驻 tabbar 底座颜色、尺寸和整体风格的覆盖；常驻 tabbar 继续使用项目原有 `uni.css` 样式，只保留展开态菜单和按钮旋转过渡。
- 三个快捷入口分别为：创建比赛、创建散人约球、创建球队；创建散人约球跳转 `/pages/challenges/create-individual/index?kind=individual`。
- 已添加展开态缩放、淡入、上浮和中心按钮旋转过渡动画。
- 验证通过：`bun test src/components/__tests__/bottomTabBarAssets.test.ts`；`bun run type-check`；`bun run build:mp-weixin`；`git diff --check`。

## 2026-05-17 首页 onShow 策略改造（A 方案 + 下拉刷新）

- 移除 `shouldSkipNextShowRefresh`；首页 `onShow` 改为"首次加载 / 事件标志显式 reload / 否则按遮蔽时长 < 2 分钟 skip"三分支。
- 新增 `onHide`：记 `hiddenAt`、清 `navigatingMatchId`（替代原 500ms `setTimeout`）。
- 新增 `onPullDownRefresh`：await `loadPageData({ preserveContent: hasLoadedOnce.value })` 后 `uni.stopPullDownRefresh()`。
- 新增事件 `home:data-may-changed`：首页 `onLoad` 订阅、`onUnload` 解绑，收到事件后下次 onShow 强制 reload。
- 详情页 emit：
  - `pages/matches/useMatchDetailPage.ts`：个人报名、个人取消、队员设报名/请假/未报名、球队报名、取消球队报名（共 6 处）
  - `pages/challenges/detail.vue`：接约、取消整条约队、取消散人个人接约（共 3 处）
- `pages.json` 首页加 `enablePullDownRefresh: true`、`backgroundColor: "#eef2e9"`、`backgroundTextStyle: "dark"`。
- `homePageLoading.test.ts`：替换钉死 `shouldSkipNextShowRefresh` 的两条断言为新策略断言；新增对 `pages.json` `enablePullDownRefresh` 的断言。
- 验证通过：`bun run type-check`、`bun test src/pages/__tests__/homePageLoading.test.ts`（9 pass / 0 fail）、`bun test`（134 pass / 1 fail，pre-existing `pageBackButton.test.ts` 中 `detail.vue` 标题已动态化但测试仍要求字符串绑定，已 stash 验证非本轮引入）。

## 2026-05-17 资料页手机号绑定配置门控

- 已在小程序 runtime config 默认值中新增 `profile.require_phone_binding=false`，并在 sanitize 中保留后端显式开启值。
- `BackendMiniAppRuntimeConfig` 已同步新增 profile section。
- `pages/profile/setup/index.vue` 已在 `onShow` 并行加载 session 与运行配置，默认隐藏手机号区域；配置开启时才显示手机号输入和微信绑定按钮。
- 保存资料时现在只有 `shouldShowPhoneBinding=true` 且手机号非空才调用 `bindMyPhoneNumber`；微信授权手机号入口也受同一门控保护。
- 验证通过：`bun test src/config/__tests__/runtimeConfig.test.ts src/pages/__tests__/miniRemainingFeaturesIntegration.test.ts`；`bun run type-check`；`bun run build:mp-weixin`；根目录 `git diff --check`。
