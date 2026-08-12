# 比赛详情报名人员展示 Implementation Plan

> For agentic workers: use superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: 返回并展示 Go 比赛详情当前报名组的已报名人员头像，使头像列表与报名人数来源一致。

Architecture: Go repository 在已有 FindForUser 详情查询中复用报名组花名册查询，application port 传递最小用户参与者模型，HTTP handler 只映射用户端允许的字段。小程序适配层把参与者转换成现有报名记录和用户头像索引，页面组件继续复用 NeoAvatarStack。

Tech Stack: Go、Gin、PostgreSQL/pgx/sqlc、uni-app Vue 3、TypeScript、Bun test。

## Global Constraints

- 不修改 Rust 旧后端。
- 不新增比赛详情请求；复用 GET /matches/:id。
- 用户端不返回 real_name、member_role、未报名成员或管理端 DTO 字段。
- 报名人数以 attending_count 为容量统计依据；头像按用户显示，不按 registration_count 展开。
- 修改完成后验证 H5 与微信小程序构建。

## Task 1: 用户详情接口契约

Files: modify registration_system_go/internal/match/ports/repository.go, registration_system_go/internal/match/adapters/http/user_handler.go, registration_system_go/internal/match/adapters/http/user_handler_test.go.

1. 先在 TestUserMatchRoutesReturnPrivacyScopedData 中加入一个 attending participant，并断言响应包含 participants、user_id、nickname、avatar_url、status，同时保留 real_name 等字段不泄漏的断言。
2. 运行 cd registration_system_go && go test ./internal/match/adapters/http -run TestUserMatchRoutesReturnPrivacyScopedData -count=1，确认先因缺少 participants 字段失败。
3. 增加 ports.UserParticipant、UserGroupState.Participants、UserParticipantResponse 和 UserGroupResponse.Participants，并在 mapUserDetail 中完成映射。
4. 重跑同一测试，确认通过。

## Task 2: 后端读取报名人员

Files: modify registration_system_go/internal/match/adapters/postgres/repository.go and its repository tests.

1. 增加一个 repository 测试 fixture，包含两个 attending、一个 leave 以及一个未报名球队成员，断言 FindForUser 只返回两个 attending 用户及头像字段。
2. 运行 cd registration_system_go && go test ./internal/match/adapters/postgres -run TestRepositoryFindForUserIncludesAttendingParticipants -count=1，确认先失败。
3. 在 FindForUser 中复用已有 ListRosterForGroup 查询，通过小型 helper 转成 ports.UserParticipant 并过滤 attending，不重复编写 SQL。
4. 重跑 focused repository test，确认通过。

## Task 3: 小程序适配

Files: modify registration_system_mini/src/types/match.ts, registration_system_mini/src/pages/matches/detailData.ts and its detailData tests.

1. 增加两个 attending 和一个 leave participant 的详情 fixture，断言 buildGoPublicMatchDetailData 生成两条 activityUsers，并保留 usersById 的昵称和头像。
2. 运行 cd registration_system_mini && bun test src/pages/matches/__tests__/detailData.test.ts -t 'maps Go participants into the existing avatar model'，确认先失败。
3. 增加 AppMatchParticipant 类型，将 attending participant 映射为 BackendRegistration 和 BackendUser，避免当前用户重复。
4. 重跑 focused test，确认通过。

## Task 4: 全量验证与集成

1. 运行 Go match tests、mini bun test、bun run type-check。
2. 运行 bun run build:h5:acceptance 和 bun run build:mp-weixin。
3. 刷新登录后的 H5 比赛详情，确认报名人数和头像列表一致，且无控制台错误或框架错误覆盖层。
4. 运行 gofmt、go test -race ./...、go vet ./...、go build -o /tmp/registration-system-go-api ./cmd/api。
5. 只暂存本次设计、计划和代码文件，确认 .zcode/ 不在暂存区，提交 fix(match): show registered participant avatars，然后 push origin main。
