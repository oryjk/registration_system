# 管理端发现记录

## 2026-05-23 管理后台能力对齐小程序发现

- 管理端 `src/router/index.ts` 已有活动、约队、散人报名、球队、球员、账单、系统设置页面。
- 活动 service 已声明 `home_team_id`、`away_team_id`、`match_kind`，但活动创建表单没有主客队选择和比赛类型选择，提交时也未带这些字段。
- 后端 `CreateActivityRequest` 支持 `team_checkin_configs`，小程序创建比赛已使用；管理端 `CreateActivityPayload` 未声明该字段，活动创建表单没有签到配置。
- 活动详情 `ActivityCheckInPanel.vue` 仅展示签到配置，未提供编辑入口；service 已有 `updateActivityCheckinConfig()` 可复用。
- 约队 service 可创建 challenge，但当前管理端创建入口只在散人报名页出现，并固定 `kind='individual'`、`host_team_id=null`。
- 后端 challenge router 在 `/api/admin/challenges/:id/accept` 下已有接约路径，但管理端 service 和页面未封装/展示接约操作。
- 小程序球队约队发布通过当前发布身份决定 `host_team_id` 是否传入；管理端若做同等能力，需要提供发布主体选择：球队发布、场馆发布或指定发布用户。
- 管理端球队 Logo 目前只填 URL；小程序已支持上传，后端已有 team logo 上传接口，管理端缺上传控件。

## 2026-05-14 队员会员标识

- 管理端球队详情通过 `src/services/team.ts` 的 `getTeamAdminDetail` 读取成员，成员类型为 `TeamMemberWithInfo`。
- 队员表格位于 `TeamMemberPanel.vue`，设置角色弹窗位于 `TeamSetRoleDialog.vue`，保存逻辑位于 `TeamDetail.vue`。
- 本次“队员会员”只作为队员信息 badge 和编辑项，不影响球队 VIP、球队信用或队费逻辑。
## 2026-05-15 场馆角色与约队发布权限发现

- `src/services/player.ts` 当前 `Player`/更新 payload 没有场馆角色字段。
- 管理端当前能编辑球员基本资料和冻结状态，场馆角色如果作为用户级身份，需要扩展球员详情/列表或新增专门入口。
- 若采用独立场馆实体，管理端还需要场馆资料管理和场馆用户绑定能力；若采用用户角色，则只需较小范围扩展用户/球员管理。
- 已采用用户级 `is_venue`，管理端只需在球员管理中维护该附加身份。
- `is_venue` 文案需要说明“可发布约队，仍可作为球员报名”，避免运营误解为互斥角色。
- 管理端约队 service 也要同步 `Challenge.kind` 和可空 `host_team_id`，否则场馆发布的约队详情/列表类型不可信。

## 2026-05-17 活动报名与散人报名拆分

- 管理端“散人报名”应复用约队列表数据，而不是活动列表数据。
- 散人报名筛选参数为 `/api/admin/challenges?kind=individual`。
- 活动报名页筛选参数为 `/api/admin/activities?registration_scope=team`，只显示球队报名派生活动。

## 2026-05-17 约队/散人报名编辑删除入口

- 约队列表页和详情页都需要提供操作入口，否则运营在散人报名页面看到问题后仍需要绕回数据库或后端。
- 编辑表单和删除确认逻辑在列表/详情共用，适合抽成 `ChallengeEditDialog` 和 `ChallengeCancelDialog`，避免页面继续堆叠表单状态。
- 前端“删除”按钮实际调用 `POST /api/admin/challenges/:id/cancel`，文案需提示保留历史数据。

## 2026-05-17 散人报名创建入口

- 创建散人报名和编辑散人报名字段高度一致，可以复用 `ChallengeEditDialog`，但 create mode 需要额外展示发布用户 ID。
- 创建按钮只应出现在散人报名视图，避免约队管理页误创建球队约队。
- 前端固定提交 `kind=individual`、`host_team_id=null`，不暴露挑战类型选择。
- `ChallengeEditDialog` 里的 DaisyUI input/textarea 需要显式 `w-full` 才能填满 grid cell；否则编辑页会显示成窄输入框和不规则留白。

## 2026-05-17 散人报名详情报名人员

- 管理端服务类型此前没有声明后端已返回的 `individual_participants`，导致详情页无法消费报名人员数据。
- 散人报名详情页应回到 `/individual-registrations`，否则运营从“散人报名”进入详情后点击返回会跳到“约队管理”。
- 列表卡片只需要扫视报名人员，应消费 `individual_participant_preview` 并显示前几位头像/昵称；完整名单仍放在详情页。

## 2026-05-19 活动报名列表信息补全

- 活动列表页已有 `Activity.color` / `Activity.opposing_color`，可以直接显示主队和客队球服色块，不需要为列表新增接口。
- 列表中 `holding_date` 应标为比赛时间；`start_time` / `end_time` 应标为开始报名和结束报名。
- 截止倒计时基于 `end_time`，并需要在页面停留时自动刷新，避免长时间打开后倒计时停在旧值。
- 管理端列表卡片承载信息较多时，新增时间和球服颜色适合放在一行轻量信息格中，避免挤占标题和操作区。

## 2026-05-20 小程序首页装修配置管理后台发现

- 管理后台系统设置页当前只加载地图配置，没有调用 `GET /system/mini-app-runtime-config`。
- `src/services/system.ts` 只暴露 map settings 类型和接口，需要新增 mini app runtime config 类型，避免页面直接拼接接口。
- 保存装修配置时必须先加载整份 runtime config，再只修改 `home.hero_banners` 后 PATCH 回去，否则会把 matches/checkin/billing/profile 等配置段覆盖掉。
- 当前后台项目使用 Tailwind + DaisyUI，系统设置页已有大圆角卡片视觉；新增装修配置应保持这个体系，不引入另一套组件风格。
- 后台管理的 HTTP baseURL 已固定为 `/api/admin`，所以装修图上传封装应请求 `/system/mini-app-decoration/images`，实际后端路径为 `/api/admin/system/mini-app-decoration/images`。
- 上传使用浏览器 `FormData`，服务层需要覆盖 `Content-Type: multipart/form-data`，继续复用现有 axios 响应解包逻辑。

## 2026-05-20 管理端 UI 规范化发现

- 管理端当前已经依赖 DaisyUI 5 和 Tailwind 4，首轮规范化直接补全局 `admin-*` 基础类即可，不需要为系统设置页引入 shadcn。
- 系统设置页适合作为首个迁移样板：它同时包含页面 header、状态摘要、配置表单、上传配置和保存区，能覆盖后台常见页面元素。
- `admin-action-bar` 不适合默认 sticky；系统设置页有地图设置和小程序装修两个保存动作，sticky 会让后一个保存按钮在上半屏提前出现。
- 深色主题由 `data-theme='dark'` 驱动，新增 CSS 变量必须直接覆盖该选择器，不能只包在 `prefers-color-scheme` 下。
- 图片装修预览仍可保留较强视觉，但外层编辑表单需要回到运营后台的克制密度和小圆角。

## 2026-05-23 复用后端接口补齐管理端发现

- `Activity` service 类型已经有读取字段，但 `CreateActivityPayload` / `UpdateActivityPayload` 此前缺少 `match_kind` 与签到配置写入类型。
- 活动列表页创建表单此前没有加载球队列表，无法提交 `home_team_id` / `away_team_id`；可复用 `adminListTeams(true)` 作为主客队选项。
- 活动详情页 `ActivityCheckInPanel` 此前只读；后端已有 `updateActivityCheckinConfig` service 封装，可以直接把卡片扩展为按球队保存配置。
- 球队 Logo 上传后端接口和小程序上传思路类似，但管理端应使用浏览器 `FormData`，不要复用 `uni.uploadFile`。
- 后端 admin 创建 challenge 当前只允许散人报名：`kind` 必须是 `individual`，`host_team_id` 必须为空；管理端不能用现有接口创建球队约队。

## 2026-05-23 散人报名最少/最多人数配置发现

- 管理端 `Challenge` 类型原先只有 `players_per_team`，列表和详情都用 `players_per_team * 2` 表示散人容量。
- 新后端字段 `min_players` / `max_players` 是 nullable，管理端展示必须按同样默认值兜底，不能要求旧数据都有物理值。
- 创建/编辑弹窗已经只用于后台创建散人报名和编辑约队基础字段；因此散人人数配置适合放在该弹窗中，且只在散人报名场景显示。
