# Progress

## 2026-08-09

- `/api/v1/app` 已完成微信/H5 测试登录、用户资料、球队上下文、比赛列表/首页/详情、球队申请和个人报名闭环。
- 个人报名支持主队、客队和散人规则，包含幂等 PUT/DELETE、容量控制、派生状态更新和单事务成员校验。
- legacy 用户、球队、成员、比赛和报名已具备 full/incremental、dry-run、稳定映射与只读源约束。
- 小程序前端切换、管理端报名维护、默认人数配置和最终真实联调仍未完成。
- OpenAPI 3.0.3 与离线 Swagger UI 正在接入。

## 2026-07-21

- 已将三种“约队模式”重新定义为 Match 的三种对手形成方式，明确 Match、RegistrationGroup、TeamApplication、Registration 的单一职责。
- 已固定 `offline_confirmed` 不招募、`online_team` 选择整队、`online_individual` 按最小/最大人数确认和关闭的状态规则。
- 已补充球队申请领域转换；非法终态跳转由 domain 返回冲突，不下放到 handler 或 SQL 各自判断。
- 已实现用户侧比赛列表和详情 API；详情只返回各组已参赛人数和当前 JWT 用户自己的报名，不暴露其他人的花名册与资料。
- 已实现 `online_team` 完整写入流程：候选队申请、主队/管理员选择、其他待选申请拒绝、客队退出与重新招募。
- 选择和退出使用 PostgreSQL 行锁与单事务提交，Match、TeamApplication 和 guest_team 报名组保持原子一致。
- 主队管理者/管理员可查看全部候选申请；候选队管理者只能查看自己所管理球队的申请。
- 管理端后续新增页面明确要求桌面和手机响应式布局，并通过 Playwright 双视口验收。

## 2026-07-17

- 已确认历史比赛与报名尚未迁移（目标 matches/报名均为 0），migration 4 与导入器代码已就绪，阻塞在 9 个未映射 openid。
- 已逐一核验 9 人：8 人为真新用户；源 user 16「阿祖」与目标 #38「东安利马」同为桂强（双微信账号，union_id 均为空）。
- 用户决定：8 人补迁、阿祖报名合并到 #38；补人/合并按一次性工作用 SQL 完成，不写 Go 代码（已撤销刚起步的 TDD 分支，导入器保持原状）。
- 已用事务化一次性 SQL（先 ROLLBACK 预演后 COMMIT）补迁 9 用户 + team 11 的 8 条 inactive 成员关系。
- 已预置源库两场 end_time=start_time 的比赛（end_time 补 +2h），导入器 dry-run 通过：96 插入 + 2 更新、1986 报名、unmapped=0。
- 已正式导入：98 场比赛、1986 条报名；随后删除阿祖临时用户，级联去重 40 条同场重复报名，#38 自有 50 条不变。
- 聚合对账通过：matches 98（5/80/13）、报名 1946（43/970/686/247）与源剔除阿祖后逐值一致；对手 19 真实名 + 79 占位「待定」与源一致；users=29、team 11 成员=29。
- 已清理 /tmp 含个人数据的临时 SQL；`gofmt`、`go vet`、`go build`、`go test -race ./...` 全部通过，未运行前端 E2E。

## 2026-07-16

- 已读取根目录与 Go 子项目的 `AGENTS.md`、`CLAUDE.md`。
- 已确认导入目标为 Go 项目使用的新 PostgreSQL，开始源/目标只读盘点；尚未执行任何数据库写入。
- 已现场确认目标 `teams` 当前有 3 条记录，ID 为 1、2、4；导入必须保留现有数据并避免旧 ID 冲突。
- 源库首次只读检查因系统 Python 缺少 `pymysql` 未启动，尚未验证网络和账号。
- 已使用临时隔离依赖成功只读连接用户指定的 MySQL；表结构查询因返回列名大小写不一致中止，未执行写入。
- 已完成源/目标只读盘点：源 1 支球队、21 条成员；目标已有 3 支球队但尚无用户和成员。
- 当前等待确认本次“球队数据”是否仅指球队主表，或需要连用户与成员关系一起迁移。
- 用户已确认导入成员关系；已核验 21 个关联用户身份字段完整、openid 无重复，队长引用有效。
- 已拉取并 rebase 最新远端成员/队长管理提交；自动暂存恢复冲突已合并，现有未提交改动保持未暂存。
- 已确认新 Go 用户模型不支持真实姓名和手机号，也没有资料维护接口；管理端成员查询/展示同样缺少这两个字段。
- 已核验旧成员基础资料：21 人均有真实姓名，9 人有手机号、12 人为空，非空手机号无重复。
- Task 1 已完成 TDD：用户资料领域规范化与 migration contract 先红后绿，测试容器成功应用 `00003_user_profile.sql`。
- Task 2 已完成：用户资料 PostgreSQL 更新、管理员用例、受保护 HTTP 路由及 bootstrap 装配测试通过。
- Task 3 已完成：登录与球队成员契约包含真实姓名/手机号，候选人可按姓名和手机号搜索，后端测试通过。
- Task 4 已完成：React 成员抽屉可查看/编辑基础资料，type-check、lint、build 和桌面/移动聚焦 E2E 通过。
- Task 5 已完成：事务式 legacy importer 的幂等、dry-run、失败回滚、状态/角色和队长映射测试通过，命令与环境变量文档已补齐。
- 已在真实目标库应用 migration 3；两列均为 nullable character varying，goose 状态为 applied。
- 已完成真实 dry-run 和正式导入：新增 21 用户、1 球队、21 成员，保留目标原有球队。
- 已完成导入后聚合对账：总数 21/2/21，成员状态、角色、队长引用、真实姓名与手机号数量均符合源数据。
- 已修复旧头像裸 Base64 导致浏览器加载失败：importer 补 Data URI 前缀并幂等更新真实库 21 个用户头像。
- 头像专项 importer race 测试、Go vet/build、React type-check/lint 和桌面/移动 Playwright 图片解码断言通过。
- 已开始“洺悦御府”历史比赛迁移，只读盘点源比赛/报名结构和目标 Match 字段差异，尚未写入比赛数据。

## 2026-07-14

- 已建立 `codex/go-match-backend` 隔离 worktree。
- 已完成健康路由 TDD 红灯：失败原因为 `NewRouter` 和 `Dependencies` 不存在。
- 已实现 Gin 最小路由、标准响应 envelope、配置加载和进程入口。
- 已新增 Go 子项目协作文档、本地运行说明和质量门命令。
- 已定位并解决 macOS 26 与旧 Go 1.22.3 工具链不兼容问题，项目改用 Go 1.26.5。
- 验证通过：`make verify`。
- Task 1 验证通过：`make verify`、`go test -race ./...`、`git diff --check`。
- 已确认 `registration_system_rs/` 在 Task 1 保持零 diff。
- 下一步：编写 PostgreSQL schema contract 红灯测试。
- 已在 `local233` 创建独立 PostgreSQL 16 容器和空库 `registration_system_go`，确认本机外部连接可用且 public schema 表数量为 0。
- 已完成 schema contract 红绿循环：红灯为 migration 目录不存在，绿灯为 8 张核心 Match 聚合表与约束存在。
- 已固定 sqlc v1.31.1，生成 auth/team/match/system 四个持久化 adapter 类型包。
- 已在远程开发库应用 goose version 1；核对为 9 张业务表、1 张 goose 版本表。
- Task 2 验证通过：schema 专项测试、`go test ./...`、`go vet ./...`、`git diff --check`。
- 已完成 JWT TDD：用户/超级管理员 Actor 往返和错误签名拒绝测试通过。
- 已完成 Gin auth middleware TDD：用户/管理员路由隔离、缺失 Token 401 和 Actor context 测试通过。
- Task 3 验证通过：`go test -race ./internal/auth/... ./internal/shared/...`、`go vet ./...`。
- 已完成微信登录 use case、真实 jscode2session gateway、用户 sqlc repository 和登录 HTTP adapter。
- 已完成球队最小领域、captain/leader 权限检查、球队 sqlc repository 和“我的球队” HTTP adapter。
- Task 4 验证通过：auth/user/team 全部专项测试、PostgreSQL 容器测试、`go test -race`、`go vet ./...`。
- 已完成 Match domain TDD：三种发布模式、初始报名组、散人默认 8/10、对手名称/坐标/时间不变量测试通过。
- 已完成 Match 创建用例与 PostgreSQL 事务仓储：创建 Match 和初始报名组原子提交，任一报名组写入失败时整体回滚。

## 2026-07-15

- 已确认本地 PostgreSQL 容器 migration version 1 正常，四个核心业务表当前为空。
- 已开始管理员认证与比赛管理闭环，先补领域和应用层失败测试。
- 已新增管理员领域、bcrypt 密码校验、JWT 登录、当前管理员查询和首个管理员初始化命令。
- 已应用 migration version 2，比赛创建来源支持用户或管理员且保持二选一约束。
- 已完成 `/api/admin/auth`、`/api/admin/teams` 和 `/api/admin/matches` 的真实依赖装配与 HTTP 路由。
- 已完成比赛列表、详情、管理员创建、基础信息编辑和状态流转，并通过真实本地数据库接口联调。
- 已完成 React + Ant Design 管理端的登录、受保护路由、比赛列表、详情和发布/编辑页面。
- 已修复登录成功后的双重导航竞态，管理菜单改为语义化 Router 链接。
- 已通过管理端 `type-check`、ESLint、生产构建，以及桌面和移动视口 Playwright E2E；截图未发现遮挡或横向裁切。
- Go 非 PostgreSQL adapter 包已通过 race 测试，`go vet ./...`、API 和 adminctl 本机构建通过。
- 按本地开发只保留一个 PostgreSQL 容器的约束，未运行会额外启动 PostgreSQL Testcontainers 的仓储测试。
- `make run`、migration 和管理员初始化命令已自动加载 `./.env`；本机 Go API 通过 `127.0.0.1:5432` 连接 PostgreSQL 容器。
- 已完成场馆管理员创建和列表：仅数据库中当前角色为 `super_admin` 的管理员可访问 `/api/admin/admins`，创建角色固定为普通 `admin`。
- 普通场馆管理员已通过真实接口验证：可以访问比赛管理和发布比赛，但管理员列表与创建均返回 403。
- React 管理端仅对超级管理员显示“场馆管理员”入口，桌面与移动端创建流程 E2E 和截图验收通过。
- 已完成比赛列表取消与永久删除：普通管理员可取消报名中/进行中比赛，只有超级管理员可硬删除任意状态比赛。
- 硬删除使用现有 PostgreSQL 级联外键原子清理报名组、报名记录和球队申请；四种比赛状态和关联数据已通过真实接口联调。
- 已完成管理端球队 CRUD：所有管理员可查询完整列表和详情、创建、编辑名称/简介/状态，并永久删除未进入比赛业务的球队。
- 球队一旦被比赛、报名组或球队申请引用，删除会返回 409，不会级联破坏比赛数据；队员关系仍按现有外键随球队删除。
- React 管理端新增球队管理菜单、筛选表格、详情抽屉和增删改弹窗；桌面与移动端 E2E、截图及真实 Go 列表/详情接口验证通过。
- 发布比赛的主队选择支持快速创建：输入不存在的队名后保存会弹出确认，确认后以空简介创建球队、自动选中并继续提交比赛。
- Go 后端已新增球队成员列表、候选人搜索、添加、更新、移除和队长设置接口；队长角色只能通过专门接口变更。
- 设置队长使用单条 PostgreSQL CTE 原子降级旧队长、升级新队长并更新球队；冻结成员不能成为队长，失败不会改变原队长。
