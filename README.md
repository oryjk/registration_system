# registration_system

赛事报名与球队管理 monorepo，当前由 **4 个**相互协作的子项目组成。

工作区已从 **Rust 老后端** 迁移到 **Go 新后端**：Go 后端是唯一在开发的后端，管理端使用 React 新版（`registration_system_backend_fe_go/`，旧版 Vue 管理端已删除），小程序统一在 `registration_system_mini/` 内原地切换，不再维护平行的 Go 版本。

## 子项目总览

| 目录 | 说明 | 技术栈 | 对接后端 |
| --- | --- | --- | --- |
| `registration_system_go/` | **新后台服务端**，主开发，第一阶段优先实现认证、球队与比赛闭环 | `Go + Gin + PostgreSQL + pgx + sqlc` | （自身） |
| `registration_system_mini/` | 用户侧小程序/H5，已在同一项目内完成从 Rust 到 Go 的切换 | `uni-app + Vue 3 + TypeScript + Vite + Bun` | **Go** |
| `registration_system_backend_fe_go/` | 管理后台（**新版 React**，与 Go 后端同步演进，中期阶段） | `Umi Max + React + Ant Design 6 + ProComponents 3 + React Query 5 + Tailwind 4 + antd-style + Biome + utoopack + Bun` | **Go** |
| `registration_system_admin_app/` | 移动管理 App，面向赛事运营/管理员（**已暂停开发**） | `Flutter + Dart` | Rust `/api/admin`；Go `/api/v1/admin` |

> 阶段说明：旧 Rust 后端 `registration_system_rs/` 已停止开发并**从工作区删除**（2026-08-30，git 历史可查）；所有后端开发都在 Go 项目进行。`mini-rust-backend-final` 标记小程序最后一个 Rust 后端基线。

## 文档入口

- 工作区协作约定：`AGENTS.md`
- 小程序/H5 说明：`registration_system_mini/README.md`
- 管理后台（新版）说明：`registration_system_backend_fe_go/README.md`
- 移动管理 App 说明：`registration_system_admin_app/README.md`
- Go 后端说明：`registration_system_go/README.md`

修改任一子项目之前，先读根目录和目标子项目目录下的 `AGENTS.md`。

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

> Go 后端默认端口 `18080`。判断某个前端对接哪个后端，以路径形态（`/activities` vs `/matches`、`{success,...}` vs `{code:0,...}`）为准，不要用端口判断。
>
> 旧 Rust 后端 `registration_system_rs/` 已从工作区删除，本地无法再启动；其历史接口形态见下文「前后端边界」表格。

### B 链路：对接 Go 新后端（主开发）

#### B1. 启动 Go 后端

```bash
cd registration_system_go
cp .env.example .env   # 默认 HTTP_ADDR=:18080
go run ./cmd/api
```

- 必填配置：`DATABASE_URL`、`JWT_SECRET`、`WECHAT_APP_ID`、`WECHAT_APP_SECRET`。
- Go API 在宿主机直接运行，本地开发不需要 Docker；`DATABASE_URL` 指向已准备好的 PostgreSQL。
- 健康检查 `GET /health`；管理端接口挂在 `/api/v1/admin`；小程序/H5 接口挂在 `/api/v1/app`。
- Swagger UI：`http://127.0.0.1:18080/api/docs/`。
- OpenAPI YAML：`http://127.0.0.1:18080/api/docs/openapi.yaml`。
- Swagger UI 静态资源和 OpenAPI 文档均嵌入 Go 二进制，无需 CDN 或 Docker。用户端和管理端受保护接口分别使用用户 JWT 和管理员 JWT；Swagger UI 的 Authorize 输入框填写令牌值即可。
- 第一阶段不实现订单、支付、账单、结算、签到、通知。

#### B2. 启动新版 React 管理后台

```bash
cd registration_system_backend_fe_go
bun install
bun run dev
```

- 开发使用 `ADMIN_API_BASE_URL=/go-api`，由 Umi 代理 `/go-api → http://127.0.0.1:18080`（可用 `.env` 的 `API_PROXY_TARGET` 覆盖目标）；生产构建保持 API base 为空，由 Nginx 转发同源 `/api/v1/admin/*` 和 `/health` 到 Go 后端。
- 请求层对 `admin` 接口统一加前缀 `/api/v1/admin`，`/health` 等用裸路径。
- 响应契约 `{ code, message, data }`，成功判定 `code === 0`。
- 生产构建：`bun run build:nginx`（`ADMIN_PUBLIC_PATH` 与 `ADMIN_ROUTE_BASE` 均为 `/registration-admin/`）；Nginx 必须配置 `/registration-admin/` 到 `/registration-admin/index.html` 的 SPA fallback。

#### B3. 启动小程序（已对接 Go）

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
```

- 微信开发者工具导入目录：`registration_system_mini/dist/dev/mp-weixin`。
- 后端地址与端口等环境变量说明见 `registration_system_mini/AGENTS.md`；接口契约统一为 Go 的 `{ code, message, data }`（成功判定 `code === 0`）。
- 小程序对接 Go 后端的改造统一在 `registration_system_mini/` 内完成，不再启动或维护 `registration_system_mini_go/`。

### C：移动管理 App（独立链路，已暂停）

> 该项目**已暂停开发**，以下说明供恢复时参考。

```bash
cd registration_system_admin_app
flutter run
```

- 后端地址可配置；Rust 管理接口使用 `/api/admin`，Go 管理接口使用 `/api/v1/admin`，切换后端时必须同步切换 base URL。
- baseURL 在登录页可手填并持久化到 `SharedPreferences`（Android 模拟器需 `adb reverse tcp:18080 tcp:18080`）。
- 首版聚焦：登录 + 工作台首页 + 创建比赛 + 创建球队（共 4 个页面）。

## 前后端边界

### 接口前缀

| 后端 | 管理端 | 用户侧 | 健康检查 |
| --- | --- | --- | --- |
| Rust（`registration_system_rs`，已删除，历史参考） | `/api/admin` | `/api`（`/api/user`、`/api/teams`、`/api/activity`、`/api/challenges`、`/api/wx` 等） | `GET /health` |
| Go（`registration_system_go`） | `/api/v1/admin` | `/api/v1/app`（认证、球队、比赛等） | `GET /health` |

### 响应契约差异（重要）

| 链路 | 响应体 | 成功判定 |
| --- | --- | --- |
| Rust 老后端 ← 老版前端 | `{ success, message, data }` | `success === true` |
| Go 新后端 ← 新版前端 | `{ code, message, data }` | `code === 0` |

> 新版前端**不沿用**老版的 `{ success, message, data }` 假设；跨链路复制代码时务必核对契约。

### 概念差异

- Rust 用 `activities` / Go 用 `matches`（比赛聚合根）。判断一个前端对接哪个后端，看它请求的是 `/activities` 还是 `/matches`。
- 老版管理后台的 `/teams/admin-list`、`/teams/:id/admin-detail` 是 Rust 专属路径，Go 后端没有。

### 联动检查

改后端接口时，同时检查对应链路的前端：

- 改 Rust 后端 → 该项目已从工作区删除，不存在联动链路；旧库数据迁移用 `registration_system_go/scripts/migrate-legacy.sh`（直连线上旧库，不依赖已删除目录）
- 改 Go 后端 → `registration_system_backend_fe_go/src/api/`；涉及用户端接口或小程序切换时同时检查 `registration_system_mini/src/api/`
- 改管理端或小程序页面时，以后端 DTO、路由、迁移为准，不猜字段

## 当前状态

- **Go 新后端**（主开发）：已覆盖认证、球队、比赛/约队、用户资料、管理员体系；订单/支付/账单/结算/签到/通知不在第一阶段；MinIO/文件存储尚未引入；系统设置（报名人数默认规则）仅有 sqlc 层、尚无 API。
- **Rust 老后端**：已停止开发并**从工作区删除**（2026-08-30，git 历史可查）；线上旧库 `rs_*` 表仍保留作为迁移源。
- **老版 Vue 管理后台**：已从工作区删除（git 历史可查），由新版 React 管理后台替代。
- **新版 React 管理后台**：登录、鉴权、仪表盘、比赛（CRUD + 状态流转）、球队（含成员/队长/球员资料）、管理员、接入状态已落地，覆盖约老版 3/8 业务域；billing/challenges/venues 尚未开始。
- **小程序/H5**：**已对接 Go 后端**（`mini-rust-backend-final` 是最后一个 Rust 后端基线）；`src/mock/` 仅作历史原型留存。
- **移动管理 App**：已初始化 Flutter iOS/Android 项目，提供登录 + 工作台 + 创建比赛 + 创建球队首版页面；当前**已暂停开发**。
