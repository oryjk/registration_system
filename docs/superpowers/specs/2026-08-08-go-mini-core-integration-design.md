# 小程序接入 Go 后端核心闭环设计

## 1. 背景与决策

`registration_system_mini/` 是唯一的小程序/H5 用户端代码库。`mini-rust-backend-final` 标记最后一个对接 Rust 后端的基线；从该 tag 之后，`main` 只面向 `registration_system_go/` 演进，不在同一构建或运行实例中混用 Rust 与 Go 接口。

迁移期间不再发布 Rust 版本。若旧版本确有维护需要，应从 `mini-rust-backend-final` 另开维护分支，不把 Rust 兼容代码带回 Go 接入主线。

第一版采用“核心闭环优先”策略，交付微信/H5 登录、用户和球队身份、比赛浏览、个人报名与整队候选流程。账单、支付、签到、通知等 Go 第一阶段明确不承载的领域暂不接入。

## 2. 目标与非目标

### 2.1 目标

- 将小程序和 H5 的业务请求统一切换到 Go 后端。
- 使用带版本号且按调用端隔离的 API 路径。
- 通过微信 OpenID 继承现有用户身份、球队成员关系和权限。
- 复用并增强现有迁移工具，对 Rust 数据源只读执行增量或全量对账导入。
- 在 H5 开发/测试环境提供可选择用户的测试登录，默认用户为 Go 用户 `37`（王睿）。
- 完成比赛首页、列表、详情、个人报名和整队候选的用户端闭环。
- 在每一阶段维持后端测试、前端类型检查和构建可执行。

### 2.2 非目标

- 不修改 `registration_system_rs/` 的代码、表结构或数据。
- 不保留 Rust/Go 双后端运行时切换或按领域混合调用。
- 不在第一版实现账单、支付、充值、签到、通知、球队积分和结算。
- 不为兼容 Rust 接口而在 Go 领域层复制旧 `activity` 或 `challenge` 模型。
- 不设计 Go 到 Rust 的反向同步、双写或上线回退流程。
- 不在本次接入中重做小程序视觉设计或无关页面结构。

## 3. API 命名与隔离

业务 API 统一使用以下根路径：

```text
/api/v1/app/*      小程序与 H5 用户端
/api/v1/admin/*    运营管理端
```

`/health` 是基础设施探针，保持无版本号。其他业务接口不再提供 `/api/*` 或 `/api/admin/*` 的无版本别名。

Go 路由必须建立独立的 app 和 admin 路由组，并分别挂载用户 JWT 与管理员 JWT 中间件。用户 JWT 不得访问管理端接口，管理员 JWT 也不得直接作为 app 用户身份。领域对象可以复用，但 app 与 admin 的 HTTP request/response DTO 分开定义。

修改 Go 路由时必须同步迁移 `registration_system_backend_fe_go/` 的所有接口地址、路由测试和 README，不能让管理端停留在旧路径。根目录、`registration_system_go/`、`registration_system_mini/` 和 `registration_system_backend_fe_go/` 的 `AGENTS.md` 也必须同步改成 V1 路径，确保实现者不会同时面对互相冲突的仓库规则。

### 3.1 API base URL 契约

两个前端的 base URL 都定义为“已经包含版本和调用端前缀的完整 API 根地址”：

```text
小程序/H5 VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app
Go 管理端 ADMIN_API_BASE_URL=/go-api/api/v1/admin
```

小程序 `requestApi` 和管理端 client 只拼接 `/auth/...`、`/matches/...` 等领域相对路径，不再自行追加 `/api`、`/v1`、`/app` 或 `/admin`。配置层去掉末尾 `/`，领域路径必须以单个 `/` 开头，并拒绝再次传入 `/api/` 开头的路径，避免重复前缀。

小程序开发模式缺少 `VITE_API_BASE_URL` 时可回退到 `http://127.0.0.1:18080/api/v1/app`；production 构建缺失或路径不以 `/api/v1/app` 结尾时由 prebuild 校验直接失败。Go 管理端缺少 `ADMIN_API_BASE_URL` 时使用同源 `/api/v1/admin`，显式配置时必须以 `/api/v1/admin` 结尾。

`/health` 不使用业务 API base：管理端健康检查通过独立的 health URL helper 请求部署 origin/prefix 下的 `/health`。绝对 URL 只允许由 `requestRaw` 的明确调用者使用。

### 3.2 第一版 app 接口

```text
POST   /api/v1/app/auth/wechat/login
GET    /api/v1/app/users/me
PATCH  /api/v1/app/users/me

GET    /api/v1/app/teams/my
GET    /api/v1/app/teams/:id
GET    /api/v1/app/teams/:id/members

GET    /api/v1/app/matches/home
GET    /api/v1/app/matches?scope=all|mine
GET    /api/v1/app/matches/:id
PUT    /api/v1/app/matches/:id/groups/:group_id/my-registration
DELETE /api/v1/app/matches/:id/groups/:group_id/my-registration

GET    /api/v1/app/matches/:id/team-applications
POST   /api/v1/app/matches/:id/team-applications
POST   /api/v1/app/matches/:id/team-applications/:application_id/select
POST   /api/v1/app/matches/:id/team-applications/:application_id/withdraw
```

`PUT .../my-registration` 是幂等创建或更新；`DELETE` 幂等取消当前用户在指定报名组中的报名。后端负责比赛状态、报名组状态、身份资格、人数限制、重复请求和状态转换校验，完整规则见第 8.1 节。

第一版 `PATCH /users/me` 允许维护昵称和真实姓名。`avatar_url`、手机号随登录和迁移结果返回，但头像上传和微信手机号绑定需要独立外部能力，不纳入本次核心接入。

### 3.3 新增接口 DTO

微信登录、H5 测试登录和当前用户接口统一返回同一个用户形状：

```text
AppUser {
  id: int64
  nickname: string
  avatar_url: string | null
  real_name: string | null
  phone_number: string | null
  status: "active" | "frozen"
}

LoginResponse { token: string, user: AppUser }
UpdateMeRequest { nickname?: string, real_name?: string }
```

`PATCH /users/me` 至少提供一个字段；两个字段去除首尾空白后最多 120 个字符。空字符串表示清空对应可选资料。响应为更新后的 `AppUser`。

球队接口使用以下形状：

```text
MyTeam {
  id: int64
  name: string
  description: string | null
  logo_url: string | null
  role: "captain" | "leader" | "vice_captain" | "member"
  joined_at: RFC3339 string
}

AppTeamDetail {
  id: int64
  name: string
  description: string | null
  logo_url: string | null
  captain_id: int64 | null
  status: "active" | "frozen"
  my_role: MyTeam.role
}

AppTeamMember {
  user_id: int64
  nickname: string
  avatar_url: string | null
  real_name: string | null
  role: MyTeam.role
  status: "active" | "inactive"
  joined_at: RFC3339 string
}
```

`GET /teams/:id` 和 `/teams/:id/members` 只允许该队 active 成员访问；非成员返回 `403`，球队不存在返回 `404`。成员列表不返回 OpenID 和手机号。比赛页需要的主客队名称继续直接来自 Match DTO，不通过放宽球队详情权限获取。

`AppTeamMember.user_id` 明确是 `users.id`，与 `AppTeamDetail.captain_id` 使用同一 ID 空间；用户端 DTO 不暴露 `team_members.id`。

H5 测试接口使用以下形状：

```text
TestLoginTeam { id: int64, name: string, role: MyTeam.role }
TestLoginUser {
  id: int64
  display_name: string
  avatar_url: string | null
  teams: TestLoginTeam[]
}
TestLoginUsersResponse { items: TestLoginUser[], default_user_id: int64 }
TestLoginRequest { user_id: int64 }
```

测试登录成功响应为 `LoginResponse`。列表只包含 active 用户，按 ID 升序返回。

`display_name` 取去除首尾空白后的非空 `real_name`，否则取非空 `nickname`，两者都为空时使用 `用户 #<id>`。前端直接展示该字段，不再重复推导。

个人报名接口使用：

```text
MyRegistrationRequest {
  status: "attending" | "leave" | "absent"
  registration_count: 1
}
MyRegistrationResponse {
  group_id: UUID string
  user_id: int64
  status: "attending" | "leave" | "absent" | "cancelled"
  registration_count: 1
  updated_at: RFC3339 string
}
```

`PUT` 和 `DELETE` 都返回最新的 `MyRegistrationResponse`。第一版用户端固定 `registration_count=1`，不开放代报多人；迁移进来的历史记录可以保留大于 1 的计数，但用户重新提交后按第一版规则写为 1。

`GET /matches` 的 `scope` 默认为 `all`。`scope=mine` 返回以下集合的并集并按现有分页规则分页：当前用户存在非 cancelled 报名的比赛，以及当前用户作为 active 成员所属球队担任主队或已选客队的比赛。它可以继续与 `status`、`search`、`page`、`page_size` 组合；非法 scope 返回 `422`。`pages/user/matches/index` 必须使用 `scope=mine`，不能在全量列表上做不完整的前端过滤。

## 4. 响应与错误契约

所有 app 和 admin API 使用现有 Go envelope：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

成功时 `code` 为 `0`。错误同时使用正确 HTTP 状态码，并在 envelope 中返回同值 `code`：

| HTTP/code | 含义 | 客户端行为 |
| --- | --- | --- |
| `401` | 未登录或 Token 无效 | 当前运行状态进入待重新登录，不循环自动登录 |
| `403` | 已登录但无权限 | 保留会话并展示无权限提示 |
| `404` | 资源不存在 | 展示明确的资源失效状态 |
| `409` | 状态机或并发冲突 | 刷新相关数据并提示用户重新确认 |
| `422` | 输入不合法 | 展示后端可公开的校验信息 |
| `500` | 服务内部异常 | 展示通用错误，不暴露内部细节 |

协议解析只存在于小程序请求层。页面接收领域 API 返回值或统一的 `ApiRequestError`，不得自行解释 envelope。

## 5. 小程序前端边界

### 5.1 配置与请求层

- `src/config/apiBase.ts` 按第 3.1 节解释 `VITE_API_BASE_URL`，该值必须包含 `/api/v1/app`。
- `src/utils/request.ts` 统一解析 Go `{ code, message, data }`，处理 HTTP、业务和网络错误。
- `requestRaw` 仅用于确实需要原始响应的场景；普通领域 API 使用统一 `requestApi`。
- Rust 的 `{ success, message, data }` 假设从 Go 接入路径中删除。

### 5.2 API 与类型

- `src/api/` 继续按 `auth`、`user`、`team`、`match` 等领域拆分。
- 页面不得直接拼接 URL 或把 Rust 路径包装成伪兼容接口。
- Go 字符串枚举和页面展示状态通过 API 类型及 view model 映射。
- Rust 数字状态不得在页面中继续作为 Go 状态使用。

### 5.3 页面职责

- 页面只编排生命周期、加载状态、导航、表单状态和组件事件。
- 后端 DTO 到页面模型的转换放在 `src/utils/viewModels.ts` 或页面局部 state 文件。
- 多接口提交动作放在页面局部 actions 文件，原子请求仍留在 `src/api/`。
- 第一版不重写视觉样式，仅调整接口调用、状态映射和功能入口。

### 5.4 页面与导航收口矩阵

第一版保留四个底部 Tab，但改变其中两个页面的业务含义：

| 路径 | 第一版处理 | 数据来源与直接访问行为 |
| --- | --- | --- |
| `pages/home/index` | 保留并改接 Go 首页 | `/matches/home`；删除 challenge、runtime config、通知等 Rust 请求 |
| `pages/activities/index` | 保留路径，标题和 Tab 文案改为“比赛” | 改为 Go 比赛大厅，使用 `/matches` 和整队候选接口 |
| `pages/teams/index` | 保留路径，标题和 Tab 文案改为“球队” | 展示当前球队资料和成员；无球队时展示空状态 |
| `pages/user/index` | 保留并精简 | 仅展示用户、球队身份和 Go 比赛摘要，不请求钱包、通知、积分或出勤 |
| `pages/home/matches/index` | 保留 | Go 比赛列表 |
| `pages/user/matches/index` | 保留 | 按当前用户关系筛选 Go 比赛，不提供创建/编辑入口 |
| `pages/matches/detail` | 保留 | Go Match 详情、个人报名和整队候选 |
| `pages/profile/setup/index` | 保留并精简 | 只维护昵称和真实姓名 |
| `pages/teams/manage/index` | 从 `pages.json` 移除 | 第一版无用户端球队管理写接口；所有入口删除 |
| `pages/matches/create/index` | 从 `pages.json` 移除 | 所有创建/编辑入口删除 |
| `pages/challenges/detail` | 从 `pages.json` 移除 | 约队语义已合并进 Go Match |
| `pages/challenges/create-individual/index` | 从 `pages.json` 移除 | 第一版不开放比赛发布 |
| `pages/notifications/index` | 从 `pages.json` 移除 | 所有入口、角标和后台请求删除 |
| `pages/billing/index` | 从 `pages.json` 移除 | 所有入口和后台请求删除 |

底部中间“创建”按钮及其菜单在第一版整体移除。原来的四个 Tab 变为“首页 / 比赛 / 球队 / 我的”，并同步修改原生 `tabBar` 与自定义 `BottomTabBar`。

被移除页面不再注册为 uni-app 页面；H5 对未知旧路径统一重定向首页，小程序旧分享卡片或收藏进入不存在页面时使用平台默认不可用提示，不再执行任何页面脚本。仍保留在源码中的旧 API 文件必须没有页面、store 或组件引用；最终通过静态搜索和构建产物请求检查确认没有 Rust 业务调用。

## 6. 认证与会话

### 6.1 微信登录

```text
uni.login
  -> 获取 js_code
  -> POST /api/v1/app/auth/wechat/login
  -> Go 调用微信 code2session
  -> 按 openid 查找已迁移用户或创建真实新用户
  -> 返回 token 与 user
  -> 保存 Go JWT
  -> GET /api/v1/app/teams/my
  -> 建立个人/球队身份上下文
```

Rust JWT 和现有缓存不做上线前主动清理。Go 版本使用旧 Token 请求 `/users/me` 时会收到 `401`，小程序据此进入重新登录状态；登录成功后用 Go JWT 覆盖原 Token。切换通知要求所有用户重新登录一次。

### 6.2 会话恢复

- 有 Token 时先请求 `GET /users/me`，成功后再加载 `/teams/my`。
- `401` 进入待登录状态，不反复自动调用微信登录。
- 冻结或已不存在的用户即使持有尚未过期的 JWT，也会被 app 鉴权守卫在所有受保护接口统一拒绝为 `401`。
- `403` 只表示 active 用户已登录但没有目标资源或操作权限。
- 网络错误保留 Token，并提供重试，不能按登录过期处理。
- 复用单例 bootstrap promise，避免多个页面并发触发登录。
- 继续使用 session version 防止退出后在途请求回写会话。
- 缓存可用于登录前展示，但不能作为鉴权或提交依据。
- 重新获取球队后校验缓存的当前球队；不存在时回退到个人身份或第一支有效球队。
- 队长、领队和成员权限以后端响应为准，不由页面猜测。

## 7. H5 测试登录

H5 开发/测试环境提供以下接口：

```text
GET  /api/v1/app/test-auth/users
POST /api/v1/app/test-auth/login
```

用户列表响应和登录请求使用第 3.3 节 DTO。列表不返回 OpenID、手机号或其他敏感身份字段。`POST` 仅允许为 active 用户签发与微信登录相同类型的用户 JWT。

默认测试用户配置为 Go 用户 `37`（王睿，洺悦御府队长）。H5 登录界面默认选中该用户，同时允许从接口返回的有效用户列表中切换。

后端配置规则：

- `APP_ENV` 只允许 `development`、`test`、`production`，缺失或其他值一律按 `production` 处理；
- 只有 `APP_ENV` 明确为 `development` 或 `test`，且 `ENABLE_H5_TEST_LOGIN=true` 时注册测试路由；
- `H5_TEST_DEFAULT_USER_ID=37` 指定默认用户；
- 生产环境不注册测试路由，调用结果为 `404`。

测试路由启用后，`GET /test-auth/users` 必须确认默认用户存在且为 active；用户 37 缺失或冻结时返回配置错误 `500`，不静默选择其他用户。`POST` 对不存在用户返回 `404`，对冻结用户返回 `403`。

前端仅在 H5 平台、Vite 非 production mode 且 `VITE_ENABLE_H5_TEST_LOGIN=true` 三个条件同时满足时展示测试登录入口。微信小程序构建和任何 production mode 的 H5 构建不显示该入口。前后端开关必须同时满足，不能只依赖前端隐藏。

## 8. Go 后端模块边界

- `auth`：微信 code 和 H5 测试身份换取、JWT 签发/解析、Actor 类型隔离；不承载用户资料 use case。
- `user`：用户仓储、active/frozen 状态、`GET/PATCH /users/me` 和管理端资料维护。auth 登录通过 user port 查找或创建用户，app 鉴权守卫通过窄的 active-user port 校验 Actor 对应账号。
- `team`：我的球队、用户可见球队详情、成员列表及角色权限。
- `match`：首页、列表、详情、个人报名和整队候选状态机。
- `migration`：读取旧数据源、建立稳定映射、转换和写入 Go 数据库。
- `bootstrap`：组装 `/api/v1/app`、`/api/v1/admin` 路由与环境开关。

Gin、HTTP DTO 和状态码只存在于 adapters/http 与 bootstrap。业务权限和状态转换位于 application/domain；SQL、pgx 和 sqlc 只存在于 adapters/postgres 和迁移基础设施。所有受保护 app 路由在解析 JWT 后都执行 active-user 校验，不能只在 `/users/me` 或写接口零散检查。

### 8.1 个人报名状态机

报名规则沿用现有《Go 比赛参与模型》，并固定以下用户端行为：

- 只有 `match.status=registering` 时可以新建或改变报名；`ongoing`、`ended`、`cancelled` 只读。
- `unknown` 只用于历史迁移，用户端不能主动提交。
- `host_team` 和 `guest_team` 组只允许该组球队的 active 成员本人提交 `attending`、`leave` 或 `absent`。
- `guest_team` 只有在候选球队被选中且有效客队组已经创建后才允许报名。
- `individual_opponent` 只允许提交 `attending`，且主队 active 成员不能报名本场散人对手组。
- 同一用户在同一场 Match 最多有一个非 cancelled 报名，不能跨报名组同时占位。
- 第一版所有新提交的 `registration_count` 固定为 1。有效容量为组内 `status=attending` 的 `registration_count` 之和；`leave`、`absent`、`cancelled` 不占容量。
- 队内报名组有 `max_players` 时使用同一容量算法；无上限时不做满员拒绝。
- 散人组达到 `max_players` 后关闭；已有报名者仍可取消。取消后低于上限时重新开放，低于 `min_players` 时 Match 回到 `opponent_state=recruiting`。
- 没有记录或已 cancelled 的用户可以重新报名；同一个合法 `PUT` 重复提交返回当前记录，不重复占容量。
- active 队内报名可在 `attending`、`leave`、`absent` 间转换。散人报名只能保持 `attending` 或通过 `DELETE` 取消。
- `DELETE` 将现有记录改为 `cancelled`；重复 `DELETE` 返回同一 cancelled 结果，不报错。用户从未在该组产生报名记录时返回 `404`，不创建空的 cancelled 记录。
- 用户失去球队成员资格后不能新建或更新该球队组报名，但仍可取消自己已有的非 cancelled 报名；取消权限只校验记录所有者，不要求当前仍是球队成员。
- 新报名遇到关闭/取消组、满员或比赛状态变化返回 `409`；身份不符合返回 `403`；请求状态或计数不合法返回 `422`。
- 报名行、跨组唯一性检查、容量统计、组开关和 Match 对手状态重算必须在同一数据库事务内完成，并锁定相关 Match/组以解决并发满员竞争。

## 9. 数据迁移

### 9.1 现有基础

继续使用并增强：

- `cmd/importlegacyteams` 与 `internal/migration/legacyteams`；
- `cmd/importlegacymatches` 与 `internal/migration/legacymatches`。

不创建第二套通用迁移框架。现有 dry-run、目标事务和失败回滚行为必须保留。

### 9.2 只读源边界

- 迁移工具对 Rust/旧数据源只执行 `SELECT`。
- PostgreSQL 源读取使用只读事务，源账号采用只读权限。
- 所有映射和业务写入只发生在 Go 数据库。
- 日志和报告不输出 OpenID、手机号、连接串或真实密钥。

### 9.3 稳定映射

Go 数据库新增仅供迁移基础设施使用的 `legacy_import_mappings`：

```text
source_system       来源标识
entity_type         user/team/match/registration 等实体类型
source_id           旧实体稳定主键
target_id           Go 目标主键的文本表示，兼容 BIGINT 与 UUID
source_updated_at   源记录更新时间
source_fingerprint  参与迁移字段的摘要
target_fingerprint  上次由迁移器成功写入后的目标字段摘要
fingerprint_version 摘要格式版本，第一版固定为 1
migrated_at         最近成功迁移时间
```

`(source_system, entity_type, source_id)` 唯一。映射表不进入用户、球队或 Match 领域对象，也不通过业务 API 暴露。

`source_system` 固定使用 `legacy_mysql`（现有球队/成员导入源）和 `legacy_postgres`（Rust PostgreSQL 的活动/报名源），不允许命令调用者随意填写新名称。

匹配优先级固定为：已有映射表记录、受版本控制的显式旧 ID 到目标 ID 配置、确定性自动匹配。低优先级结果不得覆盖高优先级映射，任一级发现目标不存在或一对多都中止。

逐实体自动匹配键为：

| 实体 | `source_id` | 首次补映射的确定性匹配 |
| --- | --- | --- |
| user | 旧用户主键 | 标准化后唯一且非空的 OpenID |
| team | 旧球队主键/`legacy_id` | 默认要求显式映射；只有目标中“规范化名称 + 已映射队长 + 已映射成员集合”唯一一致时才允许自动匹配 |
| membership | `team_source_id:user_source_id` | 已映射球队 + 已映射用户组成的唯一 `team_members` 记录 |
| match | 旧 `rs_activity.id` | 已映射主队 + 精确 `start_time` + 规范化名称唯一一致 |
| registration | `activity_source_id:postgres_user_source_id` | 已映射 Match 的报名组 + 已映射 PostgreSQL 用户唯一一致 |

同一自然人在两个旧源中分别建立 user mapping：`legacy_mysql` 用户按 MySQL 用户主键映射，`legacy_postgres` 用户按 `rs_user_info.id` 映射；两个源都通过唯一 OpenID 指向同一个 Go `users.id`。比赛 source 查询必须同时读取 PostgreSQL 用户主键和 OpenID，先补齐/校验 `legacy_postgres:user` 映射，再创建 registration mapping，不能拿 MySQL 用户主键拼 PostgreSQL 报名 ID。

membership mapping 的 `target_id` 保存 `team_members.id`。每次导入或首次补映射时，成员业务 upsert 与 mapping 写入同一事务；authoritative full 只允许把存在 `legacy_mysql:membership` mapping 的关系认定为 source-owned。

业务实体 upsert、源/目标摘要计算和映射行写入必须位于同一个目标事务。对于已有映射：

- 源摘要和目标摘要均未变化：跳过；
- 只有源摘要变化：应用更新并同时刷新两个摘要；
- 只有目标摘要变化：保留 Go 人工修改，报告 `target_modified`，不覆盖；
- 源和目标摘要都变化：报告冲突并中止该领域事务。

这样可以区分正常增量、Go 侧人工修改和双边冲突，不能只凭 `source_updated_at` 决定覆盖。

第一版摘要算法固定为：对明确列入各 importer 的迁移字段生成字段名排序的 canonical JSON，字符串先按字段规则 trim，时间转 UTC RFC3339Nano，空值写 JSON `null`，然后计算 SHA-256 小写十六进制。字段集合或规范化规则变化时必须提升 `fingerprint_version`，并用固定输入/摘要测试向量防止代码调整制造伪冲突。

### 9.4 执行模式

```text
--dry-run             读取迁移范围并回滚目标事务，只输出预计结果
--mode=incremental    根据映射、源更新时间和摘要增量 upsert，默认正式模式
--mode=full           全量读取迁移范围并幂等 upsert，不清空 Go 数据库
```

普通迁移命令不提供清空目标库或删除全部数据的选项。重复执行相同输入必须得到零新增且无重复实体。

`incremental` 与 `full` 使用相同的冲突和失效规则，区别只在读取范围。`full` 会重新读取本阶段全部源记录，但仍不物理删除 Go 数据。源侧显式状态变化按以下方式同步：

- 用户和球队只在源状态字段明确冻结时更新为 frozen，不因查询缺失删除；
- 对球队执行 authoritative full snapshot 时，映射过但不再存在于源成员集合的 source-owned 成员关系改为 inactive；Go 原生创建且没有 legacy mapping 的关系不处理；
- 源活动状态 `0/1/2/3` 分别映射为 `registering/ongoing/ended/cancelled`；新发现活动只有状态 `0/1` 才纳入，但所有已有 match mapping 的源活动不受该筛选限制，后续每次增量都继续读取直至同步到 `2/3`；
- 映射过但在 authoritative full snapshot 中消失的 source-owned 报名改为 cancelled；Go 原生报名不处理；
- 源活动或报名只是因为本次范围过滤未被读取时，不视为消失。

### 9.5 第一版迁移范围

- 用户、OpenID 和 Go 模型支持的基础资料；
- 球队；
- 有效成员关系、队长、领队和成员角色；
- 切换时首次发现且源状态为 `0`（报名中）或 `1`（进行中）的旧活动，以及此前已建立 mapping、需要继续跟踪最终状态的活动；
- 上述比赛关联的有效报名。

此前已经导入 Go 的历史比赛保留，不主动删除。账单、支付、签到、通知等历史数据不在本阶段导入。

旧 activity 只按既有事实迁为 `offline_confirmed` Match：源对手文本写入 `opponent_name`，没有可靠对手时使用现有“待定”兼容规则；源状态按第 9.4 节映射；主队成员报名进入 `host_team` 组。没有足够字段证明是 `online_team` 或 `online_individual` 的旧记录不得猜测成线上发布模式。旧 challenge 没有对应 Match/activity 且尚未成约时不迁移；已经形成 activity 的记录只迁最终 activity 和报名，避免重复聚合。

### 9.6 冲突与人工映射

以下情况必须中止并输出脱敏冲突摘要：

- 同一个 OpenID 对应多个旧用户；
- 一个旧实体映射到多个 Go 实体；
- 同名球队无法通过已有映射确定身份；
- 报名引用的用户在 Go 中不存在；
- 队长或领队不属于对应球队；
- 旧活动无法确定目标 Match 发布模式或报名组；
- 源记录变化与 Go 侧人工修改无法自动合并。

确需人工合并时，使用旧实体 ID 到 Go 目标 ID 的脱敏映射配置。显式配置优先于自动匹配，但不能覆盖已经存在且指向不同目标的映射表记录；这种情况必须先人工审计。配置不得包含 OpenID、手机号、连接串等敏感数据。

### 9.7 对账报告

每次 dry-run 和正式迁移输出：

- 源记录数；
- 新增、更新、跳过和冲突数；
- 用户、球队、成员、比赛和报名的映射数；
- 未映射数和孤立引用数；
- 队长/领队权限异常数；
- 正式执行后的源目标数量差异。

迁移按领域分事务执行。任一领域失败时回滚该领域本次写入，修复冲突后可安全重跑。

## 10. 分阶段实施与验收

该设计涉及 API 基线、数据迁移和用户端核心闭环三个可独立审查的工作包。实施计划应拆为三个顺序计划，而不是一个无法单独验收的超大提交：

1. **V1 路由与认证基线**：阶段 1、2、4；交付可登录并恢复会话的 app API 与同步迁移后的 admin API。
2. **迁移映射与球队上下文**：阶段 3、5；交付可重复执行的数据对账及真实用户/球队身份。
3. **比赛页面、报名闭环与切换**：阶段 6、7、8；前两个计划验收通过后才能开始最终切换。

三个计划使用同一份设计契约，并分别有独立测试和提交边界。计划间只通过本文件定义的 API DTO、数据库映射和验收结果衔接。

### 阶段 1：API V1 路由基线

- 建立 `/api/v1/app` 和 `/api/v1/admin` 路由组。
- 迁移全部 Go 路由测试、管理端 API、README 和四份相关 `AGENTS.md`。
- 验证用户/管理员 JWT 隔离和管理端核心流程。

### 阶段 2：认证与 H5 测试登录

- 补齐微信登录、`users/me` 和测试登录。
- H5 登录页动态列出测试用户并默认选中用户 37。
- 验证生产 404、冻结用户拒绝、旧 JWT 401 和网络错误重试。

### 阶段 3：迁移映射与核心数据同步

- 盘点此前已导入的数据并补建稳定映射。
- 按用户、球队、成员、有效比赛、有效报名顺序 dry-run 和正式迁移。
- 正式迁移后重复 dry-run，验证幂等和零冲突。

### 阶段 4：小程序请求与会话切换

- 替换 envelope、API 根路径、登录和会话恢复。
- 首次建立 Go 用户与球队身份上下文。
- 验证并发 bootstrap、401/403/网络失败和手动退出。

### 阶段 5：用户与球队上下文

- 接入当前用户资料、我的球队、球队详情和成员角色。
- 接入个人/球队身份切换。
- 按第 5.4 节矩阵改造球队 Tab，并移除首版不支持的球队写操作、积分和出勤入口。

### 阶段 6：比赛只读链路

- 接入首页、比赛列表和详情。
- 将 Match、RegistrationGroup 和报名状态转换为页面 view model。
- 验证地点、时间、主客队、人数和当前用户状态。

### 阶段 7：个人报名与整队候选

- 按 TDD 补齐个人报名 application/domain/repository/HTTP 行为。
- 接入个人报名创建、更新和取消。
- 接入已有整队申请、查看、选择和撤回能力。
- 验证权限、状态机、人数限制、重复提交和并发冲突。

### 阶段 8：功能收口与切换

- 完成第 5.4 节页面矩阵，移除所有仍依赖 Rust 的用户入口、页面注册和 store 调用。
- 执行全套自动验证与 H5/微信开发者工具人工验收。
- 暂停 Rust 生产写入，完成最终增量 dry-run、正式迁移与对账。
- 将 H5 和小程序 API 配置切到 Go，发布并通知用户重新登录。
- 使用用户 37、普通成员和无球队用户完成线上冒烟验证。

本项目不为本次切换实现回退、反向迁移或双写。Rust 数据库保持不修改，作为历史参考保留。

发布采用只允许前向修复的责任边界。以下任一条件出现时暂停发布并留在当前步骤，不切流量：最终 dry-run 有未解释冲突、正式对账数量或关系不一致、任一规定构建/测试失败、H5 或微信冒烟无法登录/浏览/报名。发布后发现问题时停止继续放量并在 Go 主线前向修复，不启动本设计范围外的 Rust 回退工程。

## 11. 测试与质量门槛

### 11.1 Go 后端

后端业务行为按 TDD 推进，至少覆盖：

- app/admin 路由隔离；
- 当前用户查询、资料修改权限，以及冻结用户在所有 app 路由上的统一拒绝；
- 测试登录环境白名单、双开关、默认用户缺失/冻结和 JWT 类型；
- 用户球队详情与成员可见性；
- `scope=mine` 对个人报名、主队成员、客队成员、无关比赛和分页组合的查询结果；
- 个人报名第 8.1 节全部状态转换、跨组唯一性、人数限制、幂等和并发冲突；
- 整队候选权限和事务；
- MySQL/PostgreSQL 双源用户映射、membership source ownership、匹配优先级、双摘要冲突、状态终态跟踪、失效同步、增量更新、full upsert、dry-run 和事务回滚。

最终执行：

```bash
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
```

### 11.2 小程序/H5

针对 base URL 防重复、请求层、登录恢复、Token 失效、H5 测试入口构建条件、身份选择和报名提交补充风险导向测试，不为普通视觉调整机械新增测试。

最终执行：

```bash
bun run type-check
bun run build:h5
bun run build:mp-weixin
```

人工验证 H5 和微信开发者工具中的登录、弱网、重复提交、无权限、不同角色和无球队场景。静态搜索确认已注册页面、store 和组件不再引用 `activity`、`challenge`、`billing`、`payment`、`notification` 等 Rust API；H5 和小程序运行时网络面板不得出现无版本业务请求。

### 11.3 Go 管理端

V1 路径迁移后执行：

```bash
bun run type-check
bun run lint
bun run build
```

验证管理端登录、球队、成员、比赛和整队候选接口仍通过 `/api/v1/admin` 工作。

## 12. 完成标准

- 小程序和 H5 不再调用 Rust 业务接口或无版本 Go 接口。
- Go 管理端全部使用 `/api/v1/admin`。
- 四份相关 `AGENTS.md`、Go README 和前端配置说明都使用同一 V1 路径契约。
- 微信登录、H5 测试登录和 Token 恢复工作正常。
- H5 测试登录默认用户为 37，生产环境不存在测试登录路由。
- 现有用户可通过 OpenID 找回身份，球队成员和角色与迁移报告一致。
- 用户能浏览首页、比赛列表和详情，并完成符合权限的个人报名或整队候选操作。
- 四个 Tab 与全部声明页面符合第 5.4 节矩阵，被移除页面不能再执行 Rust 请求。
- 最终增量迁移无未解释冲突，对账结果可追溯。
- Go、小程序和 Go 管理端的规定验证全部通过，人工验收完成。
