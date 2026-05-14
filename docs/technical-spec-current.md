# 当前版本技术说明书

更新时间：2026-05-13

## 1. 工作区结构

```text
registration_system/
  registration_system_mini/         # 微信小程序端
  registration_system_backend_fe/   # 管理后台
  registration_system_rs/           # Rust 后端
  docs/                             # 产品、技术、计划和原型文档
```

三个子项目共享一个 monorepo。跨端字段和接口变更需要同步检查：

- 后端：`registration_system_rs/src/*/adapters/web/dto.rs`
- 管理端：`registration_system_backend_fe/src/services/`
- 小程序：`registration_system_mini/src/api/`、`src/types/backend.ts`

## 2. 技术栈

### 2.1 后端

- Rust 2024
- Axum 0.7
- Tokio
- PostgreSQL + sqlx 0.8
- JWT + bcrypt
- utoipa / Swagger UI
- reqwest
- aws-sdk-s3，兼容 MinIO
- tower-http，提供 CORS、Trace、静态文件服务

### 2.2 小程序

- uni-app
- Vue 3
- TypeScript
- Vite
- wot-design-uni
- 微信小程序构建目标

### 2.3 管理后台

- Vue 3
- TypeScript
- Vite 8
- Vue Router
- Pinia
- Tailwind CSS 4
- DaisyUI 5
- Axios
- Vitest / Playwright

## 3. 后端架构

后端按六边形架构组织，核心模块位于 `registration_system_rs/src/<module>/`。

典型结构：

```text
src/<module>/
  domain/          # 领域实体、值对象、领域错误
  application/     # service facade、use case、commands、read models、permissions
  ports/           # repository / gateway trait
  adapters/
    persistence/   # sqlx PostgreSQL 实现
    web/           # Axum handler、DTO、routes、openapi
    external/      # 地图、微信、支付等外部服务
```

当前主要模块：

| 模块 | 职责 |
| --- | --- |
| `auth` | 管理员登录、Token 校验、管理员管理 |
| `user` | 用户登录、资料、头像、手机号、出勤、球员管理 |
| `team` | 球队、成员、角色、管理员绑定、信用分、出勤统计 |
| `activity` | 比赛/活动、报名、球队报名、签到、位置、活动状态 |
| `challenge` | 约队大厅、球队约队、散人约队、接约、取消 |
| `billing` | 账户余额、账单流水、比赛结算、报表 |
| `payment` | 微信支付订单、充值、会员订单、订单同步/取消 |
| `notification` | 站内通知、未读数、标记已读 |
| `system` | 地图配置、小程序运行配置 |
| `wx` | 微信登录、access token、手机号 |

## 4. 后端路由结构

后端在 `src/bootstrap/modules/router.rs` 中组装路由：

```text
/api/admin/*  管理后台
/api/*        小程序端
```

### 4.1 管理端路由前缀

| 前缀 | 模块 |
| --- | --- |
| `/api/admin/auth` | 管理员认证和管理员账号 |
| `/api/admin/users` | 球员和用户管理 |
| `/api/admin/teams` | 球队管理 |
| `/api/admin/activities` | 活动管理 |
| `/api/admin/challenges` | 约队管理 |
| `/api/admin/account` | 账户余额和调账 |
| `/api/admin/orders` | 账单、结算、费用快照 |
| `/api/admin/system` | 系统设置 |
| `/api/admin/wx` | 微信能力 |
| `/api/admin/payment` | 支付能力 |

### 4.2 小程序端路由前缀

| 前缀 | 模块 |
| --- | --- |
| `/api/user` | 用户登录、资料、出勤 |
| `/api/teams` | 球队、成员、信用、出勤 |
| `/api/activity` | 比赛、报名、签到、位置 |
| `/api/challenges` | 约队 |
| `/api/notifications` | 通知 |
| `/api/account` | 余额 |
| `/api/order` | 账单流水和结算 |
| `/api/system` | 小程序运行配置、地图预览 |
| `/api/wx` | 微信登录和手机号 |
| `/api/payment` | 支付订单 |

## 5. 后端应用层状态

当前多个模块已经完成 use case 化和读写分离方向的重构：

- `activity` 已拆出 `query_activity`、`manage_activity`、`manage_registration`、`team_registration`、`checkin`、`location` use case。
- `team` 已拆出 `create_team`、`manage_member`、`manage_team`、`get_team_detail`、`attendance`、`credit`、`manage_admin_assignment` 等 use case。
- `billing` 已拆出 `account`、`orders`、`reports`、`settlement`、`adjustments` use case。
- `challenge` 已拆出创建、列表、详情、接约、取消 use case。
- `auth`、`system`、`payment`、`notification`、`user`、`wx` 也已有 use case 目录。

当前仍需关注：

- 部分 facade 和旧 service 文件仍保留兼容逻辑，需要后续持续收口。
- `PostgresActivityRepository` 已拆出 `query.rs`、`command.rs`、`models.rs`，但聚合仓储仍是核心复杂点。
- billing 业务模型仍在快速变化，不建议把当前实现视为最终财务模型。

## 6. 前端架构

### 6.1 小程序

小程序入口：

- `src/main.ts`
- `src/pages.json`

核心结构：

```text
src/
  api/           # 真实后端 API 封装
  components/    # 跨页面通用组件
  pages/         # 页面
  stores/        # 应用会话、球队上下文、通知、定位
  types/         # 后端 DTO 与页面类型
  utils/         # request、view model、支付、位置等工具
```

页面拆分规范：

- 页面 SFC 负责生命周期、页面状态和事件编排。
- 页面局部组件放在 `src/pages/<domain>/components/`。
- 页面局部状态和动作放在 `*State.ts`、`*Actions.ts`、`*Data.ts`。
- API 原子封装放在 `src/api/`。

已拆分较充分的页面：

- 首页：`pages/home/components/*`
- 比赛详情：`pages/matches/components/*`、`detailState.ts`、`detailActions.ts`
- 球队管理：`pages/teams/manage/components/*`
- 统计页：`pages/teams/components/*`
- 约队详情：`pages/challenges/components/*`
- 我的页面：`pages/user/components/*`

### 6.2 管理后台

管理后台入口：

- `src/main.ts`
- `src/router/index.ts`

核心结构：

```text
src/
  components/     # 通用布局和基础组件
  router/         # 路由
  services/       # 管理端 API 封装
  stores/         # 管理员状态
  utils/          # request、auth、toast、地图工具
  views/          # 页面和页面局部组件
```

当前页面路由：

- `/dashboard`
- `/teams`
- `/teams/:id`
- `/activities`
- `/activities/:id`
- `/challenges`
- `/challenges/:id`
- `/billing`
- `/players`
- `/admins`
- `/system/settings`

管理后台正在向小程序端类似的结构靠拢：

- service 层作为后端 DTO 唯一落点。
- 页面 SFC 负责编排。
- 页面局部组件和 `*.model.ts` 放在同一 view domain 目录。

已完成的拆分：

- `ActivitySettlementPanel.vue`
- `ActivityDetail` 的摘要、签到、报名表格、编辑弹窗、手动报名弹窗。
- `TeamDetail` 的 profile、member、credit、admin、edit dialog 等部分。
- `PlayerList` 的 filter、table、edit、freeze dialog。

未完全完成的拆分：

- `ActivityList`：toolbar 和 status summary 已存在，table 组件未完成。
- `TeamDetail`：attendance 和 membership 仍在计划中。

## 7. 数据存储

主数据库：PostgreSQL。

迁移目录：`registration_system_rs/migrations/`。

核心表族：

- 用户与管理员：`rs_user_info`、`rs_admin_user`
- 球队：`rs_teams`、`rs_team_members`、`rs_admin_team_assignment`
- 活动与报名：`rs_activity`、`rs_user_activity`、`rs_registration_log`
- 签到：`rs_activity_team_checkin_configs`、`rs_activity_checkins`
- 约队：`rs_challenges`、`rs_challenge_individual_acceptances`
- 通知：`rs_user_notifications`
- 账单和账户：`rs_user_accounts`、`rs_user_billings`、`rs_activity_fee_snapshots`、`rs_activity_settlement_batches`
- 支付：`rs_payment_orders`、`rs_team_membership_orders`
- 球队信用：`rs_team_credit_transactions`、`rs_activity_team_reviews`
- 系统配置：`rs_system_map_settings`、`rs_system_runtime_configs`

重要现状：

- 当前 schema 中 `rs_teams.id` 已迁移为 `BIGINT`，并由 `rs_teams_id_seq` 提供自增。
- 当前 schema 中 `rs_activity.id` 和 `rs_challenges.id` 仍是 `CHAR(36)`。
- 用户和管理员使用 `BIGSERIAL`。
- `rs_user_info.avatar_url` 已改为 `TEXT`，用于兼容较长对象存储 URL。
- `rs_teams.legacy_id` 保留原字符串球队 ID，用于迁移追踪和兼容排查。

## 8. 文件与对象存储

后端配置项：

```text
UPLOAD_STORAGE_BACKEND=local|minio
UPLOAD_MINIO_ENDPOINT=...
UPLOAD_MINIO_ACCESS_KEY=...
UPLOAD_MINIO_SECRET_KEY=...
UPLOAD_MINIO_BUCKET=...
UPLOAD_MINIO_REGION=...
UPLOAD_MINIO_PUBLIC_URL_PREFIX=...
```

当前行为：

- 用户头像上传：`/api/user/avatar`，当前使用 `save_minio_bytes`，直接上传 MinIO。
- 球队 Logo 上传：`/api/teams/:id/logo`，使用 `save_upload_bytes`，根据 `UPLOAD_STORAGE_BACKEND` 在 local/minio 间切换。
- local 上传路径通过 `/uploads` 静态服务暴露。
- MinIO 返回 `UPLOAD_MINIO_PUBLIC_URL_PREFIX + object_key`。

建议后续统一：

- 明确所有图片是否强制 MinIO。
- 如强制 MinIO，应把球队 Logo 和未来比赛封面也改成同一策略。
- 补充图片迁移脚本验收：base64 -> 文件 -> MinIO URL -> 回写数据库。

## 9. 外部服务

### 9.1 微信

配置：

- `WX_APP_ID`
- `WX_APP_SECRET`
- `WX_USE_MOCK`
- `WX_MOCK_PHONE_NUMBER`

能力：

- 微信登录。
- 获取 access token。
- 获取手机号。

### 9.2 微信支付

配置：

- `WX_MCH_ID`
- `WX_API_KEY`
- `WX_PAY_API_BASE_URL`
- `WX_PAY_NOTIFY_PATH`
- `WX_PAY_USE_MOCK`

能力：

- 充值订单。
- 球队会员订单。
- 查询订单状态。
- 同步订单状态。
- 取消订单。
- 微信支付回调。

当前风险：

- mock 支付用于开发，本地和生产必须区分配置。
- 财务闭环尚未完整产品化。

### 9.3 地图

支持：

- 腾讯地图。
- 高德地图。

能力：

- 地点搜索。
- 坐标反查。
- 小程序地图预览配置。
- 管理端系统设置可配置地图供应商。

## 10. 权限模型

### 10.1 用户侧

用户侧通过 JWT 表示当前用户身份。队长、领队等权限主要来自 `rs_team_members.role`。

典型规则：

- 创建活动、编辑未来活动、球队报名、签到配置、结算等需要队长/领队等球队管理角色。
- 普通用户可进行个人报名、查看自己的账单、通知和出勤。

### 10.2 管理端

管理端通过管理员 JWT 表示当前管理员身份。

典型规则：

- 超级管理员拥有全局能力。
- 普通管理员可被绑定到具体球队。
- 管理员账号管理和系统设置需要超级管理员。

## 11. 验证命令

后端：

```bash
cd registration_system_rs
cargo fmt --check
cargo clippy
cargo test
```

小程序：

```bash
cd registration_system_mini
bun run type-check
bun run build:mp-weixin
```

管理端：

```bash
cd registration_system_backend_fe
bun run type-check
bun run lint
bun run build
```

## 12. 当前技术债

1. billing 当前已能结算，但财务模型、撤销、退款、审计未完整。
2. 管理端部分新增字段和后端 DTO 刚完成一轮同步，仍需要继续联调。
3. 管理端 ActivityList 和 TeamDetail 拆分未完全完成。
4. 历史 mock 数据文件仍存在于小程序 `src/mock/appData.ts`，虽然当前页面不直接依赖。
5. 存量头像转 MinIO 的脚本和执行结果需要单独验证。
6. 测试覆盖较偏后端业务和部分前端静态约束，端到端流程仍需要补强。
