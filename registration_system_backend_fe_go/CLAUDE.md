# Go 配套 React 管理端协作指南

修改前先读根目录和当前目录的 `AGENTS.md`、`CLAUDE.md`。

## 推荐定位顺序

1. 回查 `../registration_system_go/internal/*/adapters/http` 的真实管理端 handler
2. 更新 `src/types/` 与 `src/api/`
3. 更新目标页面和路由
4. 执行类型检查、lint、构建和浏览器验证

## 特别注意

- 不沿用旧 Vue 管理端的 `{ success, message, data }` 假设。
- 管理员认证 HTTP 路由落地前，不创建猜测性的登录请求。
- 直接从 Ant Design 和 icons 包导入所需组件，页面保持职责清晰。
