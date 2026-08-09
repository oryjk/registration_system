# Go OpenAPI 与 Swagger UI 设计

## 目标

为 `registration_system_go` 提供覆盖全部现有 HTTP 接口的 OpenAPI 3.0.3 契约和可离线访问的 Swagger UI，同时更新一期计划，使报名阶段的完成状态与实际代码一致。

本次覆盖：

- `GET /health`
- `/api/v1/app/*` 全部小程序/H5 接口
- `/api/v1/admin/*` 全部管理端接口
- 仅在 development/test 且显式启用时注册的 H5 测试登录接口

不修改小程序、管理端或 Rust 后端，不改变现有业务接口、响应结构和鉴权行为。

## 方案选择

采用手工维护的 OpenAPI 3.0.3 契约，并在构建时把契约和 Swagger UI 静态资源嵌入 Go 二进制。

没有采用以下方案：

- `swaggo/swag`：默认生成 Swagger 2.0，要求在 handler 中长期维护大量注解，容易污染协议适配代码并产生注解与 DTO 漂移。
- `oapi-codegen`：契约驱动能力更强，但会要求调整现有 Gin handler 和 DTO 边界，超出本次文档接入范围。

## 文件和职责

### OpenAPI 契约

`registration_system_go/docs/openapi.yaml` 是 API 文档的唯一源文件，使用 OpenAPI 3.0.3。

它负责定义：

- 服务信息和本地 server 地址
- app、admin、开发测试等 tags
- 每个路径、HTTP method、path/query 参数和请求体
- Bearer JWT security scheme
- 统一成功响应 envelope：`code`、`message`、`data`
- 统一错误响应以及 `400/401/403/404/409/422/500` 状态
- 用户、管理员、球队、成员、比赛、报名组、报名和球队申请等复用 schema
- 日期时间、UUID、状态枚举、nullable 字段和分页结构

字段与枚举必须来自现有 handler DTO、domain 类型和实际 JSON tag，禁止按前端预期臆造。

### 契约嵌入

`registration_system_go/docs/embed.go` 使用 `go:embed` 读取同目录 `openapi.yaml`，导出只读文档内容。将嵌入代码和契约放在同一目录，是为了满足 Go embed 不能引用父目录文件的限制，同时让 YAML 保持为可直接阅读和校验的文档资产。

### Swagger HTTP 适配

`registration_system_go/internal/bootstrap/openapi.go` 负责把内嵌契约和内嵌 Swagger UI 注册到 Gin：

- Swagger UI：`GET /api/docs/`
- 原始契约：`GET /api/docs/openapi.yaml`
- `GET /api/docs` 重定向到 `/api/docs/`

Swagger UI 的 JavaScript、CSS 和字体资源必须来自 Go 依赖中嵌入的 Swagger UI 5 静态资源，不使用 CDN。这样本地开发不依赖外网，也避免国内网络加载失败。

文档路由公开可读，但不会包含 JWT、微信密钥、数据库连接串或真实用户数据。Bearer Token 只由使用者在 Swagger UI 的 Authorize 控件中临时输入。

## 接口分组与鉴权

OpenAPI 使用一个 HTTP bearer security scheme，格式为 JWT。

- `/health`、微信登录、管理员登录和 Swagger 文档：公开访问。
- H5 测试账号列表和登录：公开访问，但标注仅限 development/test 且 `ENABLE_H5_TEST_LOGIN=true`。
- `/api/v1/app/*` 其他接口：要求用户 JWT。
- `/api/v1/admin/*` 其他接口：要求管理员 JWT；超级管理员专属行为在 operation 描述和 `403` 响应中说明。

OpenAPI 的 security 描述只表达协议要求。用户/管理员 Actor 的实际区分仍由现有 JWT middleware 和应用层权限规则负责，不在 Swagger handler 中复制鉴权逻辑。

## 路由覆盖防漂移

新增契约测试，组装包含全部 handler 且启用 H5 测试登录的 Gin router，读取 `router.Routes()`，将 Gin 的 `:id` 参数转换为 OpenAPI 的 `{id}` 形式，然后与 OpenAPI 中声明的 method/path 集合比较。

比较时排除 Swagger 自身静态资源路由，但包括健康检查和全部业务路由。测试必须同时报告：

- Gin 中存在但 OpenAPI 缺失的 operation
- OpenAPI 中存在但 Gin 未注册的 operation

这能捕捉“新增真实接口但忘记更新文档”和“删除/改名接口但文档仍保留”两种漂移。

H5 测试登录是条件路由，因此覆盖测试使用 `H5TestLoginEnabled=true` 的完整路由集合；OpenAPI description 同时说明它在生产环境不可用。

## 校验与测试

按 TDD 增加以下行为测试：

1. `GET /api/docs` 返回重定向，`GET /api/docs/` 返回包含 Swagger UI 的 HTML，`GET /api/docs/openapi.yaml` 返回 OpenAPI YAML。
2. 使用 OpenAPI 3 解析器加载并验证文档，确认版本、引用和 schema 合法。
3. 比较 Gin 与 OpenAPI operation 集合，确保全部现有接口被记录且没有幽灵接口。
4. 抽查公开接口无全局鉴权、受保护 app/admin 接口声明 Bearer JWT、H5 测试接口带环境限制说明。

提交前执行仓库要求的格式化、无 Docker race 测试、`go vet ./...` 和 API 构建。当前环境不启动 Docker；需要 testcontainers 的 PostgreSQL 集成测试只做编译检查，并在结果中明确说明。

## 文档同步

同步更新：

- `registration_system_go/task_plan.md`：将主队、客队与散人报名标记为完成；将 OpenAPI 子项标记为完成，但保留未完成的后台默认人数、逐场调整和全量联调。
- `registration_system_go/progress.md`：记录 V1 用户接口、数据迁移、个人报名和 OpenAPI 的当前进度。
- 根 `README.md`：在 Go 后端启动说明中增加 Swagger UI 和原始契约地址。
- `registration_system_go/README.md`：增加 Swagger 使用方式、覆盖范围、鉴权操作和离线资源说明。

计划状态必须区分“OpenAPI/HTTP 装配完成”和“需要真实 PostgreSQL/前端参与的最终全量联调”，不能因为文档页面可访问就把后者提前标为完成。

## 非目标

- 不从 OpenAPI 生成 handler、DTO 或客户端代码。
- 不修改现有 API 路径、响应 envelope 或 HTTP 状态映射。
- 不为 Swagger 增加独立管理员登录态或保存 Token。
- 不对 Swagger UI 做品牌化视觉改造。
- 不使用 Docker 启动本地 API 或文档服务。
