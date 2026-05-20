# 管理端发现记录

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
