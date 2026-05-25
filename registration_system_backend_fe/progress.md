# 管理端进度记录

## 2026-05-23 管理后台能力对齐小程序

- 已读取管理端路由和侧边栏，确认当前页面入口：球队、约队、活动报名、散人报名、账单、球员、系统设置。
- 已读取 `src/services/activity.ts`、`challenge.ts`、`team.ts`、`player.ts`、`billing.ts`。
- 已读取 `ActivityList.vue`、`ActivityDetail.vue`、`ActivityCheckInPanel.vue`、`ChallengeList.vue`、`ChallengeEditDialog.vue`、`TeamList.vue`、`PlayerList.vue`。
- 已对照小程序 `pages/challenges/create-individual/index.vue`、`pages/matches/create/index.vue`、`components/MatchPublishForm.vue`。
- 已确认后端 `/api/admin/activities` 与 `/api/admin/challenges` 具备部分管理端未使用字段/操作。

## 2026-05-14

- 已在服务类型和 payload 中加入 `is_member`。
- 已在队员列表表格增加“会员”列，显示“队员会员/普通队员”。
- 已在设置角色弹窗增加“队员会员” toggle，并在保存时提交。
- 验证通过：`bun run type-check`。
## 2026-05-15 场馆角色与约队发布权限

- 已读取管理端协作文档并查看球员 service。
- 已在 `src/services/player.ts` 增加 `Player.is_venue` 和 create/update payload 字段。
- 已在球员创建/编辑弹窗增加“场馆身份”开关，并提示仍可作为球员报名。
- 已在球员列表姓名区域显示“场馆”badge。
- 已同步 `src/services/challenge.ts` 的 `Challenge.kind` 和可空 `host_team_id`。
- 验证通过：`bun run type-check`。

## 2026-05-17 活动报名与散人报名拆分

- 已新增侧边栏“散人报名”和路由 `/individual-registrations`。
- 已让 `ChallengeList.vue` 根据路由 meta 切换“约队管理 / 散人报名”视图，并对散人报名传 `kind=individual`。
- 已让 `ActivityList.vue` 请求 `registration_scope=team` 并展示 `team_registration_count`。

- 17:25 验证通过：`bun run type-check`、`bun run build`。
- 17:25 `bun run lint` 未通过，失败点为既有 `ActivitySettlementPanel.vue` / `PlayerFilterBar.vue` / `PlayerFreezeDialog.vue` prop 直接变更和 `PlayerList.vue` 未使用导入，非本轮改动文件。

## 2026-05-17 约队/散人报名编辑删除入口

- 已在 `src/services/challenge.ts` 增加 `updateAdminChallenge`、`cancelAdminChallenge` 和 `UpdateChallengePayload`。
- 已在 `ChallengeList.vue` 卡片操作区增加编辑/删除按钮，非 open 状态禁用。
- 已在 `ChallengeDetail.vue` header 增加编辑/删除按钮，保存/删除后刷新详情。
- 已抽离 `ChallengeEditDialog.vue` 与 `ChallengeCancelDialog.vue`；`ChallengeList.vue` 当前 501 行，`ChallengeDetail.vue` 当前 322 行。
- 验证通过：`bun run type-check`。
- 验证通过：`bun run build`。
- `bun run lint` 仍被既有非本轮文件阻塞：`ActivitySettlementPanel.vue`、`PlayerFilterBar.vue`、`PlayerFreezeDialog.vue`、`PlayerList.vue`。

## 2026-05-17 散人报名创建入口

- 已在 `src/services/challenge.ts` 增加 `CreateIndividualChallengePayload` 和 `createAdminChallenge`。
- 已让 `ChallengeEditDialog.vue` 支持 create mode，创建时额外展示发布用户 ID 输入。
- 已在 `ChallengeList.vue` 的散人报名视图顶部增加“创建散人报名”按钮，保存后刷新列表。
- 已修复 `ChallengeEditDialog.vue` 编辑/创建弹窗样式：modal 全宽受 `max-w-3xl` 限制，所有输入框/文本域填满栅格单元，表单横纵间距分离。
- 验证通过：`bun run type-check`。
- 验证通过：`bun run build`。

## 2026-05-17 散人报名详情报名人员

- 已在 `src/services/challenge.ts` 增加 `ChallengeIndividualParticipant` 并接入 `ChallengeDetail.individual_participants`。
- 已在 `ChallengeDetail.vue` 增加“报名人员”卡片，展示头像、名称和用户 ID；无头像时显示姓名首字兜底。
- 已让散人报名详情的面包屑和返回列表指向 `/individual-registrations`。
- 已在 `ChallengeList.vue` 散人报名卡片中展示报名人员预览头像和昵称，人数多时显示“等 N 人”。
- 验证通过：`bun run type-check`。
- 验证通过：`bun run build`。

## 2026-05-19 活动报名列表为空修复

- 已确认活动报名页固定传 `registration_scope=team`，页面为空是后端 scope 条件把直接球队活动过滤掉。
- 已同步 `src/services/activity.ts` 注释和 `ActivityList.vue` 页面说明，将 team scope 说明为有球队参与、可做球队内部报名的活动。
- 验证通过：`bun run type-check`。

## 2026-05-19 活动详情编辑球服颜色

- 已在 `ActivityEditDialog.vue` 中增加主队球服、客队球服色块选择和清空按钮。
- 已在 `ActivityDetail.vue` 的编辑表单状态中接入 `color` / `opposing_color`，打开弹窗时回填，保存时提交。
- 已将活动列表页原本内联的颜色常量和标准化函数抽到 `activity-detail.model.ts` 复用。
- 验证通过：`bun run type-check`。

## 2026-05-19 活动报名列表信息补全

- 已在 `ActivityList.vue` 的列表卡片中补充比赛时间、报名开始、报名截止、截止倒计时和主客队球服颜色。
- `holding_date` 展示为比赛时间；`start_time` / `end_time` 展示为报名窗口。
- 截止倒计时使用分钟级 tick 刷新，已截止时显示“已截止”。
- 验证通过：`bun run type-check`、根目录 `git diff --check`。
- 已本地登录管理端并查看 `/activities` 页面，卡片新增信息展示正常；倒计时标签调整为“结束报名倒计时”。

## 2026-05-20 小程序首页装修配置管理后台

- 已开始扩展系统设置页，目标是支持配置小程序首页“约球开踢”卡片的文字、图片和多条轮播数据。
- 已确认需要新增 `mini-app-runtime-config` service 封装，并在保存装修配置时保留其它 runtime config 段。
- 已新增 `MiniAppDecorationPanel.vue` 和 `mini-app-decoration.model.ts`，系统设置页可新增、删除、启用、排序、填写图片地址并预览首页卡片。
- 已新增 `getMiniAppRuntimeConfig` / `updateMiniAppRuntimeConfig` service 封装；保存装修配置时只替换 `home.hero_banners`。
- 验证通过：`bun run test:unit src/__tests__/mini-app-decoration.model.spec.ts`、`bun run type-check`、`bun run build`。

## 2026-05-20 小程序装修图片上传管理端

- 已新增 `uploadMiniAppDecorationImage(file)`，通过 multipart 上传到 `/api/admin/system/mini-app-decoration/images`。
- `MiniAppDecorationPanel` 图片地址旁已增加“上传图片”按钮，支持 jpg/png/webp，上传中显示 loading，失败显示错误，成功回填图片地址并更新预览。
- 验证通过：`bun run test:unit src/__tests__/mini-app-decoration.model.spec.ts`、`bun run type-check`、`bun run build`。

## 2026-05-20 管理端 UI 规范化首轮

- 已在 `src/assets/main.css` 增加管理端基础 UI 变量和 `admin-page`、`admin-panel`、`admin-field`、`admin-badge`、`admin-action-bar` 等类。
- 已统一 DaisyUI `.input`、`.select`、`.textarea`、`.btn` 的后台基础边框、圆角、focus 和字重。
- 已替换 `SystemSettings.vue` 结构，去掉大面积渐变和大圆角 hero，改为页面 header、摘要卡、配置 panel 和内联保存条。
- 已调整 `MiniAppDecorationPanel.vue` 外层与字段样式，使装修配置表单和系统设置页其它区域保持一致。
- 已通过浏览器登录本地管理端检查 `/system/settings`，发现并修复两个问题：保存条 sticky 上下文错位、深色主题新增文字变量不可读。
- 验证通过：`bun run type-check`、`bun run test:unit src/__tests__/mini-app-decoration.model.spec.ts src/__tests__/map-settings.model.spec.ts`、`bun run build`、目标 `git diff --check`。

## 2026-05-23 复用后端接口补齐管理端

- 已在 `src/services/activity.ts` 增加活动创建/编辑可写字段：`match_kind`、`team_checkin_configs` 与对应签到配置 payload。
- 已在 `ActivityList.vue` 的活动创建/编辑弹窗增加主队、客队、比赛类型和球队签到初始配置，并从 `adminListTeams(true)` 加载队伍选项。
- 已在 `ActivityEditDialog.vue` / `ActivityDetail.vue` 增加主客队和比赛类型编辑，保存时提交到现有 `updateActivity`。
- 已将 `ActivityCheckInPanel.vue` 从只读展示扩展为可编辑卡片，保存调用现有 `updateActivityCheckinConfig`。
- 已在 `src/services/team.ts` 增加 `uploadTeamLogo(teamId, file)`，并在 `TeamEditDialog.vue` / `TeamDetail.vue` 接入本地队徽上传、回填和刷新。
- 已确认现有后端不支持 admin 创建球队约队，本轮未新增无效入口。
- 验证通过：`bun run type-check`、目标 `git diff --check`。

## 2026-05-23 散人报名最少/最多人数配置

- 已在 `src/services/challenge.ts` 为 `Challenge` 和创建/更新 payload 增加 `min_players` / `max_players`。
- 已在 `ChallengeEditDialog.vue` 增加散人报名专用的“最少成行人数”“最多报名人数”输入；为空时沿用默认规则，前端校验最少人数不能大于最多人数。
- 已在 `ChallengeList.vue` 中把散人报名人数展示改为 `已报 N / min 成行，最多 max`，并显示剩余最多名额。
- 已在 `ChallengeDetail.vue` 报名人员摘要中展示成行人数和最多人数。
- 验证通过：`bun run type-check`、`bun run build`。
