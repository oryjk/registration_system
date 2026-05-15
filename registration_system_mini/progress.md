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
