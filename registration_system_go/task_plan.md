# Go 比赛后端一期计划

目标：以 Go、Gin、PostgreSQL 和六边形架构实现认证、球队权限与 Match 比赛闭环。Rust 后端只读，不修改。

阶段：

1. [completed] Go 服务脚手架、健康路由和协作文档
2. [completed] PostgreSQL schema 与 sqlc 边界
3. [completed] Actor、JWT 与 Gin 鉴权
4. [completed] 微信登录和用户/球队最小能力
5. [completed] Match 领域模型和发布用例
6. [pending] 球队候选申请、选择和退出
7. [pending] 主队、客队与散人报名
8. [pending] 后台默认人数和逐场调整
9. [pending] OpenAPI、HTTP 装配和全量验证

## 2026-07-15 管理端比赛闭环

1. [completed] 管理员领域、密码校验、登录与当前管理员
2. [completed] 管理员创建来源 migration 与 sqlc 查询
3. [completed] 比赛管理查询、创建、基础信息编辑和状态流转
4. [completed] Gin 完整依赖装配与 `/api/admin` 路由
5. [completed] 首个管理员初始化命令
6. [completed] React 登录、比赛列表、详情和表单页面
7. [completed] 本地 Go 服务、Docker PostgreSQL 与浏览器联调

约束：

- Match 是唯一比赛聚合根。
- Gin 只存在于 HTTP adapter/bootstrap。
- PostgreSQL/sqlc 只存在于 persistence adapter 和数据库工具。
- 第一阶段不实现订单、支付、账单、结算、签到和通知。
- 业务行为使用 TDD，先验证红灯再实现。
