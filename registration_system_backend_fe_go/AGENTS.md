# registration_system_backend_fe_go - AGENTS

## 项目定位

对接 `../registration_system_go/` 的新管理后台。技术栈为 Umi Max 4.6.51、React、TypeScript、Ant Design 6、ProComponents 3、React Query 5、Tailwind 4、antd-style、Biome、utoopack、Node 20+ 和 Bun。

旧版 `../registration_system_backend_fe/` 只作为业务参考；接口、DTO、权限和响应结构以 Go 后端为准。

## 推荐定位顺序

1. 回查 `../registration_system_go/internal/*/adapters/http` 的真实管理端 handler。
2. 更新 `src/types/` 与 `src/api/`。
3. 更新目标页面和路由。
4. 执行类型检查、lint、构建和浏览器验证。

## 边界

- Go 统一响应为 `{ code, message, data }`，成功时 `code = 0`。
- 管理端业务接口统一从 `/api/v1/admin` 开始；健康检查位于 `/health`。
- Go 尚未实现的管理端 handler 不在前端臆造请求和 DTO；**管理员认证 HTTP 路由落地前，不创建猜测性的登录请求**。
- 不沿用旧 Vue 管理端的 `{ success, message, data }` 假设。
- 页面放在 `src/pages/`，请求放在 `src/api/`，布局放在 `src/components/`。
- 直接从 Ant Design 和 `@ant-design/icons` 导入所需组件，不手绘 SVG 图标，页面保持职责清晰。
- 页面、菜单和访问控制通过 Umi `config/routes.ts` 与 `access` 配置维护；按需页面加载由 Umi 处理，新增路由必须同步定义权限边界。

## 常用命令

```bash
bun install
bun run dev
bun run type-check
bun run lint
bun run build
```

## 验证

提交前执行 `bun run type-check`、`bun run lint` 和 `bun run build`。页面变更通过桌面与移动视口人工或截图验证。

<!-- antd-cli setup start -->
## Ant Design CLI Skill

Use the shared Ant Design skill at `.agents/skills/antd/SKILL.md` before working on Ant Design code in this repository.

The skill teaches agents when and how to call `@ant-design/cli` commands such as `antd info`, `antd doc`, `antd demo`, `antd token`, `antd semantic`, and `antd changelog`.

<!-- antd-cli setup end -->
