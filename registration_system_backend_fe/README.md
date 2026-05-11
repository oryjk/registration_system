# registration_system_backend_fe

赛事报名与球队管理系统的管理后台，面向管理员和运营角色，负责活动、球队、球员、账单、管理员与系统设置等后台操作。

## 技术栈

- Vue 3 + TypeScript
- Vue Router + Pinia
- Vite 8
- Tailwind CSS 4 + DaisyUI 5
- Axios
- Vitest + Playwright

## 当前页面范围

当前已接入或已落地的主要页面：

- 登录页
- 仪表盘
- 球队管理 / 球队详情
- 活动管理 / 活动详情
- 账单管理
- 球员管理
- 管理员管理
- 系统设置（地图服务配置）

路由入口位于 `src/router/index.ts`，页面主要分布在 `src/views/`。

## 目录结构

```text
src/
  components/     # 通用组件与布局
  router/         # 路由定义
  services/       # 后端接口封装
  stores/         # Pinia 状态
  utils/          # 请求封装与工具
  views/          # 页面
  __tests__/      # 单元测试
e2e/              # Playwright 端到端测试
```

## 本地开发

```bash
cd registration_system_backend_fe
bun install
bun run dev
```

Vite 本地开发端口默认为 `5373`。

## 环境变量与接口地址

环境文件：`.env`

当前主要变量：

- `VITE_APP_TITLE`：页面标题
- `VITE_API_BASE_URL`：后端服务根地址，不带 `/api/admin`

请求层定义在 `src/utils/request.ts`，实际请求地址会拼成：

```text
${VITE_API_BASE_URL}/api/admin
```

因此：

- 若 `VITE_API_BASE_URL=http://127.0.0.1:18080`，实际接口前缀为 `http://127.0.0.1:18080/api/admin`
- 若 `VITE_API_BASE_URL` 留空，前端会请求 `/api/admin/*`

本地 `vite.config.ts` 同时配置了代理：

```text
/api -> http://localhost:18080
```

也就是说，默认开发模式会直接代理到本地 Rust 后端；如果你不走代理，也可以显式把 `VITE_API_BASE_URL` 设为 `http://127.0.0.1:18080`。

## 常用命令

```bash
bun run dev
bun run type-check
bun run lint
bun run build
bun run test:unit
bun run test:e2e
```

首次执行 E2E 前，如本机尚未安装浏览器：

```bash
bunx playwright install
```

## 联动后端

- 后端项目目录：`../registration_system_rs/`
- 后端管理接口通常挂载在 `/api/admin`
- 字段与返回结构以 `src/services/` 为前端唯一落点
- 若后端 DTO 或路由变更，至少同步检查：
  - `src/services/`
  - `src/views/`
  - `src/stores/`

## 开发建议

- 先改 `services`，再回到页面和状态管理层
- 列表页优先消费后端分页能力，不默认全量拉取后前端过滤
- 不要把复杂请求直接散落在组件内部
- 提交前至少执行 `bun run type-check`，涉及页面行为或通用请求封装时补跑 `bun run lint`
