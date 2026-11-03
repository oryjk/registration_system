# 微信其他页面沿用首页设计 Implementation Plan

> **For agentic workers:** 使用 superpowers:subagent-driven-development 与 dispatching-parallel-agents 分模块实现；用户已明确授权延续确认稿、使用子代理，并由主代理协调及 review。

**Goal:** 将首页确认的细线图标、轻量白色卡片、清晰主次与分组列表推广到其他微信页面。用户最新明确只验收微信小程序。

**Architecture:** 业务 ViewModel、权限、事件、请求及路由保持原状。共享图标/方向字体/底栏和基础 token 由共享任务统一维护；页面代理只修改所属目录的模板、样式和必要图标导入。通过 MP-WEIXIN 条件编译隔离新增视觉。

**Tech Stack:** uni-app、Vue 3、TypeScript、Wot UI v2、Lucide SVG/PNG、现有 MinIO 素材。

**Spec:** `docs/design-assets/mini-home/v2/approved-home.png`、`registration_system_mini/docs/mini-design-system.md`，以及用户本轮「按照这套设计修改其他页面」的授权。

## Global Constraints

- 简体中文；只修改并验收微信界面，不联动后端、管理端或 Flutter；保留已有平台分支，不新增 H5 适配或单独验收。
- 不改请求、路由、DTO、表单校验、权限、支付、审核策略、新手引导、身份或数据状态逻辑。
- 不把名单、排名、费用或审核状态写死，不删业务信息。长文案自然换行，留足安全区和点击热区。
- 不新增装饰性大图，复用真实封面和已发布素材；原生地图、web-view、荣誉导出画布不套通用卡片或改输出。
- 只消除视觉不一致，不大范围重构；共享组件内部负责布局，禁止父 scoped 样式穿透或 DOM API。
- 主 CTA 纯文字或必要语义图标，不带装饰方向箭头；次级导航为单个细线 chevron，展开/收起用上下方向。
- 统一深海军蓝标题、灰蓝辅助信息、薄荷主操作、独立状态色；不恢复重描边、硬阴影、粗字重或多重箭头。
- 不为纯视觉修改新增静态断言测试；以现有相关测试、类型检查、双端构建、截图和 H5 样式对照验证。
- 代理不提交、切换分支或发布；主代理统一审查、提交合并并推送 main。

## Shared Interfaces

- 新增 `src/components/ui/AppIcon.vue`，供微信页面直接 `.vue` 导入。Props：`name` 为支持的图标名，`size?: string`（默认 `var(--ui-icon-md)`），`tone?: 'default' | 'muted'`。使用原生 image，不依赖父 scoped 样式；有明确宽高和默认装饰性 aria-hidden。只在 MP-WEIXIN 模板/导入中使用，H5 原 Wot 图标保留。
- 支持名至少包含：house、football、chart-column、user-round、users、user-plus、user-minus、shield、shield-check、trophy、medal、calendar-days、clock、map-pin、wallet、credit-card、banknote、circle-check、circle-x、circle-help、info、triangle-alert、bell、mail、message-circle、settings、pencil、camera、image、search、sliders-horizontal、chevron-left、chevron-right、chevron-down、chevron-up、arrow-left、plus、x、log-out、trash-2、refresh-cw、copy、share-2、phone、link、eye、lock-keyhole、send、receipt、wrench、check、list、star、clipboard-list、handshake、flag、external-link。
- 图标 SVG/PNG/映射/生成脚本仅共享任务维护；页面代理如需新图标先发消息，不独自修改该文件。
- 页面 CSS 用现有 `--ui-*` token；新增通用视觉 token 若需要由共享任务维护。已确认首页 `--ui-home-*` 继续有效，不在其他页面散用 home 私有 token。
- `HomeMatchList grouped` 与 `HomeMatchCard grouped` 可供已结束分类列表复用。不得改变已确认首页效果、混合状态的区别信息或真实封面回退。

## Review Focus

- 新增视觉集中在微信平台分支；按用户最新指示，不再投入额外 H5 适配、构建或对照验收。
- 微信自定义组件宿主、父子样式隔离与分包依赖；新组件必须直接 .vue 导入并通过注册检查。
- 长标题/场地/余额、多人名单、未读角标、错误/空状态；任何数据不被固定高度裁掉。
- 报名/付款/创建等主操作、危险与禁用状态的语义、热区和原生 open-type 保留。
- 统计、头像荣誉和日历保留真实排名、日期口径、已有交互与可访问说明。

### Task 1: 共享图标、导航与基础视觉

Owner: shared_visuals

- [x] 新增上述 AppIcon 接口和受控小尺寸图标集；复用现有 Lucide 来源与许可，检查主包体积。
- [x] 全局微信方向字体改为单个细线 chevron，覆盖 legacy text/Wot 对应方向而不影响 H5；维护可重现生成源。
- [x] 将首页已确认的细线底栏延伸到所有 Tab：按 current 选择薄荷选中图标，其余灰色；原菜单/未读/动画/审核过滤保留。
- [x] 精简共享 header、surface、section、button、tag、折叠名单的微信外观，H5 原样。

Files: `src/components/**`（不含 tests 业务变更）、`src/styles/**`、`src/static/**`、图标配置与生成脚本。不得编辑业务页面、全局文档或版本文件。

### Task 2: 个人中心与服务页

Owner: personal_visuals

- [x] 个人中心、我的比赛、设置/帮助/联系、账单、通知/留言、资料与荣誉页面的展示区域沿用新视觉。
- [x] 服务行使用 Lucide 细线图标和右 chevron；历史比赛使用分组列表；信息层次和低频工具保持清晰。
- [x] 保留缠观审核隐藏与点击 guard、各类原生分享/授权/支付/导出行为，H5 不变。

Files: `src/pages/user/**`、`billing/**`、`notifications/**`、`messages/**`、`profile/**`、`honors/**` 的 Vue 文件。不得修改业务 TS、共享组件、版本或全局文档。

### Task 3: 约队、比赛与场地链路

Owner: match_visuals

- [x] 大厅、搜索/发布、比赛详情/接约/表单和场地页面的展示一致化；主操作移除方向装饰，信息图标一致。
- [x] 分类比赛列表按新列表规则展示，混合状态仍展示真实状态；详情进度、名单和状态维持原数据及行为。
- [x] 首页已确认主卡及新手引导不改；仅调整共享 HomeMatchCard/List 的其他调用和分类更多页所需展示。

Files: `src/pages/activities/**`、`matches/**`、`challenges/**`、`venues/**`、`home/matches/**` 及必要 `home/components/HomeMatchCard.vue`/`HomeMatchList.vue`。不得编辑其他首页组件、业务 TS、共享组件、版本或全局文档。

### Task 4: 球队、统计与队员管理

Owner: team_visuals（待一个并行槽位释放后执行）

- [x] 球队统计、创建/加入/详情/邀请/队费与管理页面采用相同卡片、图标、按钮和列表规则。
- [x] 保留筛选分页、密码/资料 gate、角色/会员/出勤含义、底部确认面板与退出/解散语义。

Files: `src/pages/teams/**` 的 Vue 文件；不改业务 TS、共享组件、版本或全局文档。

### Task 5: 主代理集成、review 与交付

- [x] 逐模块审查 diff 与反馈，核对全部页面覆盖和共享组件影响，修复真实问题。
- [x] 运行类型检查、必要相关测试、双端正式构建与微信注册/分包校验，记录主包体积。
- [x] 对照至少个人中心、大厅、比赛详情、统计/球队四类页面的实际组件截图，覆盖窄屏/长文案；说明无法替代微信真机验收。
- [x] 更新设计规范、功能清单和变更日志；提交、同步合并并推送 main。

## 执行记录

- 基线 `6c85acb`，工作区干净；已申请同步远端并建立 `codex/mini-pages-design`。
- H5 基线复制到 `/tmp/registration-mini-other-pages-h5-before-20261103`；该目录仅用于本次对比。
- Ruling: 用户已授权将批准的视觉方案推广，不重新要求设计审批；共享资产先确定接口，互不重叠的业务页面可并行实施，最终由主代理统一验证。
- Ruling: 用户最新指示「不用管 H5，只需要管小程序」。此前已完成的条件编译对照保留为过程记录，后续不再执行 H5 构建/验收，以微信构建、资源、布局与业务保持为准。

- 验证结果：type-check通过；104个测试文件隔离运行673项全部通过；微信正式构建、27页面/3分包、组件注册、生产API及122张PNG资源校验通过；本地主包1,391,520字节。
- 排版：个人中心/大厅/比赛详情/统计分别393px和320px八组预览通过，审核入口及统计分页切换有效。浏览器原生/Wot适配器不替代微信真机，见素材记录。
- Review：共享与个人模块独立review及全分支独立review均无阻断发现；主代理已检查核心diff、构建产物和代表页面截图。
