# 管理端任务计划

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
