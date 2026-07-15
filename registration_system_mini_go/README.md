# registration_system_mini_go

与 `registration_system_go` 同步演进的 uni-app 用户端，支持微信小程序和 H5。

## 开发

```bash
bun install
cp .env.example .env.development
bun run dev:h5
```

H5 开发服务器通过同源 `/go-api` 代理到 `http://127.0.0.1:18080`；生产构建通过 `VITE_API_BASE_URL` 指定服务地址。真实微信登录需在微信开发者工具或真机中执行。

## 构建

```bash
bun run type-check
bun run build:h5
bun run build:mp-weixin
```
