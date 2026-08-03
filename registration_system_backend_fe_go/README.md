# registration_system_backend_fe_go

与 `registration_system_go` 同步演进的 React 管理后台。

## 开发

```bash
bun install
cp .env.example .env.development
bun run dev
```

开发服务器默认监听 `0.0.0.0`，可通过本机或局域网 IP 访问。开发时 `ADMIN_API_BASE_URL=/go-api`，Umi 将同源 `/go-api` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:18080`）；生产构建不设 API base，浏览器直接请求同源 `/api/admin/*` 和 `/health`。管理端已接入管理员认证、球队 CRUD、比赛和场馆管理员 API；普通场馆管理员可以管理球队以及发布、管理和取消比赛，发布时可确认并快速创建不存在的主队。只有超级管理员显示场馆管理员入口和比赛永久删除操作。

## 构建与部署

默认 `bun run build` 使用路由根路径 `/`。部署到 `/registration-admin/` 时执行 `bun run build:nginx`，它会同时设置 `ADMIN_PUBLIC_PATH` 与 `ADMIN_ROUTE_BASE` 为 `/registration-admin/`。Nginx 必须为该路由基址提供 SPA fallback，并将同源 API 代理到 Go 后端：

```nginx
location /registration-admin/ {
  try_files $uri $uri/ /registration-admin/index.html;
}

location /api/ {
  proxy_pass http://127.0.0.1:18080;
}

location = /health {
  proxy_pass http://127.0.0.1:18080/health;
}
```

## 验证

```bash
bun run type-check
bun run lint
bun run build
```
