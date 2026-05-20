# 小程序任务计划

## 2026-05-14 队员会员标识

目标：在球队管理页面支持设置并展示“队员是否会员”，该标识来自后端 `team_members.is_member`，不等同于球队 VIP。

阶段：
1. [completed] 同步 `BackendTeamMember` 与 `src/api/team.ts` 请求 payload
2. [completed] 添加队员表单增加“队员会员”开关
3. [completed] 编辑队员弹窗增加“队员会员”开关
4. [completed] 队员列表卡片展示会员/普通区分
5. [completed] 执行 `bun run type-check`

## 2026-05-15 报名详情队员三栏头像列表

目标：比赛报名详情页保留“报名 / 请假 / 未报名”三块区域，但人员展示改回已有报名详情里的轻量头像列表样式，避免大卡片/胶囊列表显得过重。

阶段：
1. [completed] 对照 `IndividualCountdownCard` 与约队详情头像栈样式
2. [completed] 将 `TeamMemberRegistrationBoard` 的人员展示从胶囊卡片改为头像栈
3. [completed] 当前用户使用头像描边和“我”标记突出
4. [completed] 点击头像后在对应区域显示姓名和状态，再点同一头像收起
5. [completed] 选中头像增加轻微放大和上浮动效
6. [completed] 执行 `bun run type-check`

## 2026-05-15 散人约队报名页对齐比赛报名

目标：散人约队详情中的个人报名区域对齐比赛报名页风格和操作，只是不展示球队三栏状态卡。

阶段：
1. [completed] 保留球队约队详情旧结构，散人约队单独分流
2. [completed] 新增散人约队个人报名视图，使用比赛报名式 tab、黑色信息卡和报名截止卡
3. [completed] 报名/取消报名操作收敛到报名截止卡内部
4. [completed] 散人约队页面标题改为“比赛报名”
5. [completed] 执行 `bun run type-check`

## 2026-05-15 场馆角色与约队发布权限

目标：在小程序端支持“队长/领队或场馆”发布约队，最终覆盖球队约队与散人约队。

阶段：
1. [completed] 盘点约队大厅发布入口和发布类型弹层
2. [completed] 盘点散人约队创建页和 `createChallenge` API 入参
3. [completed] 盘点会话上下文当前可用的用户/球队权限字段
4. [completed] 同步 `BackendUser.is_venue` 与可空 `BackendChallenge.host_team_id`
5. [completed] 约队大厅发布权限改为队长/领队或场馆
6. [completed] 场馆发布球队约队时跳转到约队创建页并不传 `host_team_id`
7. [completed] 场馆发布者可在详情页取消自己发布的无主队约队
8. [completed] 无当前球队时仍加载公开约队大厅
9. [completed] 执行 `bun run type-check` 和目标 `bun test`

## 2026-05-15 当前发布身份切换

目标：在“我的”页支持切换当前发布身份，并让约队创建使用当前身份判断发布主体。

阶段：
1. [completed] 盘点 `appSession`、当前球队切换和“我的”页 profile card
2. [completed] 新增当前身份派生 helper 与持久化 storage
3. [completed] 在 `MineHeroProfile` 增加“当前身份”切换条
4. [completed] 约队大厅发布权限改为 `currentIdentity`
5. [completed] 约队创建页按当前身份提交 `host_team_id`
6. [completed] 更新并执行目标测试、`bun run type-check`

## 2026-05-15 我的页钱包加载优化

目标：避免 `/api/order/my-billing-flow` 慢接口影响“我的”页首屏和钱包卡片展示，把完整账单明细留在二级页面。

阶段：
1. [completed] 确认“我的”页首屏调用了 `getMyBillingFlow`
2. [completed] 钱包卡片改为只依赖 `getMyBalance`
3. [completed] 钱包卡片保留“查看账单/全部账单”入口
4. [completed] 账单明细页继续使用 `getMyBillingFlow`
5. [completed] 更新静态测试和执行 `bun run type-check`

## 2026-05-15 首页约队机会排序与详情跳转

目标：首页“约队机会”按比赛时间倒序展示，并支持点击任意约队进入约队详情。

阶段：
1. [completed] 定位首页约队加载逻辑和 `HomeOpportunityList`
2. [completed] 首页约队请求改为 `holding_date_desc`
3. [completed] 本地按 `holding_date`、`start_time` 倒序排序后再截取展示数量
4. [completed] `HomeOpportunityList` 增加 `openChallenge` 事件
5. [completed] 首页接收事件并跳转 `/pages/challenges/detail`
6. [completed] 更新并执行目标测试、类型检查和小程序构建

## 2026-05-15 首页配色微调

目标：只调整首页颜色观感，不改变结构和业务逻辑。

阶段：
1. [completed] 制作独立静态配色稿 `../docs/home-color-preview.html`
2. [completed] 用户确认仅改配色
3. [completed] 调整首页背景、banner、比赛卡片、约队机会卡和球队数据卡颜色
4. [completed] 执行 `bun run type-check`、`bun run build:mp-weixin` 和 `git diff --check`

## 2026-05-15 首页字体排版微调

目标：只调整首页字体层级，让标题、正文、标签和按钮的视觉重量更清晰。

阶段：
1. [completed] 制作独立静态字体稿 `../docs/home-typography-preview.html`
2. [completed] 用户确认字体排版方向
3. [completed] 调整首页相关组件的字号、字重、行高和 banner 中文字距
4. [completed] 执行 `bun run type-check`、`bun run build:mp-weixin` 和 `git diff --check`

## 2026-05-15 散人报名重复标题移除

目标：散人报名详情页顶部已有 header 标识，移除内容区重复的“散人报名”胶囊。

阶段：
1. [completed] 定位重复胶囊在 `ChallengeIndividualRegistration`
2. [completed] 删除重复 tabs 模板和样式
3. [completed] 增加静态测试约束不回归
4. [completed] 执行目标测试、类型检查、构建和 `git diff --check`

## 2026-05-17 首页 onShow 策略改造（A 方案）

目标：上一轮"`shouldSkipNextShowRefresh` 单点跳过"补丁未能消除抖动；改为事件驱动 + 遮蔽时长阈值的整体策略，并接入下拉刷新作为主动出口。

阶段：
1. [completed] 调研：首页数据来源、影响首页的详情页 mutation、事件总线现状、pages.json 下拉刷新现状、被钉死的测试断言
2. [completed] 首页 `index.vue`：移除 `shouldSkipNextShowRefresh`；新增 `hiddenAt` / `pendingReloadFromEvent` / `HIDDEN_RELOAD_THRESHOLD_MS=2分钟`；`onShow` 改为「首次加载 → 事件触发显式 reload → 否则按遮蔽时长阈值 skip」；新增 `onHide` 记 `hiddenAt` 并清 `navigatingMatchId`
3. [completed] 详情页 emit `home:data-may-changed`：比赛详情个人/球队报名相关六处 + 约队详情接约/取消整条/取消个人接约三处
4. [completed] `pages.json` 首页开 `enablePullDownRefresh`、`backgroundColor`、`backgroundTextStyle`；`onPullDownRefresh` await `loadPageData` 后 `stopPullDownRefresh`
5. [completed] `homePageLoading.test.ts`：替换钉死 `shouldSkipNextShowRefresh` 的两条断言为新策略断言
6. [completed] 验证：`bun run type-check`、`bun test src/pages/__tests__/homePageLoading.test.ts`（9 pass）、`bun test`（135 中 1 fail 是 pre-existing `pageBackButton` detail.vue 标题动态化导致，与本轮无关）

约束：

- `home:data-may-changed` 不带 payload，由首页 `onShow` 统一 reload，不做局部 patch
- 未覆盖的低频 mutation（签到、互评、结算、约队创建、比赛创建）依赖时间窗口（2 分钟）和下拉刷新兜底
- 不修改后端、不修改约队大厅页内的就地 patch 流程

## 2026-05-17 资料页手机号绑定配置门控

目标：资料页默认不展示手机号绑定区域，只有后端小程序运行配置显式开启时才显示并允许绑定。

阶段：
1. [completed] `BackendMiniAppRuntimeConfig` 增加 `profile.require_phone_binding`
2. [completed] `runtimeConfig` 默认值和 sanitize 默认 `require_phone_binding=false`
3. [completed] `pages/profile/setup` 在 `onShow` 加载运行配置并用 `shouldShowPhoneBinding` 控制手机号区域
4. [completed] 保存资料和微信手机号授权都受 `shouldShowPhoneBinding` 门控
5. [completed] 执行目标测试、类型检查和小程序构建

## 2026-05-19 球队活动报名取消人数上限

目标：球队活动个人报名暂不限制最大报名人数，详情页 `已报 N / 人数` 仅表示最低成行人数。

阶段：
1. [completed] 定位 `players_per_team + 2` 上限来源
2. [completed] 新增目标测试约束不再出现容量上限逻辑
3. [completed] 移除满员拦截并调整进度条计算
4. [completed] 倒计时卡保留 `已报 N / 最低成行人数`
5. [completed] 执行目标测试、类型检查和 diff 检查

## 2026-05-20 比赛报名底部状态按钮

目标：队员报名状态操作合并为底部固定横条按钮，通过弹出选项选择报名或请假。

阶段：
1. [completed] 移除卡片内三按钮操作区
2. [completed] 新增底部固定浮动按钮，按当前用户状态切换颜色和文案
3. [completed] 未报名/已请假时提供报名和请假选项
4. [completed] 已报名时提供“取消报名（请假）”，提交请假状态
5. [completed] 执行目标测试、类型检查和 diff 检查

## 2026-05-20 球队报名 Wot UI v2 Dialog

目标：球队报名底部操作按钮使用 Wot UI v2 confirm Dialog，并支持右上角关闭按钮。

阶段：
1. [completed] 安装 Wot UI 官方 skills 到小程序 `.agents/skills`
2. [completed] 迁移依赖：`wot-design-uni@1.x` -> `@wot-ui/ui@2.x`
3. [completed] 更新 easycom 配置与静态测试
4. [completed] 队员报名操作改为 `<wd-dialog /> + useDialog().confirm()`
5. [completed] 同步 v2 `wd-picker` 单列数组值迁移
6. [completed] 执行目标测试、类型检查和微信小程序构建验证

补充：

- Wot UI v2 迁移本身保留。
- 队员报名状态弹窗这一处，最终已从 `wd-dialog + useDialog().confirm()` 收口为页面内自定义业务弹窗，以提高风格一致性和可控性。

## 2026-05-20 球队报名 Dialog 视觉与锁滚动

目标：优化队员报名弹窗圆角、按钮配色和打开后的背景滚动行为，并收口为页面内自定义业务弹窗。

阶段：
1. [completed] 调整弹窗局部视觉样式，并最终替换为自定义业务弹窗结构
2. [completed] 将弹窗可见状态上抛到比赛详情页，并通过 `page-meta` 锁定页面滚动
3. [completed] 补充本地 Wot 类型声明和静态测试约束
4. [completed] 执行目标测试、类型检查、微信小程序构建和 diff 检查

## 2026-05-20 比赛报名下半区职责重构

目标：把比赛报名详情页下半区改成切换式状态操作面板，避免与上方报名概览重复。

阶段：
1. [completed] 将下半区标题与右侧摘要改为“队员状态”与总人数
2. [completed] 用状态切换条替代三块同时展开的状态区域
3. [completed] 默认定位到当前用户所在分组，并只展示当前分组头像
4. [completed] 保留头像点选昵称与底部状态按钮
5. [completed] 补充静态测试并执行小程序验证
