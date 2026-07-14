# Findings

## 2026-07-14 项目初始化

- 新后端模块路径为 `github.com/oryjk/registration_system/registration_system_go`。
- 当前机器是 macOS 26.4；旧 `/usr/local/go` 1.22.3 生成的测试二进制缺少 `LC_UUID`，会被 dyld 在启动前拒绝。
- Go 1.26.5 生成的测试二进制包含 `LC_UUID`，可以正常运行，因此项目最低版本固定为 Go 1.26.5。
- 用户 Go 环境的 `GOSUMDB=sum.golang.google.cn` 与当前模块代理不匹配；Makefile 仅对项目命令导出标准 `sum.golang.org`，不修改用户全局 Go 配置。
- `go build ./cmd/api` 会在项目根生成名为 `api` 的本地二进制；项目统一使用 `-o /tmp/registration-system-go-api`。
- Rust 后端目录在初始化期间保持零 diff。
