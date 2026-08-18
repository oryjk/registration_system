# 球队入队密码修改设计（小程序队长端 + 管理端重置）

- 日期：2026-08-18
- 状态：已与需求方确认（方案 A：独立端点；权限沿用队长+领队；小程序 + Go 管理端两端口）
- 涉及：`registration_system_go`、`registration_system_mini`、`registration_system_backend_fe_go`
- 明确不涉及：`registration_system_admin_app`（Flutter，本次不做任何修改）

## 背景与问题

- 入队密码当前只能在建队时设置一次（`POST /api/v1/app/teams` 的 `join_password`，bcrypt 存 `teams.join_password_hash`，迁移 `00015`）。
- 后端自服务接口（`app_self_handler.go`）只有创建/加入/搜索/查密码状态四个端点，没有任何修改或清除入队密码的途径；队长想换密码或改为开放加入，现阶段无解。

## 目标

1. 小程序：队长/领队在球队管理页可设置、更换、清除入队密码。
2. Go 管理端：球队列表提供「重置入队密码」，运营可代为设置或清除。
3. 语义统一：请求体 `join_password` **非空 = 设置/替换；空串 = 清除（开放加入）**，与建队时"留空不设密码"口径一致，无三态歧义。

## 非目标（明确不做）

- 不改数据库结构（`teams.join_password_hash` 列已存在，无需迁移）。
- 不做旧密码验证（操作者已通过队长/领队或管理员鉴权）。
- 不做密码强度策略（与建队口径一致，trim 后非空即接受；如后续要加长度限制，建队与修改两处同步加）。
- 不触碰 Flutter 移动管理 App。

## API 契约

- 小程序侧 `PUT /api/v1/app/teams/:id/join-password`：
  - 请求体 `{ "join_password": "string" }`（trim 后非空=设置，空串=清除）。
  - 鉴权：登录用户且为该球队队长或领队（复用 `authorizeManager`）。
- 管理侧 `PUT /api/v1/admin/teams/:id/join-password`：
  - 请求体同上；鉴权：管理员（`actor.IsAdmin()`）。
- 两者成功均返回空对象 `ApiResponse<{}>`；错误口径：球队不存在 404、无权限 403、body 不合法 400、哈希失败 500。
- trim 语义对齐建队现状（`app_team_self_service.go`）：`TrimSpace` 仅用于判空，**哈希/清除以原始值为准**（建队即如此，两处保持一致；若未来统一改为 trim 后哈希，建队与修改需同步调整）。
- 密码明文不落库、不返回、不写日志；任何时候接口都不回显哈希。
- `docs/openapi.yaml` 补两个端点定义；`openapi_test.go` 中硬编码的 documented operations 数量（现为 69）需同步 +2，否则校验失败。

## Go 后端设计

分层沿用既有六边形结构，行为对齐 `AppManageService` 既有写操作模式：

- **sqlc 查询**（`db/queries/team.sql`）：
  `-- name: UpdateTeamJoinPasswordHash :one`
  `UPDATE teams SET join_password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING teams.id;`
  不存在时 `ErrNoRows` → service 映射 404。
- **仓储端口**：`ports.AppManageRepository` 与 admin 侧 `ports.Repository` 均新增
  `UpdateJoinPasswordHash(ctx, teamID int64, hash *string) (bool, error)`（`*string`，nil=清除；返回 found bool，false=球队不存在 → service 映射 404，对齐 `UpdateMember`/`FindJoinPasswordHash` 的既有 bool 风格而非透传 `ErrNoRows`），由 `adapters/postgres.Repository` 一并实现（两接口本就同一实现）。
- **应用服务**：
  - `AppManageService.UpdateJoinPassword(ctx, actor, teamID, joinPassword string)`：`authorizeManager` → trim → 非空经 `ports.TeamPasswordHasher` 哈希 / 空传 nil → 调仓储。构造函数 `NewAppManageService` 增加 hasher 参数（bootstrap、既有测试同步改）。
  - `QueryService.UpdateJoinPassword(ctx, actor, teamID, joinPassword string)`（admin 用）：`actor.IsAdmin()` 校验 → 同样的 trim/哈希/落库。构造函数 `NewQueryService` 增加 hasher 参数。
  - 两个 service 各自做鉴权（口径不同），哈希与落库逻辑共用仓储方法；刻意不为这一个用例引入第三个共享 service。
- **HTTP**：
  - `app_manage_handler.go`：`group.PUT("/teams/:id/join-password", h.UpdateJoinPassword)`，`AppTeamManageCommands` 接口加方法。
  - `handler.go`（admin）：`group.PUT("/teams/:id/join-password", h.AdminUpdateJoinPassword)`；handler 依赖的 `TeamQuery` 接口同步加 `UpdateJoinPassword` 方法。

## 小程序设计（registration_system_mini）

- `src/api/team.ts`：新增 `updateTeamJoinPassword(teamId: number, password: string)`（空串=清除）。
- 新组件 `src/pages/teams/manage/components/TeamJoinPasswordPanel.vue`：
  - 挂载时调既有 `getTeamPasswordInfo(teamId)` 显示当前状态（「已设置入队密码」/「开放加入，无需密码」）。
  - 「新密码」输入框（password 类型）+ 保存按钮（设置/替换，提交成功后刷新状态并清空输入）。
  - 当前已设密码时展示「清除密码」按钮，`uni.showModal` 二次确认后提交空串。
- 新 composable `src/pages/teams/manage/useTeamJoinPassword.ts`（对齐 `useTeamProfile.ts` 模式），页面 `index.vue` 装配；面板仅队长/领队可见（复用现有 `canManageMembers` 判定），置于「当前球队资料」面板之后。

## Go 管理端设计（registration_system_backend_fe_go）

- `src/api/teams.ts`：新增 `resetTeamJoinPassword(teamID: number, password: string)`。
- `src/pages/TeamListPage.tsx`：操作列新增「重置入队密码」按钮（Tooltip 图标按钮，与"编辑球队"并排），弹小 `ModalForm`：新密码输入框 + 提示文案「留空提交即清除密码，开放加入」；成功后 message 提示。

## 测试与验证

- Go（TDD）：
  - service 层单测：权限（非队长/领队 403、非管理员 403）、设置（调用 hasher、落库非 nil）、清除（落库 nil）、球队不存在 404、trim 语义。
  - handler 层测试：两套路由的参数解析、body 校验、响应格式。
  - postgres repository 集成测试（`testsupport` 独立 schema）：设置后 `FindJoinPasswordHash` 可验、清除后为 nil、不存在球队报错。
  - openapi 测试。
  - 提交前：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build ./cmd/api`。
- 小程序：`bun run type-check`、必要时 `build:mp-weixin`；纯 UI + 既有 API 封装模式，按仓库前端测试策略不新增单测。
- 管理端：`bun run type-check`、`bun run lint`、`bun run build`。
- 发布顺序：Go 后端先行（新端点向后兼容，不影响旧版本小程序）→ 管理端与小程序随后各自发版。

## 风险与备注

- 清除密码即开放加入，误触风险由二次确认（小程序）与留空提示（管理端）缓解；管理端操作有管理员鉴权兜底。
- 修改密码不影响已在队成员，只影响后续加入者，无联动状态需要处理。
- `NewQueryService` / `NewAppManageService` 构造签名变更会影响既有测试构造处，属机械修改，注意 `go vet`/测试全绿。
