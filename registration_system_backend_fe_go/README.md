# registration_system_backend_fe_go

与 `registration_system_go` 同步演进的 React 管理后台。

## 开发

```bash
bun install
cp .env.example .env.development
bun run dev
```

开发服务器默认监听 `0.0.0.0`，可通过本机或局域网 IP 访问，并通过同源 `/go-api` 代理到 `VITE_API_PROXY_TARGET`（默认 `http://127.0.0.1:18080`）；生产构建通过 `VITE_API_BASE_URL` 指定服务地址。管理端已接入管理员认证、球队 CRUD、比赛和场馆管理员 API；普通场馆管理员可以管理球队以及发布、管理和取消比赛，发布时可确认并快速创建不存在的主队。只有超级管理员显示场馆管理员入口和比赛永久删除操作。

## 验证

```bash
bun run type-check
bun run lint
bun run build
```
