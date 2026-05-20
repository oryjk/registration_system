# 管理端进度记录

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
