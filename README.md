# registration_system

赛事报名与球队管理 monorepo，当前由 3 个相互协作的子项目组成：

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `registration_system_mini/` | 微信小程序端，面向球员/队员/普通用户 | `uni-app + Vue 3 + TypeScript + Vite` |
| `registration_system_backend_fe/` | 管理后台，面向运营/管理员 | `Vue 3 + TypeScript + Vite + Tailwind 4 + DaisyUI 5` |
| `registration_system_rs/` | 后台服务端，提供管理端与业务 API | `Rust + Axum + PostgreSQL + sqlx` |

## 文档入口

- 工作区协作约定：`AGENTS.md`、`CLAUDE.md`
- 小程序说明：`registration_system_mini/README.md`
- 管理后台说明：`registration_system_backend_fe/README.md`
- 后端说明：`registration_system_rs/README.md`

修改任一子项目之前，先读当前目录和目标子项目目录下的 `AGENTS.md` / `CLAUDE.md`。

## Git 仓库

当前工作区是根目录统一管理的 monorepo Git 仓库。

- 主分支：`main`
- 远端：`git@github.com:oryjk/registration_system.git`
- 三个子项目目录不再保留各自独立的 `.git` 元数据。

查看状态、提交和推送时请在根目录执行：

```bash
git status
git add .
git commit -m "..."
git push origin main
```

不要在子项目目录内重新初始化仓库；子项目内运行 `git` 会自动向上使用根仓库。

## 推荐联调顺序

### 1. 启动后端

```bash
cd registration_system_rs
cp .env.example .env
sqlx migrate run
cargo run
```

- `.env.example` 默认服务端口为 `18080`
- OpenAPI 文档：`GET /api/openapi.json`
- Swagger UI：`GET /api/docs/`

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

### 3. 启动小程序

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
```

- 当前 `VITE_API_BASE_URL` 约定直接包含 `/api`
- 开发环境默认值：`http://127.0.0.1:18080/api`
- 微信开发者工具导入目录：`registration_system_mini/dist/dev/mp-weixin`

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
- 小程序已接入主要真实接口：首页、约队、比赛详情、球队管理、账单、通知、个人中心等页面按真实 API 推进；`src/mock/` 仅作为历史原型数据留存
- 小程序运行配置已支持通过后端 JSON 配置读取，例如首页比赛数量、约队数量、活动拉取数量和过期比赛过滤
