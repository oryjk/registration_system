# registration_system_backend

Rust 重构版球队报名系统后端。

> ⚠️ **本子项目已降级为只读参考**：工作区主力后端是 `../registration_system_go/`（Go 新后端，在复刻并优化本项目的业务模型）。Rust 后端不再承接新功能、不再增加代码，保留目的是供业务/迁移参考、OpenAPI schema 和历史数据迁移核对。本文档下方的运行/测试/路由说明仍有效，但仅在「迁移核对 / 读懂老后端契约 / 验证存量行为」场景下使用。详见根目录 `README.md` 与同目录 `AGENTS.md`。

## 技术栈

- `axum`：HTTP 路由与处理器
- `sqlx(postgres)`：数据库访问与 migration
- `tokio`：异步运行时
- `anyhow` / `thiserror`：错误处理
- `jsonwebtoken`：JWT 鉴权
- `bcrypt`：密码哈希

## 架构

项目按业务模块拆分：

- `src/auth`
- `src/user`
- `src/team`
- `src/activity`
- `src/billing`
- `src/challenge`
- `src/notification`
- `src/wx`
- `src/payment`
- `src/system`
- `src/bootstrap`
- `src/shared`

每个业务模块都采用：

- `domain`
- `ports`
- `application`
- `adapters`

其中 `adapters` 下面除 `persistence` / `web` 外，也可能按模块需要包含 `external` 或 `api` 适配层。

`bootstrap` 负责：

- `config`：按 `app/server/database/auth/wx/wx_pay` 分段加载配置
- `logging`：统一初始化 `tracing`
- `modules`：构建服务并装配业务路由

## 快速开始

项目通过 `.cargo/config.toml` 将 crates.io 替换为字节跳动 Dev Infra 提供的 `rsproxy.cn` sparse 镜像。本地在本目录执行 `cargo build`、`cargo test` 或 `cargo install` 时会自动使用该配置，无需修改用户级 `~/.cargo/config.toml`。

Docker 构建复用同一份 Cargo 配置。Dockerfile 中的 Rust 和 Debian 基础镜像仍通过 DaoCloud 镜像代理拉取；`rsproxy.cn` 负责 Cargo crates 和索引，不是 Docker 容器镜像仓库。

1. 复制环境变量模板

```bash
cp .env.example .env
```

2. 安装 `sqlx-cli`

```bash
cargo install sqlx-cli --no-default-features --features postgres,rustls
```

3. 创建数据库并执行 migration

```bash
sqlx migrate run
```

4. 启动服务

```bash
cargo run
```

## 测试

默认测试不会运行需要真实 PostgreSQL 的数据库集成测试：

```bash
cargo test
```

会写入测试数据库或依赖 `sqlx` 临时库的测试均已标记为 `#[ignore]`，需要显式执行：

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/registration_system_test make integration-test
```

直接连接仓储的集成测试只读取 `TEST_DATABASE_URL`，不要使用开发库或生产库地址。

## 默认管理员

- 用户名：`admin`
- 密码：`admin123456`

首次迁移会自动插入默认管理员账号。

## 路由前缀

后端同时服务两个前端入口。

### 后台管理端

所有后台管理接口统一挂载在 `/api/admin` 下：

| 模块 | 路径前缀 |
|------|---------|
| auth | `/api/admin/auth` |
| user | `/api/admin/users` |
| teams | `/api/admin/teams` |
| activity | `/api/admin/activities` |
| challenges | `/api/admin/challenges` |
| account | `/api/admin/account` |
| order | `/api/admin/orders` |
| system | `/api/admin/system` |
| wx | `/api/admin/wx` |
| payment | `/api/admin/payment` |

### 小程序端

小程序接口统一挂载在 `/api` 下：

| 模块 | 路径前缀 |
|------|---------|
| user | `/api/user` |
| teams | `/api/teams` |
| activity | `/api/activity` |
| challenges | `/api/challenges` |
| notifications | `/api/notifications` |
| account | `/api/account` |
| order | `/api/order` |
| system | `/api/system` |
| wx | `/api/wx` |
| payment | `/api/payment` |

说明：用户 / 球队 / 活动中的管理后台专用子路由只挂载在 `/api/admin/*`，不会再暴露在 `/api/*` 下。

### 其他入口

| 入口 | 路径 |
|------|------|
| 健康检查 | `GET /health` |
| 版本信息 | `GET /api/version` |
| 兼容版本信息 | `GET /apid/version` |
| OpenAPI 文档 | `GET /api/openapi.json` |
| Swagger UI | `GET /api/docs/` |
| 兼容 OpenAPI 文档 | `GET /apid/openapi.json` |
| 兼容 Swagger UI | `GET /apid/docs/` |

## 已实现接口

- `auth`：登录、校验、注册、登出、管理员列表、管理员状态更新、管理员删除
- `user`：登录、校验、列表、搜索、当前用户资料、指定用户资料、活动记录、出勤记录、出勤排名、用户更新、用户删除、球员列表/详情、球员创建/更新、冻结/解冻
- `teams`：创建、列表、搜索、详情、密码信息、加入、我的球队、指定用户球队、球队更新/删除、成员增删改、成员批量移除、成员批量状态更新、管理后台专用列表/详情、球队管理员分配
- `activity`：创建、列表、详情、批量删除、进行中检查、状态更新、本人报名、管理员代改报名、删除报名、活动更新、报名回填、活动报名记录分页列表、管理员手动报名、批量报名状态更新
- `account`：本人余额、指定用户余额、充值、比赛扣费、罚款、余额校准、校准记录、交易流水
- `order`：活动订单创建、订单详情、订单列表、自动均摊、月度罚款计算、活动账单、用户账单汇总、本人账单流水、指定用户账单流水
- `system`：地图服务配置读取/更新、地图预览配置读取、小程序运行配置读取/更新
- `challenge`：约队发布、接约、取消、详情、管理端列表
- `notification`：通知列表、未读数、全部标记已读
- `wx`：微信登录、`access-token` 获取、手机号获取
- `payment`：充值下单、订单查询、订单同步、订单列表、支付回调、订单取消

## 说明

- `sqlx migrate run` 直接读取 `migrations/` 下的 PostgreSQL 迁移文件
- OpenAPI 文档由 `utoipa` 生成，Swagger UI 入口为 `/api/docs/`
- 系统配置相关迁移见 `migrations/20260415000200_system_map_settings.sql` 与 `migrations/20260511000100_system_runtime_configs.sql`
- `WX_USE_MOCK=true` 或 `WX_PAY_USE_MOCK=true` 时，会启用本地 mock 微信/支付适配器
- 切换到真实微信环境时，至少需要配置 `WX_APP_ID`、`WX_APP_SECRET`、`WX_MCH_ID`、`WX_API_KEY`
- 如果本机 `cargo` 构建时被异常环境变量污染，可先执行 `unset SCRCPY_SERVER_PATH`
