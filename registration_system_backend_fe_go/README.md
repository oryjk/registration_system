# registration_system_backend_fe_go

与 `registration_system_go` 同步演进的 React 管理后台。

## 开发

```bash
bun install
cp .env.example .env.development
bun run dev
```

开发服务器默认监听 `0.0.0.0`，可通过本机或局域网 IP 访问，并通过同源 `/go-api` 代理到 `http://127.0.0.1:18080`；生产构建通过 `VITE_API_BASE_URL` 指定服务地址。当前 Go 服务只装配了健康检查，管理端先提供真实的服务状态工作台；管理 API 页面随 Go handler 增量接入。

## 验证

```bash
bun run type-check
bun run lint
bun run build
```
