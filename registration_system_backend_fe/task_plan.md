# 管理端任务计划

## 2026-05-27 后台场馆管理

目标：在管理后台提供独立的场馆管理页面，支持独立账号创建场馆、按小程序用户昵称搜索并绑定为场馆、场馆列表增删查改、活跃/冻结切换，以及必要的改密入口。

阶段：
1. [completed] 盘点当前球员管理、登录、导航和服务层现状
2. [completed] 设计场馆服务类型和接口封装，尽量复用现有用户字段
3. [completed] 新增场馆列表页面与创建/编辑/绑定/冻结交互
4. [completed] 将导航与路由接入，并补充必要类型校验/构建验证
5. [completed] 同步管理端文档与验证结果

约束：

- 保持 DaisyUI + Tailwind 现有后台风格，不做无关视觉重构。
- 页面优先作为编排层，表单和请求组装尽量抽到 `services` / `model` / 子组件。
- 与后端对齐，状态只区分活跃/冻结，不额外发明第三种前端枚举。

## 2026-05-23 管理后台能力对齐小程序

目标：审计管理后台相对小程序缺失的运营能力，重点覆盖发布比赛、创建比赛、活动、约队、球队等功能，确保后续后台不弱于小程序。

阶段：
1. [completed] 读取管理端协作文档和当前路由
2. [completed] 盘点管理端 views/services 当前能力
3. [completed] 对照小程序发布约队、创建比赛、球队管理路径
4. [completed] 对照后端管理端路由和 DTO 能力
5. [completed] 整理可执行缺口清单与实现优先级

当前建议方向：
- 第一优先级补齐运营创建/发布能力：球队约队创建、后台撮合接约、活动创建时选主客队和比赛类型。
- 第二优先级补齐配置能力：创建/编辑签到配置、球队 Logo 上传、场馆/发布用户选择器。
- 第三优先级做体验收敛：把活动创建表单和小程序 `MatchPublishForm` 关键字段语义对齐。

## 2026-05-14 队员会员标识

目标：管理后台球队详情支持查看和编辑队员会员身份，与后端 `team_members.is_member` 保持一致。

阶段：
1. [completed] 同步 `TeamMemberWithInfo`、新增/更新成员 payload 类型
2. [completed] 队员表格增加会员身份列
3. [completed] 设置角色弹窗增加“队员会员”开关
4. [completed] 保存角色时同步提交 `is_member`
5. [completed] 执行 `bun run type-check`
## 2026-05-15 场馆角色与约队发布权限

目标：如场馆身份需要运营配置，管理后台需提供用户/球员场馆角色的查看与编辑入口。

阶段：
1. [completed] 读取管理端协作文档
2. [completed] 盘点球员 service 当前字段
3. [completed] 盘点后端管理端用户更新入口是否支持角色字段
4. [completed] 同步球员 service `is_venue` 字段和创建/更新 payload
5. [completed] 球员编辑弹窗增加“场馆身份”开关
6. [completed] 球员列表显示“场馆”标识
7. [completed] 同步约队 service 的可空 `host_team_id`
8. [completed] 执行 `bun run type-check`

## 2026-05-17 活动报名与散人报名拆分

目标：管理后台侧边栏新增“散人报名”，活动报名页只展示球队报名派生活动。

阶段：
1. [completed] 活动服务类型补充 `source_activity_id` / `team_registration_count`
2. [completed] 约队服务增加 `kind` 查询参数和散人报名人数类型字段
3. [completed] 新增 `/individual-registrations` 路由和侧边栏入口
4. [completed] 活动报名页固定请求 `registration_scope=team`
5. [in_progress] 复用约队列表实现散人报名视图并运行类型检查

验证更新：
- [completed] `bun run type-check`
- [completed] `bun run build`
- [blocked] `bun run lint` 被既有非本轮问题阻塞

## 2026-05-17 约队/散人报名编辑删除入口

目标：管理后台约队管理和散人报名页面提供编辑、删除操作，并在详情页保留同样入口。

阶段：
1. [completed] `src/services/challenge.ts` 增加更新和取消接口封装
2. [completed] 列表卡片增加编辑/删除按钮
3. [completed] 详情页 header 增加编辑/删除按钮
4. [completed] 抽离 `ChallengeEditDialog.vue` 和 `ChallengeCancelDialog.vue`
5. [completed] 执行 `bun run type-check` 与 `bun run build`

约束：

- 删除文案对应后端取消，不做物理删除。
- 非 open 状态按钮禁用。
- 表单仅编辑基础字段，不改变挑战类型和报名关系。

## 2026-05-17 散人报名创建入口

目标：散人报名页面提供后台创建入口，超管可指定发布用户创建散人局。

阶段：
1. [completed] challenge service 增加 `createAdminChallenge`
2. [completed] `ChallengeEditDialog` 支持 create mode 和发布用户 ID 字段
3. [completed] 散人报名页顶部增加“创建散人报名”按钮
4. [completed] 创建成功后刷新当前列表
5. [completed] 执行 `bun run type-check` 与 `bun run build`
6. [completed] 修复 `ChallengeEditDialog` 表单控件宽度和 grid 间距，确保编辑/创建弹窗布局对齐

约束：

- 创建入口只在 `/individual-registrations` 散人报名视图展示。
- 表单需要填写发布用户 ID，后端负责校验该用户是否可作为场馆发布方。

## 2026-05-17 散人报名详情展示报名人员

目标：详情页能直接看到散人报名人员头像、名称和用户 ID。

阶段：
1. [completed] `src/services/challenge.ts` 补充 `ChallengeIndividualParticipant`
2. [completed] `ChallengeDetail.vue` 新增报名人员卡片
3. [completed] 散人报名详情返回列表指向 `/individual-registrations`
4. [completed] `ChallengeList.vue` 散人报名卡片增加报名人员预览头像和昵称
5. [completed] 执行 `bun run type-check` 与 `bun run build`

## 2026-05-19 活动报名列表为空修复

目标：修正活动报名页说明与 `registration_scope=team` 语义，配合后端显示有球队参与的报名活动。

阶段：
1. [completed] 确认活动报名页固定请求 `registration_scope=team`
2. [completed] 同步 service 注释，明确 team 是有球队参与的报名活动
3. [completed] 调整页面说明，避免继续描述成仅“派生的比赛”
4. [completed] 执行 `bun run type-check`

## 2026-05-19 活动详情编辑球服颜色

目标：活动详情页点击“编辑”后，可以设置主队和客队球服颜色。

阶段：
1. [completed] 确认详情编辑弹窗复用 `ActivityEditDialog`
2. [completed] `ActivityEditFormState` 增加 `color` / `opposing_color`
3. [completed] 弹窗增加主队球服和客队球服色块选择、清空按钮
4. [completed] 详情页打开编辑时回填颜色，保存时提交颜色字段
5. [completed] 执行 `bun run type-check`

## 2026-05-19 活动报名列表信息补全

目标：活动报名列表卡片展示双方球队球服颜色、比赛时间、开始报名时间、结束报名时间和结束报名倒计时。

阶段：
1. [completed] 确认 `Activity` 类型已有列表所需字段
2. [completed] 将列表原报名时间段展示改为明确的比赛时间
3. [completed] 增加报名开始、报名截止、截止倒计时和主客队球服色块展示
4. [completed] 增加分钟级倒计时刷新
5. [completed] 本地页面确认列表密度与文案，执行 `bun run type-check` 和 `git diff --check`

## 2026-05-20 小程序首页装修配置管理后台

目标：管理后台系统设置页支持维护小程序首页 hero/banner 装修配置，多条配置供小程序轮播。

阶段：
1. [completed] 在 `src/services/system.ts` 增加 mini app runtime config 类型与 GET/PATCH 封装
2. [completed] 拆出小程序装修配置表单模型或组件，避免继续膨胀 `SystemSettings.vue`
3. [completed] 系统设置页增加“小程序装修”区域，支持新增、删除、启用、排序和图片地址预览
4. [completed] 保存时保持整份 runtime config 结构，不覆盖其它配置段
5. [completed] 执行 `bun run type-check` 和必要构建

## 2026-05-20 小程序装修图片上传管理端

目标：小程序装修配置中支持直接选择本地图片上传，上传成功后回填图片地址。

阶段：
1. [completed] 在 `src/services/system.ts` 增加上传接口封装
2. [completed] 在 `MiniAppDecorationPanel.vue` 图片地址旁增加上传按钮
3. [completed] 上传中显示状态，失败显示错误，成功回填 `image_url`
4. [completed] 执行目标测试、类型检查和构建

## 2026-05-20 管理端 UI 规范化首轮

目标：基于现有 DaisyUI + Tailwind 建立轻量后台 UI 规范，并先迁移系统设置页。

阶段：
1. [completed] 确认本轮不引入 shadcn，沿用 DaisyUI + Tailwind
2. [completed] 在 `src/assets/main.css` 新增 `admin-*` 基础类和表单/按钮基线
3. [completed] 重构 `SystemSettings.vue` 的布局和卡片层级
4. [completed] 调整 `MiniAppDecorationPanel.vue` 对齐新规范
5. [completed] 通过浏览器检查系统设置页，修复 sticky 保存条和深色主题变量
6. [completed] 执行 `bun run type-check`、目标单测、`bun run build`

## 2026-05-23 复用后端接口补齐管理端能力

目标：只改管理端前端，把后端已支持且可直接复用的活动、签到和球队 Logo 能力接到页面上。

阶段：
1. [completed] 确认后端 DTO、路由和管理端 service 现状
2. [completed] 活动新建/编辑表单补齐主队、客队、比赛类型
3. [completed] 活动创建补齐球队签到初始配置，详情页补齐签到配置编辑
4. [completed] 球队详情编辑弹窗补齐队徽上传
5. [completed] 明确后台球队约队创建现有后端接口不可复用，暂不做入口
6. [completed] 执行 `bun run type-check` 和目标 `git diff --check`

## 2026-05-23 散人报名最少/最多人数配置

目标：管理后台创建和编辑散人报名时可配置最少成行人数、最多报名人数，并在列表/详情中按新语义展示。

阶段：
1. [completed] `src/services/challenge.ts` 类型和 payload 增加 `min_players` / `max_players`
2. [completed] `ChallengeEditDialog.vue` 散人表单增加两个人数输入与前端校验
3. [completed] `ChallengeList.vue` 散人卡片展示 `已报 N / min 成行，最多 max`
4. [completed] `ChallengeDetail.vue` 散人报名人员摘要展示成行人数和最多人数
5. [completed] 执行 `bun run type-check` 和 `bun run build`
