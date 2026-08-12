# 比赛详情报名人员展示设计

## 目标

修复 H5/小程序比赛详情中报名人数正确但报名人员头像列表缺失的问题，使当前选中的报名组能够返回并展示已报名人员头像。

## 方案

复用 Go 后端已有的报名组花名册查询能力，在用户端 GET /matches/:id 的每个 groups[] 元素中增加 participants[]。每个参与人员只返回 user_id、nickname、avatar_url、status。

球队组查询读取球队成员，散人组查询读取已有报名记录，应用层只保留 status=attending 的成员。人数统计仍以 attending_count 为权威值，头像按用户显示，不按 registration_count 展开。

前端把 participants 转换为现有 BackendRegistration 与 BackendUser 视图模型，继续复用 participantPreview 和 NeoAvatarStack。兼容旧接口时，缺失 participants 按空数组处理。

## 隐私边界

用户端不返回 real_name、member_role、未报名成员或管理端 DTO 字段。当前组没有参加人员时返回空数组，前端继续显示人数和空状态文案。

## 验证

- Go HTTP 用户详情测试断言 participants 输出且不泄漏管理端字段。
- Go 查询层测试覆盖参加人员筛选及头像字段映射。
- 小程序详情适配测试断言参加人员转换成头像数据，非参加状态被排除。
- 运行 bun test、bun run type-check、bun run build:h5:acceptance、bun run build:mp-weixin，以及 Go 的 go test -race ./...、go vet ./... 和构建命令。
