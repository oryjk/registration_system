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
