# registration_system

赛事报名与球队管理 monorepo，当前由 5 个相互协作的子项目组成：

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `registration_system_mini/` | 微信小程序端，面向球员/队员/普通用户 | `uni-app + Vue 3 + TypeScript + Vite` |
| `registration_system_backend_fe/` | 管理后台，面向运营/管理员 | `Vue 3 + TypeScript + Vite + Tailwind 4 + DaisyUI 5` |
| `registration_system_backend_fe_go/` | 对接 Go 新后端的管理后台 | `Umi Max + React + Ant Design 6 + ProComponents 3 + React Query 5 + Tailwind 4 + antd-style + Biome + utoopack + Bun` |
| `registration_system_admin_app/` | 移动管理 App，面向赛事运营/管理员 | `Flutter + Dart` |
| `registration_system_go/` | 新后台服务端，优先实现认证、球队与比赛闭环 | `Go + Gin + PostgreSQL + pgx + sqlc` |
| `registration_system_rs/` | 旧后台服务端，只作为业务与迁移参考 | `Rust + Axum + PostgreSQL + sqlx` |

## 文档入口

- 工作区协作约定：`AGENTS.md`、`CLAUDE.md`
- 小程序说明：`registration_system_mini/README.md`
- 管理后台说明：`registration_system_backend_fe/README.md`
- Go 配套管理后台说明：`registration_system_backend_fe_go/README.md`
- 移动管理 App 说明：`registration_system_admin_app/README.md`
- Go 后端说明：`registration_system_go/README.md`
- Rust 参考后端说明：`registration_system_rs/README.md`

修改任一子项目之前，先读当前目录和目标子项目目录下的 `AGENTS.md` / `CLAUDE.md`。

## Git 仓库

当前工作区是根目录统一管理的 monorepo Git 仓库。

- 主分支：`main`
- 远端：`git@github.com:oryjk/registration_system.git`
- 子项目目录不再保留各自独立的 `.git` 元数据。

查看状态、提交和推送时请在根目录执行：

```bash
git status
git add .
git commit -m "..."
git push origin main
```

不要在子项目目录内重新初始化仓库；子项目内运行 `git` 会自动向上使用根仓库。

## 推荐联调顺序

### 1. 启动 Go 后端

```bash
cd registration_system_go
cp .env.example .env
make run
```

- `.env.example` 默认服务端口为 `18080`
- 第一阶段只覆盖认证、用户/球队权限和比赛闭环
- Rust 后端保留为只读参考，不再承接新功能

### 2. 启动管理后台

```bash
cd registration_system_backend_fe
bun install
bun run dev
```

- 本地开发端口默认为 `5373`
- 请求层会把 `VITE_API_BASE_URL` 与 `/api/admin` 拼接
- 如果 `VITE_API_BASE_URL` 为空，则浏览器请求 `/api/admin/*`，由 Vite 代理到 `http://localhost:18080`
- 如果直接对接 Rust 后端默认端口，可将 `VITE_API_BASE_URL` 设为 `http://127.0.0.1:18080`

### 3. 启动 Go 配套管理后台

```bash
cd registration_system_backend_fe_go
bun install
bun run dev
```

- 开发使用 `ADMIN_API_BASE_URL=/go-api`，由 Umi 代理到 Go 后端；可用 `API_PROXY_TARGET` 覆盖目标地址。
- 管理端请求统一使用 `/api/admin`，健康检查使用 `/health`，响应契约为 `{ code, message, data }`。
- 生产环境保持 API base 为空，由 Nginx 转发同源 `/api/admin/*` 和 `/health`。
- `bun run build:nginx` 将前端构建到 `/registration-admin/` 路由基址；Nginx 必须配置 SPA fallback 到 `/registration-admin/index.html`。
- 安装和脚本仍使用 Bun；Umi 运行时要求 Node.js 20 或更高版本。

### 4. 启动小程序

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
```

- 当前 `VITE_API_BASE_URL` 约定直接包含 `/api`
- 开发环境默认值：`http://127.0.0.1:18080/api`
- 微信开发者工具导入目录：`registration_system_mini/dist/dev/mp-weixin`

### 5. 启动移动管理 App

```bash
cd registration_system_admin_app
flutter run
```

- 当前首版聚焦移动管理端入口、创建比赛和创建球队
- iOS/Android 构建依赖本机 Flutter、Xcode 和 Android SDK 环境

## 前后端边界

- 管理后台接口通常挂载在 `/api/admin`
- 小程序接口通常挂载在 `/api`
- 改后端接口时，同时检查：
  - `registration_system_backend_fe/src/services/`
  - `registration_system_mini/src/api/`
- 改管理端或小程序页面时，以后端 DTO、路由、迁移为准，不猜字段

## 当前状态

- 后端已具备主要业务模块、迁移、集成测试和 OpenAPI 文档
- 管理后台已落地登录、仪表盘、球队、活动、账单、球员、管理员、系统设置等页面
- 移动管理 App 已初始化 Flutter iOS/Android 项目，并提供创建比赛、创建球队的首版页面
- 小程序已接入主要真实接口：首页、约队、比赛详情、球队管理、账单、通知、个人中心等页面按真实 API 推进；`src/mock/` 仅作为历史原型数据留存
- 小程序运行配置已支持通过后端 JSON 配置读取，例如首页比赛数量、约队数量、活动拉取数量和过期比赛过滤
