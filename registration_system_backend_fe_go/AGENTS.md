# registration_system_backend_fe_go - AGENTS

## 项目定位

对接 `../registration_system_go/` 的新管理后台。技术栈为 React、TypeScript、Vite、Ant Design 和 Bun。

旧版 `../registration_system_backend_fe/` 只作为业务参考；接口、DTO、权限和响应结构以 Go 后端为准。

## 边界

- Go 统一响应为 `{ code, message, data }`，成功时 `code = 0`。
- 管理端业务接口统一从 `/api/admin` 开始；健康检查位于 `/health`。
- Go 尚未实现的管理端 handler 不在前端臆造请求和 DTO。
- 页面放在 `src/pages/`，请求放在 `src/api/`，布局放在 `src/components/`。
- 使用 Ant Design 组件与 `@ant-design/icons`，不手绘 SVG 图标。
- 页面通过 React Router 懒加载，避免无关页面进入首包。

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
