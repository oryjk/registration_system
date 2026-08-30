# registration_system_backend_fe_go

与 `registration_system_go` 同步演进的 React 管理后台。技术栈：React 19 + Vite 7 + TypeScript + Tailwind CSS 4 + shadcn/ui（+ reui registry）+ react-router + react-hook-form/zod + React Query，视觉风格对齐 `betalpha-admin`（深色默认 + 青绿主色，可切浅色）。

## 开发

```bash
bun install
cp .env.example .env.development   # 如需覆盖 API 代理目标
bun run dev
```

开发服务器默认监听 `0.0.0.0`（端口 8000，可用 `PORT` 覆盖）。开发时 `ADMIN_API_BASE_URL=/go-api`，Vite 将同源 `/go-api` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:18080`）；生产构建不设 API base，浏览器直接请求同源 `/api/v1/admin/*` 和 `/health`。管理端已接入管理员认证、球队 CRUD、比赛和场馆管理员 API；普通场馆管理员可以管理球队以及发布、管理和取消比赛，发布时可确认并快速创建不存在的主队。只有超级管理员显示场馆管理员入口和比赛永久删除操作。

环境变量通过 `import.meta.env` 注入（`envPrefix: ["ADMIN_"]`）：`ADMIN_API_BASE_URL`、`ADMIN_ROUTE_BASE`、`ADMIN_PUBLIC_PATH`（后两者分别控制 react-router basename 与 Vite `base`）。

## 构建与部署

默认 `bun run build` 使用路由根路径 `/`。部署到 `/registration-admin/` 时执行 `bun run build:nginx`，它会同时设置 `ADMIN_PUBLIC_PATH` 与 `ADMIN_ROUTE_BASE` 为 `/registration-admin/`；外网验收执行 `bun run build:out109`（`/regist-admin-v3/` + 外网 API base）。Nginx 必须为该路由基址提供 SPA fallback，并将同源 API 代理到 Go 后端：

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
bun run test
bun run build
bun run perf:budget
```

`perf:budget` 从 Vite 生成的 `dist/.vite/manifest.json` 递归收集入口 chunk 及其静态 import 链（含入口 CSS），逐文件计算 gzip，并在超过 220,000 字节时失败。`test:e2e:nginx` 会在 dist 路由验证中通过浏览器实际请求断言登录入口资源不包含 antd 运行时。

## 架构要点

- 构建为纯 Vite（`vite.config.ts`），无 umi；测试为 Vitest（jsdom）。
- 会话与守卫：`src/features/admin-session/useAdminSession.tsx`（启动恢复 `getCurrentAdmin`、401 过期、登录注入），挂在 `src/router.tsx` 路由树根部。
- 壳层：`src/layout/AdminShell.tsx`（可折叠侧栏 + 毛玻璃顶栏 + 主题切换）与 `AppSidebar.tsx`。
- 设计系统：`src/styles/`（tokens / foundation / primitives / widgets / shell / login / responsive），`components.json` 配置 shadcn CLI 与 `@reui` registry。
- 表格为轻封装 `src/components/admin/data-table.tsx`（shadcn Table + 列定义），分页 `pagination-bar.tsx`，确认气泡 `confirm-popover.tsx`（Popconfirm 等价物）。

## 性能基准

冷启动对比使用独立导出的工作区、各自锁文件、顺序生产构建和同一个 Playwright Chromium 进程。每个样本都新建 browser context，两个目标每轮交换先后顺序，7 轮后取中位数：

```bash
bun run perf:measure -- \
  v5=http://127.0.0.1:5191/login \
  v6=http://127.0.0.1:5192/login \
  --runs 7
```

2026-08-05 同机实测（V5 固定为提交 `c16fc1892d26977dd86ddfcfce0b606e8bed1eb7`；V6 为 antd v6 优化阶段）如下。2026-08-30 迁移 shadcn/ui 后登录入口 gzip 约 172.7 KB，仍低于 220 KB 预算。

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
