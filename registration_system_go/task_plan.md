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

## 2026-07-15 场馆管理员管理

1. [completed] 超级管理员权限校验和数据库角色复核
2. [completed] 场馆管理员列表与创建 API
3. [completed] 普通场馆管理员发布比赛权限测试
4. [completed] React 列表、创建弹窗和超级管理员菜单
5. [completed] 真实接口、桌面与移动端 E2E 联调

## 2026-07-15 比赛列表危险操作

1. [completed] 报名中和进行中比赛的列表取消操作
2. [completed] 数据库当前角色驱动的超级管理员删除权限
3. [completed] 任意比赛状态硬删除和 PostgreSQL 级联清理
4. [completed] 桌面与移动端确认交互和浏览器验证

## 2026-07-15 球队管理 CRUD

1. [completed] 球队完整列表、详情、创建、更新和删除应用用例
2. [completed] PostgreSQL/sqlc 更新与安全删除冲突映射
3. [completed] React 球队管理列表、筛选、详情、创建、编辑和删除交互
4. [completed] 真实接口查询、桌面与移动端 E2E 和截图验证
5. [completed] 发布比赛时确认并静默创建不存在的主队

约束：

- Match 是唯一比赛聚合根。
- Gin 只存在于 HTTP adapter/bootstrap。
- PostgreSQL/sqlc 只存在于 persistence adapter 和数据库工具。
- 第一阶段不实现订单、支付、账单、结算、签到和通知。
- 业务行为使用 TDD，先验证红灯再实现。
