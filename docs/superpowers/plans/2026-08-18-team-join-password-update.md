# 球队入队密码修改 Implementation Plan

> **For agentic workers:** 按 Task 顺序逐个实现，每个 Task 内先写失败测试再实现（后端 TDD）。步骤使用 checkbox（`- [ ]`）跟踪。

**Goal:** 队长/领队可在小程序设置、更换、清除球队入队密码；Go 管理端可代为重置/清除。语义统一：`join_password` 非空=设置/替换，空串=清除（开放加入）。

**Architecture:** 不改表结构（复用 `teams.join_password_hash`，迁移 `00015`）。Go 新增两个独立 PUT 端点（app/manage 链路 + admin 链路），共用同一 sqlc 查询与仓储方法，哈希复用 `ports.TeamPasswordHasher`（bcrypt）。小程序加独立面板组件 + composable；管理端加行操作 + ModalForm。

**Tech Stack:** Go + Gin + pgx + sqlc + goose；React + TS + Ant Design 5 + pro-components + Bun；uni-app + Vue 3 + TS。

**Spec:** `docs/superpowers/specs/2026-08-18-team-join-password-update-design.md`

## Global Constraints

- 工作区有其他未跟踪文件（`docs/tabbar-neo-preview.*`）。每次提交只 `git add` 本任务明确列出的文件，禁止 `git add -A` / `git add .`。
- 不修改 `registration_system_rs/`（冻结）与 `registration_system_admin_app/`（Flutter，本次明确不动）。
- 密码明文不落库、不返回、不写日志；trim 语义对齐建队现状：`TrimSpace` 仅判空，哈希/清除以原始值为准。
- PostgreSQL 集成测试只认显式 `TEST_DATABASE_URL`，未设置自动 skip。
- 提交信息用英文 conventional 风格：`feat(go): ...`、`feat(mini): ...`、`feat(admin): ...`。
- Go 验证命令：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build -o /tmp/registration-system-go-api ./cmd/api`（模块代理用 Makefile 内置配置，`make verify` 可一键）。

---

### Task 1: Go 仓储层 — sqlc 查询 + 端口 + postgres 实现 + 集成测试

**Files:**
- Modify: `registration_system_go/db/queries/team.sql`
- Generate: `registration_system_go/internal/team/adapters/postgres/sqlc/team.sql.go`（`make generate`）
- Modify: `registration_system_go/internal/team/ports/app_manage.go`、`internal/team/ports/repository.go`
- Modify: `registration_system_go/internal/team/adapters/postgres/repository.go`
- Test: `registration_system_go/internal/team/adapters/postgres/repository_test.go`（追加）

**Interfaces（后续任务依赖的精确签名）:**
- `ports.AppManageRepository` / `ports.Repository` 新增：
  `UpdateJoinPasswordHash(ctx context.Context, teamID int64, hash *string) (bool, error)` — 返回 found；false=球队不存在。
- sqlc：`-- name: UpdateTeamJoinPasswordHash :one` → `UPDATE teams SET join_password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING teams.id;`

- [x] Step 1: `team.sql` 追加查询（放在既有 join_password 相关查询附近），`make generate` 重新生成 sqlc。
- [x] Step 2: 两个端口接口追加方法；`adapters/postgres/repository.go` 实现（`sqlc.ErrNoRows` → `(false, nil)`，其余错误包 `KindInternal` 风格返回）。注意：两个端口方法同名同签名，同一 `Repository` 满足。
- [x] Step 3: 集成测试（`testsupport` 独立 schema、`TEST_DATABASE_URL` 未设自动 skip，复用文件内既有 `CreateWithCaptain`/`FindJoinPasswordHash` 测试先例）：设置→`FindJoinPasswordHash` 返回哈希；清除（nil）→返回 nil、found=true；不存在球队→`(false, nil)`。
- [x] Step 4: `go test ./internal/team/...`（集成用例无 DB 时 skip，不挂）。

### Task 2: Go App 侧 — AppManageService.UpdateJoinPassword + 路由

**Files:**
- Modify: `registration_system_go/internal/team/application/app_manage_service.go`
- Test: `registration_system_go/internal/team/application/app_manage_service_test.go`（追加；`NewAppManageService` 现有调用点补 hasher 参数，用文件内新增 `fakePasswordHasher`）
- Modify: `registration_system_go/internal/team/adapters/http/app_manage_handler.go`
- Test: `registration_system_go/internal/team/adapters/http/app_manage_handler_test.go`（追加；`fakeAppManageCommands` 补方法）
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`（`NewAppManageService(teamRepository, teampassword.Bcrypt{})`，import 已存在）

**Interfaces:**
- `NewAppManageService(repository ports.AppManageRepository, hasher ports.TeamPasswordHasher) AppManageService`
- `AppTeamManageCommands` 新增：`UpdateJoinPassword(context.Context, sharedauth.Actor, int64, string) error`
- 路由：`group.PUT("/teams/:id/join-password", h.UpdateJoinPassword)`；请求体 `{"join_password": string}`；成功 `WriteSuccess(c, gin.H{})`。

**Service 行为（TDD 先写失败测试）:**
- `authorizeManager` 失败原样返回（404/403）。
- `joinPassword` trim 后非空：`hasher.Hash(原始值)` → 仓储 `UpdateJoinPasswordHash(ctx, teamID, &hash)`；trim 后为空：传 `nil`（清除）。
- 仓储 found=false → `KindNotFound "球队不存在"`；仓储错误 → `KindInternal "更新入队密码失败"`；哈希错误 → `KindInternal "加密入队密码失败"`。

**测试用例:**
- service：非队长/领队 403；球队不存在 404；设置（断言 hasher 收到原始值、仓储收到非 nil hash）；空串/纯空格（断言仓储收到 nil）；仓储 not found → 404。
- handler：合法 body 200 `ApiResponse{}`；坏 body 400；service 错误透传。

- [x] Step 1: 写 service 失败测试 → 实现通过。
- [x] Step 2: 写 handler 失败测试 → 实现通过。
- [x] Step 3: bootstrap 接线，`go test ./internal/team/... ./internal/bootstrap/...`。

### Task 3: Go Admin 侧 — QueryService.UpdateJoinPassword + 路由

**Files:**
- Modify: `registration_system_go/internal/team/application/query_service.go`
- Test: `registration_system_go/internal/team/application/query_service_test.go`（追加；既有 `NewQueryService(repository)` 调用点补 hasher，bootstrap 同步）
- Modify: `registration_system_go/internal/team/adapters/http/handler.go`
- Test: `registration_system_go/internal/team/adapters/http/handler_test.go`（追加；`TeamQuery` 的测试 fake 补方法）
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`（`NewQueryService(teamRepository, teampassword.Bcrypt{})`）

**Interfaces:**
- `NewQueryService(repository ports.Repository, hasher ports.TeamPasswordHasher) QueryService`
- `TeamQuery` 新增：`UpdateJoinPassword(context.Context, sharedauth.Actor, int64, string) error`
- 路由：admin `group.PUT("/teams/:id/join-password", h.AdminUpdateJoinPassword)`；请求体/响应与 App 侧一致。

**Service 行为:** `actor.IsAdmin()` 否则 403 → 球队不存在 404（仓储 found=false）→ trim/哈希/落库同 Task 2 语义。

**测试用例:**
- service：非管理员 403；不存在 404；设置/清除/哈希错误，同 Task 2。
- handler：路由命中、鉴权透传、响应格式。

- [x] Step 1: 写 service 失败测试 → 实现通过。
- [x] Step 2: 写 handler 失败测试 → 实现通过。
- [x] Step 3: bootstrap 接线与既有测试调用点修补，`go test ./internal/team/... ./internal/bootstrap/...`。

### Task 4: openapi 文档 + 计数

**Files:**
- Modify: `registration_system_go/docs/openapi.yaml`
- Modify: `registration_system_go/docs/openapi_test.go`（`documented operations` 断言 69 → 71）

- [x] Step 1: 按文件内既有 app/admin 球队端点模式补两个 `PUT /teams/{id}/join-password` 定义（requestBody: `join_password: string`，responses 200/400/401/403/404）。
- [x] Step 2: 计数 69 → 71，`go test ./docs/`。

### Task 5: 小程序 — API + composable + 面板

**Files:**
- Modify: `registration_system_mini/src/api/team.ts`（新增 `updateTeamJoinPassword(teamId: number, password: string)`，`PUT /teams/${teamId}/join-password`，body `{ join_password: password }`，auth: true）
- Create: `registration_system_mini/src/pages/teams/manage/useTeamJoinPassword.ts`
- Create: `registration_system_mini/src/pages/teams/manage/components/TeamJoinPasswordPanel.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/index.vue`（装配，置于 TeamProfilePanel 之后；仅 `canManageMembers` 时渲染）

**行为:**
- composable（对齐 `useTeamProfile.ts` 模式）：暴露 `requiresPassword: Ref<boolean>`、`passwordForm reactive({ password: "" })`、`canSubmit`、`syncJoinPasswordStatus()`（调既有 `getTeamPasswordInfo`）、`handleUpdateJoinPassword()`、`handleClearJoinPassword()`（`uni.showModal` 二次确认后提交空串）。
- 面板：状态徽标（「已设置入队密码」/「开放加入，无需密码」）+ password 输入框 + 保存按钮 + （已设密码时）清除按钮；成功后刷新状态、清空输入；错误 toast `error.message`。
- [x] Step 1: api + composable + 组件 + 页面装配。
- [x] Step 2: `bun run type-check`。

### Task 6: Go 管理端 — 重置入口

**Files:**
- Modify: `registration_system_backend_fe_go/src/api/teams.ts`（新增 `resetTeamJoinPassword(teamID: number, password: string)` → `PUT /teams/${teamID}/join-password`）
- Modify: `registration_system_backend_fe_go/src/hooks/queries/useTeamQueries.ts`（新增 `useResetTeamJoinPasswordMutation`，成功后 `message.success`，不 invalidate 列表——密码不进列表数据）
- Modify: `registration_system_backend_fe_go/src/pages/TeamListPage.tsx`（操作列加「重置入队密码」圆形图标按钮（KeyOutlined），弹 `ModalForm`：password 输入框 + 说明文案「留空提交即清除密码，开放加入」）

- [x] Step 1: api + mutation + 页面入口。
- [x] Step 2: `bun run type-check`、`bun run lint`、`bun run build`。

### Task 7: 全量验证与提交

- [x] `cd registration_system_go && gofmt -w . && go test -race ./... && go vet ./... && go build -o /tmp/registration-system-go-api ./cmd/api`
- [x] 小程序 `bun run type-check`；管理端 `bun run type-check`、`lint`、`build` 复跑确认。
- [x] 分批提交（只 add 各任务文件）：`feat(go): app and admin endpoints to update team join password`（T1–T4，已提交 96c59c8）、`feat(admin): reset team join password action`（T6，已提交 6dc43d6）。T5 小程序改动因工作区存在另一会话的未提交改动（teams/manage 共享文件），暂不提交，待用户确认后处理。

## 风险与备注

- `NewQueryService`/`NewAppManageService` 构造签名变更波及约 24 处测试调用点，属机械修改；改完以 `go test ./...` 全绿确认无遗漏。
- 新端点对旧版本小程序向后兼容（纯新增路由），发布顺序：Go → 管理端/小程序各自发版，无 DB 迁移。
- 集成测试本机无 `TEST_DATABASE_URL` 时自动 skip；如需跑真库，用 `registration_system_go` 的 testsupport 基建。
