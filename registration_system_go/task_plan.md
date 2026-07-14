# Go 比赛后端一期计划

目标：以 Go、Gin、PostgreSQL 和六边形架构实现认证、球队权限与 Match 比赛闭环。Rust 后端只读，不修改。

阶段：

1. [completed] Go 服务脚手架、健康路由和协作文档
2. [completed] PostgreSQL schema 与 sqlc 边界
3. [in_progress] Actor、JWT 与 Gin 鉴权
4. [pending] 微信登录和用户/球队最小能力
5. [pending] Match 领域模型和发布用例
6. [pending] 球队候选申请、选择和退出
7. [pending] 主队、客队与散人报名
8. [pending] 后台默认人数和逐场调整
9. [pending] OpenAPI、HTTP 装配和全量验证

约束：

- Match 是唯一比赛聚合根。
- Gin 只存在于 HTTP adapter/bootstrap。
- PostgreSQL/sqlc 只存在于 persistence adapter 和数据库工具。
- 第一阶段不实现订单、支付、账单、结算、签到和通知。
- 业务行为使用 TDD，先验证红灯再实现。
