# Go 配套小程序协作指南

修改前先读根目录和当前目录的 `AGENTS.md`、`CLAUDE.md`。

## 推荐定位顺序

1. 回查 `../registration_system_go/internal/*/adapters/http` 的真实 handler 和 DTO
2. 更新 `src/types/` 与 `src/api/`
3. 更新 `src/stores/` 的会话或业务编排
4. 最后修改页面与组件

## 特别注意

- H5 不模拟微信授权凭证；H5 只验证未登录态、已缓存会话态、网络错误和响应式布局。
- Match HTTP 路由落地前，不创建猜测性的比赛列表或发布请求。
- 不复制旧小程序的旧后端 `{ success, message, data }` 契约。
