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

## 2026-07-15 球队成员与队长管理

1. [completed] 成员角色、状态和当前队长保护规则
2. [completed] 成员列表、候选人、添加、更新和移除 API
3. [completed] 设置/取消队长的 PostgreSQL 原子更新
4. [completed] 本地 PostgreSQL 与真实 HTTP 联调及全量验证

## 2026-07-16 旧 MySQL 球队数据导入

1. [completed] 只读核验旧 MySQL 与新 PostgreSQL 的球队表结构、数据量和重复情况
2. [completed] 确认字段映射、冲突策略与导入边界
3. [completed] 实现可重复执行、事务化且可审计的导入方式
4. [completed] 先预演，再执行真实导入
5. [completed] 核对导入前后数量、字段与约束，并运行相关验证

### 头像显示修复

1. [completed] 复现并确认目标 `avatar_url` 为无 Data URI 前缀的旧 JPEG Base64
2. [completed] 为导入边界的头像规范化补充红绿测试
3. [completed] 重跑真实导入更新头像并做浏览器验证

错误记录：

| 错误 | 尝试 | 处理 |
| --- | --- | --- |
| 系统 Python 缺少 `pymysql`，只读源库检查未启动 | 1 | 改用现有 MySQL CLI 或临时隔离依赖，不写入项目依赖 |
| MySQL 8 `information_schema` 列名大小写导致解析 `KeyError` | 2 | 为查询列显式指定小写别名后重试；源库连接本身已成功 |
| `git pull --rebase --autostash` 恢复本地改动时 `task_plan.md` 冲突 | 1 | 保留远端成员管理章节与本次导入章节，解决冲突并恢复未暂存状态 |
| Task 1 首次领域红灯测试存在 Go range 变量语法错误 | 1 | 修正为遍历结构体值后重跑，要求仅因 `UpdateProfile` 缺失而失败 |
| Task 2 sqlc 为扩展字段查询生成专用 Row，旧 `mapUser(authsqlc.User)` 不兼容 | 1 | mapper 改为显式字段参数，统一承接表模型与专用 Row 的同构字段 |
| Task 4 聚焦 E2E 无法启动 Playwright Chromium 1228 | 1 | 安装当前 Playwright 版本对应的 Chromium 后重跑桌面与移动用例 |
| Task 4 E2E 的 `getByText("张新")` 同时匹配真实姓名与昵称辅助文本 | 2 | 将断言收紧为精确文本匹配后复跑，不修改业务 UI |
| Task 5 显式安装 MySQL 驱动 v1.9.3 连带将 goose 降到 v3.27.1 | 1 | 恢复 goose v3.27.2，改用 MySQL 驱动 v1.10.0 后执行 `go mod tidy` |
| 正式迁移前目标球队数从早先 3 支变为 1 支 | 1 | 只读复核剩余球队为 `asdadsdd`、无比赛引用且不与源球队重名，保留该记录并继续 dry-run |
| 首次真实 dry-run 从工作区根错误读取 `.env`，缺少 `DATABASE_URL` | 1 | 改为读取 `registration_system_go/.env` 后重跑；命令在连接前退出，无数据库写入 |
| 现有 Chrome 控制插件初始化时报 `Cannot redefine property: process` | 1 | 不修改应用规避插件问题，改用项目 Playwright 桌面/移动 E2E 验证 Data URI 图片真实解码 |
| 头像 E2E 复用了被 `betalpha-admin` 占用的 5175 端口并卡在登录页 | 1 | 保留其他项目进程，在 5177 启动本项目并显式设置 `PLAYWRIGHT_BASE_URL` 重跑 |

约束：

- Match 是唯一比赛聚合根。
- Gin 只存在于 HTTP adapter/bootstrap。
- PostgreSQL/sqlc 只存在于 persistence adapter 和数据库工具。
- 第一阶段不实现订单、支付、账单、结算、签到和通知。
- 业务行为使用 TDD，先验证红灯再实现。
