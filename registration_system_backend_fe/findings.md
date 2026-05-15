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
