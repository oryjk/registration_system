# Progress

## 2026-07-14

- 已建立 `codex/go-match-backend` 隔离 worktree。
- 已完成健康路由 TDD 红灯：失败原因为 `NewRouter` 和 `Dependencies` 不存在。
- 已实现 Gin 最小路由、标准响应 envelope、配置加载和进程入口。
- 已新增 Go 子项目协作文档、本地运行说明和质量门命令。
- 已定位并解决 macOS 26 与旧 Go 1.22.3 工具链不兼容问题，项目改用 Go 1.26.5。
- 验证通过：`make verify`。
- Task 1 验证通过：`make verify`、`go test -race ./...`、`git diff --check`。
- 已确认 `registration_system_rs/` 在 Task 1 保持零 diff。
- 下一步：编写 PostgreSQL schema contract 红灯测试。
- 已在 `local233` 创建独立 PostgreSQL 16 容器和空库 `registration_system_go`，确认本机外部连接可用且 public schema 表数量为 0。
- 已完成 schema contract 红绿循环：红灯为 migration 目录不存在，绿灯为 8 张核心 Match 聚合表与约束存在。
- 已固定 sqlc v1.31.1，生成 auth/team/match/system 四个持久化 adapter 类型包。
- 已在远程开发库应用 goose version 1；核对为 9 张业务表、1 张 goose 版本表。
- Task 2 验证通过：schema 专项测试、`go test ./...`、`go vet ./...`、`git diff --check`。
- 已完成 JWT TDD：用户/超级管理员 Actor 往返和错误签名拒绝测试通过。
- 已完成 Gin auth middleware TDD：用户/管理员路由隔离、缺失 Token 401 和 Actor context 测试通过。
- Task 3 验证通过：`go test -race ./internal/auth/... ./internal/shared/...`、`go vet ./...`。
- 已完成微信登录 use case、真实 jscode2session gateway、用户 sqlc repository 和登录 HTTP adapter。
- 已完成球队最小领域、captain/leader 权限检查、球队 sqlc repository 和“我的球队” HTTP adapter。
- Task 4 验证通过：auth/user/team 全部专项测试、PostgreSQL 容器测试、`go test -race`、`go vet ./...`。
- 已完成 Match domain TDD：三种发布模式、初始报名组、散人默认 8/10、对手名称/坐标/时间不变量测试通过。
- 已完成 Match 创建用例与 PostgreSQL 事务仓储：创建 Match 和初始报名组原子提交，任一报名组写入失败时整体回滚。
