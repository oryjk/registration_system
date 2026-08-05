# registration_system_mini_go - AGENTS

## 项目定位

对接 `../registration_system_go/` 的新用户端。使用 uni-app、Vue 3、TypeScript、Vite 和 Bun，同时产出微信小程序与 H5。

旧版 `../registration_system_mini/` 仅作为交互与视觉参考；接口、DTO 和登录流程必须以 Go 后端代码为准。

## 推荐定位顺序

1. 回查 `../registration_system_go/internal/*/adapters/http` 的真实 handler 和 DTO。
2. 更新 `src/types/` 与 `src/api/`。
3. 更新 `src/stores/` 的会话或业务编排。
4. 最后修改页面与组件。

## 边界

- Go 统一响应为 `{ code, message, data }`，成功时 `code = 0`。
- 用户接口挂在 `/api` 下；健康检查位于 `/health`。
- 不为尚未存在的 Go HTTP handler 臆造前端接口；**Match HTTP 路由落地前，不创建猜测性的比赛列表或发布请求**。
- 不复制旧小程序旧后端的 `{ success, message, data }` 契约。
- 页面只做编排；请求放在 `src/api/`，共享状态放在 `src/stores/`，DTO 放在 `src/types/`。
- H5 是日常布局和交互验证入口，微信登录只在微信小程序环境执行。
- **H5 不模拟微信授权凭证**；H5 只验证未登录态、已缓存会话态、网络错误和响应式布局。

## 常用命令

```bash
bun install
bun run dev:h5
bun run build:h5
bun run dev:mp-weixin
bun run build:mp-weixin
bun run type-check
```

## 验证

普通改动至少执行 `bun run type-check` 和 `bun run build:h5`。涉及微信平台配置或条件编译时补跑 `bun run build:mp-weixin`。
