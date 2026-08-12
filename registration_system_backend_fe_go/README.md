# registration_system_backend_fe_go

与 `registration_system_go` 同步演进的 React 管理后台。

## 开发

```bash
bun install
cp .env.example .env.development
bun run dev
```

开发服务器默认监听 `0.0.0.0`，可通过本机或局域网 IP 访问。开发时 `ADMIN_API_BASE_URL=/go-api`，Umi 将同源 `/go-api` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:18080`）；生产构建不设 API base，浏览器直接请求同源 `/api/v1/admin/*` 和 `/health`。管理端已接入管理员认证、球队 CRUD、比赛和场馆管理员 API；普通场馆管理员可以管理球队以及发布、管理和取消比赛，发布时可确认并快速创建不存在的主队。只有超级管理员显示场馆管理员入口和比赛永久删除操作。

开发和生产脚本设置 `BABEL_POLYFILL=none`，遵循 Ant Design 6 的现代浏览器支持范围，不再注入 Umi 默认的完整 core-js 入口。需要支持现代浏览器范围以外的旧环境时，应先恢复对应 polyfill，再重新评估下方首屏预算。

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
bun run perf:budget
```

`perf:budget` 从 utoopack 生成的 `dist/stats.json` 读取真实入口资源，逐文件计算 gzip，并在超过 220,000 字节时失败。登录依赖边界还会在 `test:e2e:nginx` 中通过浏览器实际请求的 chunk 反查 stats，阻止 ProComponents 回到公开登录路径。

## 性能基准

冷启动对比使用独立导出的 V5/V6 工作区、各自锁文件、顺序生产构建和同一个 Playwright Chromium 进程。每个样本都新建 browser context，两个目标每轮交换先后顺序，7 轮后取中位数：

```bash
bun run perf:measure -- \
  v5=http://127.0.0.1:5191/login \
  v6=http://127.0.0.1:5192/login \
  --runs 7
```

2026-08-05 同机实测如下。V5 固定为提交 `c16fc1892d26977dd86ddfcfce0b606e8bed1eb7`；V6 为本阶段优化后的干净导出构建。

| 指标 | V5 | Pro v6 | 结果 |
| --- | ---: | ---: | ---: |
| 干净生产构建 | 3.88 s | 5.96 s | +2.08 s |
| 初始资源原始大小 | 709,001 B | 519,722 B | -26.7% |
| 初始资源 gzip | 229,128 B | 175,345 B | -23.5% |
| DCL 中位数 | 28 ms | 38 ms | +10 ms |
| FCP 中位数 | 388 ms | 380 ms | -8 ms |
| load 中位数 | 28 ms | 52 ms | +24 ms |
| 请求数中位数 | 10 | 16 | +6 |
| 传输字节中位数 | 921,281 B | 931,062 B | +1.1% |

这一阶段消除了迁移后的主要首屏体积回归，并让 FCP 略优于 V5；utoopack 构建时间、DCL/load、请求数和总传输仍没有优于 V5，不能据此宣称所有性能指标都提升。
