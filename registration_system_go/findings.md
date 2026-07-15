# Findings

## 2026-07-14 项目初始化

- 新后端模块路径为 `github.com/oryjk/registration_system/registration_system_go`。
- 当前机器是 macOS 26.4；旧 `/usr/local/go` 1.22.3 生成的测试二进制缺少 `LC_UUID`，会被 dyld 在启动前拒绝。
- Go 1.26.5 生成的测试二进制包含 `LC_UUID`，可以正常运行，因此项目最低版本固定为 Go 1.26.5。
- 用户 Go 环境的 `GOSUMDB=sum.golang.google.cn` 与当前模块代理不匹配；Makefile 仅对项目命令导出标准 `sum.golang.org`，不修改用户全局 Go 配置。
- `go build ./cmd/api` 会在项目根生成名为 `api` 的本地二进制；项目统一使用 `-o /tmp/registration-system-go-api`。
- Rust 后端目录在初始化期间保持零 diff。

## 2026-07-14 新数据库

- 新 Go 开发库位于 `local233` 的独立 `registration-system-go-postgres` 容器，库名为 `registration_system_go`。
- 容器使用 PostgreSQL 16，映射宿主机 5432，数据持久化在 `/opt/data/registration-system-go`。
- 本机已经通过外部地址验证连接，初始 public schema 没有业务表。
- 连接凭据只用于本地环境，不写入仓库；集成测试继续使用 testcontainers 隔离数据库。

## 2026-07-15 管理端比赛闭环

- 开发运行拓扑固定为本机 Go 进程连接 `127.0.0.1:5432` 的 PostgreSQL 容器；Go 服务和前端不容器化。
- migration version 1 已应用，当前 `admin_users`、`users`、`teams`、`matches` 均为空。
- `matches.created_by_user_id` 当前为非空，管理员创建比赛需要新增管理员创建来源并保持两种创建者互斥。
- 管理比赛采用状态取消，不物理删除 Match 聚合数据。
