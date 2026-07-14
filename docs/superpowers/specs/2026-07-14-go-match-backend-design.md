# Go 比赛后端设计

## 1. 目标

在工作区新增 `registration_system_go/`，使用 Go 和 PostgreSQL 实现新的后端。新后端继续遵守按业务模块组织的六边形架构，第一阶段优先交付完整的比赛发布与报名闭环。

现有 `registration_system_rs/` 只作为业务行为和数据迁移参考：不删除、不修改、不继续增加功能。

第一阶段包含：

- 微信登录与 JWT 鉴权；
- 用户基础资料；
- 球队、队员以及队长/领队角色查询；
- 三种比赛发布模式；
- 球队候选申请、发布方选择和被选球队退出；
- 发布球队、被选球队的独立队内报名；
- 散人对手报名；
- 管理后台的散人默认人数配置和逐场调整；
- 从旧 PostgreSQL 数据库迁移到新数据库的工具和校验。

第一阶段不包含订单、支付、账单、结算、签到和通知。这些能力在比赛闭环稳定后按独立设计补充。

## 2. 技术选型

- Go；
- `gin-gonic/gin`：HTTP 路由、中间件和请求绑定；
- `pgx`：PostgreSQL 驱动和连接池；
- `sqlc`：从 SQL 生成类型安全的查询代码；
- `goose`：数据库迁移；
- OpenAPI + `oapi-codegen`：接口契约和 DTO 生成；
- `slog`：结构化日志；
- `testing` + `testcontainers-go`：单元、集成和 PostgreSQL 测试。

不使用重型 ORM。SQL 以模块为单位维护，生成代码只允许出现在持久化适配器内。

## 3. 六边形架构

项目按业务模块组织，而不是建立全局 `handlers/services/repositories` 大目录：

```text
registration_system_go/
  cmd/api/main.go
  api/openapi.yaml
  db/migrations/
  db/queries/
  internal/bootstrap/
  internal/shared/
  internal/auth/
    domain/
    application/
    ports/
    adapters/http/
    adapters/postgres/
    adapters/wechat/
  internal/user/
    domain/
    application/
    ports/
    adapters/http/
    adapters/postgres/
  internal/team/
    domain/
    application/
    ports/
    adapters/http/
    adapters/postgres/
  internal/match/
    domain/
    application/
    ports/
    adapters/http/
    adapters/postgres/
  internal/system/
    domain/
    application/
    ports/
    adapters/http/
    adapters/postgres/
  tools/legacy-migrate/
```

依赖规则：

- `domain` 只包含实体、值对象、状态和业务不变量，不依赖 HTTP、PostgreSQL、`sqlc` 或微信 SDK；
- `application` 编排用例、权限和事务语义，只依赖 `domain` 与 `ports`；
- `ports` 定义仓储、Token、微信网关、球队访问检查和事务能力；
- `adapters/http` 负责认证入口、DTO 转换、参数校验和响应映射；
- `adapters/postgres` 负责 `pgx/sqlc`、数据库 model 与事务实现；
- `bootstrap` 负责配置、依赖注入和路由装配；
- `match` 模块需要球队信息时依赖自己定义的 `TeamAccessPort`，由 team/postgres 适配器实现，不直接依赖 team 的数据库实现。

Gin 只允许出现在 `adapters/http` 和 `bootstrap`：

- `gin.Context` 不得进入 application、domain 或 ports；
- handler 将请求绑定为 HTTP DTO，再显式转换为 application command/query；
- application 返回业务结果和业务错误，由 handler 统一映射为 HTTP 状态码与响应；
- handler 不直接调用 `sqlc`、`pgx` 或持久化 adapter；
- `/api` 与 `/api/admin` 使用独立 Gin Route Group 和独立鉴权中间件，路径本身就是权限边界。

## 4. 核心领域模型

### 4.1 Match

`Match` 是唯一比赛聚合根。所有发布模式在创建时立即生成一个 Match，并在整个生命周期中保持同一个 ID。

`publication_mode`：

- `offline_confirmed`：线下已经约好对手；
- `online_team`：线上招募球队对手；
- `online_individual`：线上招募散人组成对手阵容。

`opponent_state`：

- `no_recruitment`：线下已经约好，不需要招募；
- `recruiting`：正在招募球队或散人；
- `confirmed`：球队对手已选定，或散人已达到最少成行人数。

比赛执行状态独立于对手状态：

- `registering`；
- `ongoing`；
- `ended`；
- `cancelled`。

### 4.2 TeamApplication

仅用于 `online_team`。候选球队由队长或领队提交申请，申请必须包含本次申请专用的文字介绍，说明球队风格和年龄结构。

状态：

- `pending`；
- `selected`；
- `rejected`；
- `withdrawn`。

同一球队对同一比赛同一时间只能存在一条有效申请。

### 4.3 RegistrationGroup

一场比赛通过报名组区分阵营，不再复制比赛记录。

组类型：

- `host_team`：发布球队；
- `guest_team`：被选中的对手球队；
- `individual_opponent`：散人组成的对手阵容。

状态：

- `open`；
- `closed`；
- `cancelled`。

每个报名组独立保存 `min_players` 和 `max_players`。队内报名的上限可以为空，表示不限；发布方在创建时设置本队上限，被选球队的队长或领队在入选后设置本队上限。

散人对手组始终固化有效的最少和最多人数：

- 优先使用管理后台按赛制配置的默认值；
- 未配置时使用 `min = players_per_team`、`max = players_per_team + 2`；
- 小程序发布者不可修改；
- 管理员可以逐场调整；
- 后续修改系统默认值不反向改变已发布比赛。

### 4.4 MatchRegistration

报名记录必须归属一个 RegistrationGroup，从而明确用户属于主队、客队还是散人对手。

发布球队的现役队员不能报名到同一场比赛的散人对手组。被选球队只有在入选并创建 `guest_team` 报名组后才能开始报名。

## 5. 三种发布流程

### 5.1 线下已经约好

1. 队长或领队创建 `offline_confirmed` Match；
2. 必须填写对手名称、场地和比赛时间；
3. 创建并立即开放 `host_team` 报名组；
4. 仅发布球队现役队员可报名；
5. 本队报名上限可设置，也可为空。

### 5.2 线上约球队

1. 队长或领队创建 `online_team` Match；
2. Match 立即进入 `opponent_state=recruiting`；
3. 创建并立即开放发布球队的 `host_team` 报名组；
4. 其他球队的队长或领队提交候选申请和必填球队介绍；
5. 发布方查看所有候选并选择一支；
6. 一个事务内完成：设置 `away_team_id`、标记选中申请、拒绝其他申请、创建并开放 `guest_team` 报名组、设置 `opponent_state=confirmed`；
7. 被选球队此时才开放本队队内报名。

被选球队赛前退出时：

1. 将被选申请改为 `withdrawn`；
2. 将客队报名组改为 `cancelled`；
3. 客队报名记录保留并改为取消状态，不物理删除；
4. 清空 `away_team_id`；
5. 设置 `opponent_state=recruiting`；
6. 保留发布球队报名组和已有报名；
7. 原先被拒绝的申请不自动恢复，需要球队重新申请。

### 5.3 线上约散人

1. 队长或领队创建 `online_individual` Match；
2. 创建并开放发布球队的 `host_team` 报名组；
3. 创建并开放 `individual_opponent` 报名组；
4. 从系统配置解析并固化散人组的最少和最多人数；
5. 散人用户逐个报名；
6. 达到最少人数时设置 `opponent_state=confirmed`，但报名组继续开放；
7. 达到最多人数时关闭报名组；
8. 报名人数因取消而低于最少人数时，比赛重新变为 `opponent_state=recruiting`。

## 6. 权限

- 只有球队队长和领队可以发布比赛；
- 只有候选球队队长和领队可以提交或撤回球队申请；
- 只有发布球队队长和领队可以查看全部候选并选择对手；
- 只有被选球队队长和领队可以设置本队报名上限或发起退出；
- 队内报名必须校验用户是对应球队的现役成员；
- 散人报名不能使用发布球队的现役成员身份；
- 管理端逐场修改散人人数规则必须使用管理员身份，普通管理权限和超级管理员权限沿用后续统一的后台授权模型。

## 7. API 设计

新接口不兼容旧 `/api/activity/**` 和 `/api/challenges/**`。Go 后端、小程序和管理后台在同一个版本切换。

用户端标准接口：

```text
POST   /api/matches
GET    /api/matches
GET    /api/matches/{match_id}
PATCH  /api/matches/{match_id}

POST   /api/matches/{match_id}/team-applications
GET    /api/matches/{match_id}/team-applications
POST   /api/matches/{match_id}/team-applications/{application_id}/select
POST   /api/matches/{match_id}/guest-team/withdraw

PATCH  /api/matches/{match_id}/my-registration
PATCH  /api/matches/{match_id}/registration-groups/{group_id}/capacity
```

管理端使用独立 Router：

```text
GET    /api/admin/matches
GET    /api/admin/matches/{match_id}
PATCH  /api/admin/matches/{match_id}
PATCH  /api/admin/matches/{match_id}/individual-registration-limits

GET    /api/admin/system/match-registration-defaults
PUT    /api/admin/system/match-registration-defaults/{players_per_team}
```

创建比赛请求使用 `publication_mode` 作为判别字段。不同模式不允许携带相互冲突的字段：

- `offline_confirmed` 必须有 `opponent_name`；
- `online_team` 和 `online_individual` 不接受手工对手名称；
- `online_individual` 不接受小程序传入的 `min_players/max_players`。

错误语义：

- `401`：未登录或 Token 无效；
- `403`：不是队长/领队、不是对应球队成员或没有后台权限；
- `404`：比赛、候选申请或报名组不存在；
- `409`：重复申请、对手已选定、报名已满或当前状态不允许操作；
- `422`：发布模式字段冲突、球队介绍为空或人数规则无效。

## 8. 数据库

新数据库使用清晰的新表名，不沿用 `rs_activity` 命名：

```text
users
teams
team_members
matches
match_registration_groups
match_registrations
match_team_applications
match_registration_defaults
```

其他第一阶段认证与系统配置表按对应模块创建。

关键约束：

- `matches.publication_mode`、`opponent_state` 和执行状态使用 CHECK 约束；
- 报名组人数必须为正，且 `min_players <= max_players`；
- `host_team/guest_team` 报名组必须有 `team_id`；
- `individual_opponent` 报名组不能有 `team_id`；
- 同一比赛最多一个有效的 host、guest 和 individual 报名组；
- 同一用户在同一报名组最多一条有效报名；
- 同一候选球队在同一比赛最多一条有效申请；
- 主队和客队不能相同。

## 9. 并发与事务

- 选择候选时锁定 Match 和候选申请，保证只能选中一支球队；
- 散人报名时锁定报名组并在事务内统计有效人数，只有达到 `max_players` 才拒绝新报名；
- 散人取消报名时在同一事务内重新计算 `opponent_state` 和报名组状态；
- 被选球队退出的状态变化、报名取消和重新开放招募必须在一个事务内完成；
- application 层表达原子用例，postgres adapter 实现事务，不向 domain 泄漏 `pgx.Tx`。

## 10. 旧库迁移

Go 使用独立的新 PostgreSQL 数据库。`tools/legacy-migrate` 只读旧库、写入新库，并支持重复演练。

迁移顺序：

1. 用户；
2. 球队和成员角色；
3. 直接创建的比赛；
4. 球队约队及已生成比赛；
5. 散人约队和散人报名；
6. 原有派生活动与球队报名关系。

映射原则：

- 直接创建且已有手工对手的活动映射为 `offline_confirmed`；
- 球队约队映射为 `online_team`，复用已存在的比赛 ID；
- 尚未生成活动的球队约队创建对应 Match，并立即创建发布方报名组；
- 散人约队映射为 `online_individual` Match 和散人对手报名组；
- `rs_challenge_individual_acceptances` 映射为散人对手报名；
- 原有派生活动合并为同一 Match 下的球队报名组；
- 无法可靠确定 Match、球队或报名组的数据必须使迁移失败，不允许静默猜测。

每次迁移演练输出：

- 源表和目标表数量；
- 按业务类型分类的数量；
- 未映射记录；
- 重复关系；
- 外键完整性；
- 关键金额之外的第一阶段业务字段校验结果。

第一阶段不迁订单、支付、账单、结算、签到和通知数据。旧库继续保留，供后续模块迁移使用。

## 11. 测试策略

- domain：三种发布模式、状态转换和人数默认规则的表驱动测试；
- application：权限、发布方立即报名、候选未选中不可报名、选中后开放、退出后重新招募；
- postgres：候选唯一选择、散人并发容量、事务回滚和 CHECK/唯一约束；
- HTTP：OpenAPI 合约、鉴权、错误码和 admin/app 路由隔离；
- migration：固定旧库 fixture、数量对账、重复执行和失败回滚；
- 小程序：类型检查、相关页面测试、`build:mp-weixin`；
- 管理端：类型检查、测试和构建；
- Go：`go test ./...`、`go vet ./...`，并在 CI 中校验 `sqlc` 与 OpenAPI 生成文件无漂移。

所有业务行为修改按 TDD 执行：先写失败测试，确认失败原因正确，再实现最小代码并运行专项与全量验证。

## 12. 上线方式

- Rust 服务在开发期间保持只读参考，不接收本项目改动；
- Go 服务、新数据库、小程序和管理后台作为一个版本发布；
- 上线前至少执行一次全量迁移演练和一次预发布环境切换；
- 正式切换时停止旧服务写入，执行最终增量迁移与对账，再启动 Go 服务；
- 不保留旧 API 兼容路由；
- 旧数据库和 Rust 服务在观察期内保留但只读，后续模块迁移继续使用。
