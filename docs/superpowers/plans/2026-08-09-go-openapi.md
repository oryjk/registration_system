# Go OpenAPI 与 Swagger UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 校正 Go 一期报名进度，并为全部现有 Go HTTP 接口提供经过自动校验、可离线访问的 OpenAPI 3.0.3 契约和 Swagger UI。

**Architecture:** `registration_system_go/docs` 同时保存 OpenAPI YAML 和负责 `go:embed` 的小型 Go 包；`internal/bootstrap` 只负责把内嵌文档和 Swagger UI 5 HTTP handler 注册到 Gin。契约测试使用 kin-openapi 验证 YAML，并把完整 Gin 路由集合与 OpenAPI operation 集合逐项比较，防止文档漂移。

**Tech Stack:** Go 1.26.5、Gin 1.10、OpenAPI 3.0.3、`github.com/swaggest/swgui/v5emb` v1.8.9、`github.com/getkin/kin-openapi/openapi3` v0.146.0、Go `embed`、标准库 `httptest`。

## Global Constraints

- 只修改 `registration_system_go/`、根 README 和本计划相关 Markdown；不修改小程序、管理端或 Rust 后端。
- 保持 `/api/v1/app/*` 与 `/api/v1/admin/*` 的现有路径、DTO、状态码和鉴权行为不变。
- Swagger UI 与 OpenAPI YAML 都嵌入 Go 二进制，不从 CDN 加载资源。
- OpenAPI 字段、枚举和 nullable 规则必须来自 handler DTO、domain 类型、JSON tag 和实际错误映射。
- 文档不得包含真实 JWT、微信密钥、数据库连接串或用户数据。
- 本地服务仍使用 `go run ./cmd/api`，不使用 Docker 启动。
- PostgreSQL testcontainers 测试在当前环境只编译不运行；最终结果必须说明这个限制。

---

### Task 1: 校正一期计划与进度记录

**Files:**
- Modify: `registration_system_go/task_plan.md`
- Modify: `registration_system_go/progress.md`

**Interfaces:**
- Consumes: commits `417eedb` through `5128041` and the actual `/api/v1/app` routes.
- Produces: a plan that marks personal registration complete while leaving default-player configuration, admin registration maintenance, frontend integration, and final end-to-end verification incomplete.

- [ ] **Step 1: Update the phase checklist**

Change the top-level stages to this exact status split:

```markdown
7. [completed] 主队、客队与散人报名
8. [pending] 后台默认人数和逐场调整
9. [in_progress] OpenAPI、HTTP 装配和全量验证
```

Change the 2026-07-21 participation checklist to:

```markdown
5. [completed] 主队/客队表态与 `online_individual` 散人报名事务
6. [pending] 管理端报名维护和默认人数配置
7. [pending] 管理端新增页面的桌面/手机响应式布局与双视口 E2E
8. [pending] 小程序比赛列表、详情、申请和报名页面
```

- [ ] **Step 2: Add the current backend-cutover progress entry**

Add a `2026-08-09` section to `progress.md` that records these facts without marking frontend work complete:

```markdown
## 2026-08-09

- `/api/v1/app` 已完成微信/H5 测试登录、用户资料、球队上下文、比赛列表/首页/详情、球队申请和个人报名闭环。
- 个人报名支持主队、客队和散人规则，包含幂等 PUT/DELETE、容量控制、派生状态更新和单事务成员校验。
- legacy 用户、球队、成员、比赛和报名已具备 full/incremental、dry-run、稳定映射与只读源约束。
- 小程序前端切换、管理端报名维护、默认人数配置和最终真实联调仍未完成。
- OpenAPI 3.0.3 与离线 Swagger UI 正在接入。
```

- [ ] **Step 3: Verify the document state**

Run:

```bash
rg -n "主队、客队与散人报名|online_individual|OpenAPI|2026-08-09" registration_system_go/task_plan.md registration_system_go/progress.md
git diff --check
```

Expected: registration stages are completed, OpenAPI is in progress, and no whitespace errors are reported.

- [ ] **Step 4: Commit**

```bash
git add registration_system_go/task_plan.md registration_system_go/progress.md
git commit -m "docs(go): reconcile mini backend progress"
```

---

### Task 2: Serve embedded OpenAPI and offline Swagger UI

**Files:**
- Create: `registration_system_go/docs/embed.go`
- Create: `registration_system_go/docs/openapi.yaml`
- Create: `registration_system_go/internal/bootstrap/openapi.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`
- Modify: `registration_system_go/internal/bootstrap/router_test.go`
- Modify: `registration_system_go/go.mod`
- Modify: `registration_system_go/go.sum`

**Interfaces:**
- Produces: `apidocs.OpenAPI []byte` and `registerOpenAPI(*gin.Engine)`.
- Routes: `GET /api/docs/*path`; Gin trailing-slash redirect exposes `/api/docs`, handler exposes `/api/docs/`, `/api/docs/openapi.yaml`, and embedded UI assets.

- [ ] **Step 1: Write the failing Swagger route test**

Add this behavior test to `internal/bootstrap/router_test.go`:

```go
func TestSwaggerRoutesServeEmbeddedOpenAPI(t *testing.T) {
	router := NewRouter(Dependencies{})

	redirect := httptest.NewRecorder()
	router.ServeHTTP(redirect, httptest.NewRequest(http.MethodGet, "/api/docs", nil))
	if redirect.Code < 300 || redirect.Code >= 400 || redirect.Header().Get("Location") != "/api/docs/" {
		t.Fatalf("docs redirect status=%d location=%q", redirect.Code, redirect.Header().Get("Location"))
	}

	for _, test := range []struct {
		path        string
		contentType string
		contains    string
	}{
		{path: "/api/docs/", contentType: "text/html", contains: "Swagger UI"},
		{path: "/api/docs/openapi.yaml", contentType: "application/yaml", contains: "openapi: 3.0.3"},
		{path: "/api/docs/swagger-ui.css", contentType: "text/css"},
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
		if response.Code != http.StatusOK || !strings.Contains(response.Header().Get("Content-Type"), test.contentType) {
			t.Fatalf("GET %s status=%d content-type=%q", test.path, response.Code, response.Header().Get("Content-Type"))
		}
		if test.contains != "" && !strings.Contains(response.Body.String(), test.contains) {
			t.Fatalf("GET %s body does not contain %q", test.path, test.contains)
		}
	}
}
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
go test ./internal/bootstrap -run TestSwaggerRoutesServeEmbeddedOpenAPI -count=1
```

Expected: FAIL because `/api/docs` and `/api/docs/*path` are not registered.

- [ ] **Step 3: Add pinned embedded UI dependency**

Run:

```bash
GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go get github.com/swaggest/swgui@v1.8.9
```

- [ ] **Step 4: Embed a minimal valid OpenAPI document**

Create `docs/embed.go`:

```go
package apidocs

import _ "embed"

//go:embed openapi.yaml
var OpenAPI []byte
```

Create the initial `docs/openapi.yaml`:

```yaml
openapi: 3.0.3
info:
  title: Registration System Go API
  version: 1.0.0
servers:
  - url: http://127.0.0.1:18080
paths:
  /health:
    get:
      operationId: getHealth
      summary: 健康检查
      responses:
        "200":
          description: 服务正常
```

- [ ] **Step 5: Implement the Swagger HTTP adapter**

Create `internal/bootstrap/openapi.go` with these exact boundaries:

```go
package bootstrap

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/oryjk/registration_system/registration_system_go/docs"
	"github.com/swaggest/swgui/v5emb"
)

const (
	openAPIBasePath = "/api/docs"
	openAPISpecPath = openAPIBasePath + "/openapi.yaml"
)

func registerOpenAPI(router *gin.Engine) {
	ui := v5emb.New("Registration System Go API", openAPISpecPath, openAPIBasePath)
	handler := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == openAPISpecPath {
			writer.Header().Set("Content-Type", "application/yaml; charset=utf-8")
			_, _ = writer.Write(apidocs.OpenAPI)
			return
		}
		ui.ServeHTTP(writer, request)
	})
	router.GET(openAPIBasePath+"/*path", gin.WrapH(handler))
}
```

Call `registerOpenAPI(router)` immediately after the health route in `NewRouter`.

- [ ] **Step 6: Run GREEN and regression tests**

Run:

```bash
gofmt -w docs/embed.go internal/bootstrap/openapi.go internal/bootstrap/router.go internal/bootstrap/router_test.go
go test -race ./internal/bootstrap
```

Expected: PASS, including local CSS asset delivery without a CDN request.

- [ ] **Step 7: Commit**

```bash
git add registration_system_go/docs registration_system_go/internal/bootstrap registration_system_go/go.mod registration_system_go/go.sum
git commit -m "feat(go): serve embedded Swagger UI"
```

---

### Task 3: Document and validate all existing operations

**Files:**
- Modify: `registration_system_go/docs/openapi.yaml`
- Create: `registration_system_go/docs/openapi_test.go`
- Modify: `registration_system_go/go.mod`
- Modify: `registration_system_go/go.sum`

**Interfaces:**
- Consumes: `apidocs.OpenAPI`, `bootstrap.NewRouter`, and all existing HTTP handler constructors.
- Produces: a validated OpenAPI 3.0.3 contract containing exactly 43 existing business operations: one health, 17 app, and 25 admin operations.

- [ ] **Step 1: Add the OpenAPI validation and route parity tests**

Create `docs/openapi_test.go` as external package `apidocs_test`. Its core must use real OpenAPI and Gin route data:

```go
func loadDocument(t *testing.T) *openapi3.T {
	t.Helper()
	document, err := openapi3.NewLoader().LoadFromData(apidocs.OpenAPI)
	if err != nil {
		t.Fatalf("load OpenAPI: %v", err)
	}
	if err := document.Validate(context.Background()); err != nil {
		t.Fatalf("validate OpenAPI: %v", err)
	}
	return document
}

func openAPIOperations(document *openapi3.T) map[string]struct{} {
	operations := map[string]struct{}{}
	for path, item := range document.Paths.Map() {
		for method := range item.Operations() {
			operations[method+" "+path] = struct{}{}
		}
	}
	return operations
}

func ginOperations(router *gin.Engine) map[string]struct{} {
	parameter := regexp.MustCompile(`:([A-Za-z0-9_]+)`)
	operations := map[string]struct{}{}
	for _, route := range router.Routes() {
		if strings.HasPrefix(route.Path, "/api/docs") {
			continue
		}
		path := parameter.ReplaceAllString(route.Path, `{$1}`)
		operations[route.Method+" "+path] = struct{}{}
	}
	return operations
}
```

Construct the full router with `H5TestLoginEnabled: true`, a non-nil middleware, and every handler constructor. Pass nil use-case implementations because this test only calls `Routes()`:

```go
middleware := authhttp.NewMiddleware(nil)
router := bootstrap.NewRouter(bootstrap.Dependencies{
	AuthMiddleware:     &middleware,
	UserAuth:           authhttp.NewHandler(nil),
	TestAuth:           authhttp.NewTestHandler(nil, 37),
	AdminAuth:          authhttp.NewAdminHandler(nil),
	UserProfiles:       userhttp.NewHandler(nil),
	AppUsers:           userhttp.NewAppHandler(nil),
	H5TestLoginEnabled: true,
	Teams:              teamhttp.NewHandler(nil, nil),
	AppTeams:           teamhttp.NewAppHandler(nil),
	UserMatches:        matchhttp.NewUserHandler(nil),
	UserRegistrations:  matchhttp.NewUserRegistrationHandler(nil),
	AdminMatches:       matchhttp.NewAdminHandler(nil, nil),
	TeamApplications:   matchhttp.NewTeamApplicationHandler(nil),
})
```

Compare both maps and fail with sorted `missing` and `extra` lists. Add assertions that:

- `document.OpenAPI == "3.0.3"`.
- `GET /health`, app微信登录, admin登录, and both H5 test-auth operations have no security requirement.
- `GET /api/v1/app/users/me` and `GET /api/v1/admin/auth/me` declare `bearerAuth`.
- both H5 test-auth descriptions contain `ENABLE_H5_TEST_LOGIN=true` and `development/test`.

- [ ] **Step 2: Run the test to verify RED**

Add the parser dependency and run:

```bash
GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go get github.com/getkin/kin-openapi/openapi3@v0.146.0
go test ./docs -count=1
```

Expected: FAIL with Gin operations missing from the initial health-only OpenAPI document.

- [ ] **Step 3: Expand the OpenAPI paths to the exact route inventory**

Document every method/path below with a unique `operationId`, tag, summary, parameters, request body, success envelope, actual error responses, and security requirement:

```text
GET    /health
POST   /api/v1/app/auth/wechat/login
GET    /api/v1/app/test-auth/users
POST   /api/v1/app/test-auth/login
GET    /api/v1/app/users/me
PATCH  /api/v1/app/users/me
GET    /api/v1/app/teams/my
GET    /api/v1/app/teams/{id}
GET    /api/v1/app/teams/{id}/members
GET    /api/v1/app/matches
GET    /api/v1/app/matches/home
GET    /api/v1/app/matches/{id}
PUT    /api/v1/app/matches/{id}/groups/{group_id}/my-registration
DELETE /api/v1/app/matches/{id}/groups/{group_id}/my-registration
GET    /api/v1/app/matches/{id}/team-applications
POST   /api/v1/app/matches/{id}/team-applications
POST   /api/v1/app/matches/{id}/team-applications/{application_id}/select
POST   /api/v1/app/matches/{id}/team-applications/{application_id}/withdraw
POST   /api/v1/admin/auth/login
GET    /api/v1/admin/auth/me
GET    /api/v1/admin/admins
POST   /api/v1/admin/admins
GET    /api/v1/admin/teams
POST   /api/v1/admin/teams
GET    /api/v1/admin/teams/{id}
PATCH  /api/v1/admin/teams/{id}
DELETE /api/v1/admin/teams/{id}
GET    /api/v1/admin/teams/{id}/members
GET    /api/v1/admin/teams/{id}/member-candidates
POST   /api/v1/admin/teams/{id}/members
PATCH  /api/v1/admin/teams/{id}/members/{user_id}
DELETE /api/v1/admin/teams/{id}/members/{user_id}
PATCH  /api/v1/admin/teams/{id}/captain
PATCH  /api/v1/admin/users/{id}/profile
GET    /api/v1/admin/matches
POST   /api/v1/admin/matches
GET    /api/v1/admin/matches/{id}
PATCH  /api/v1/admin/matches/{id}
PATCH  /api/v1/admin/matches/{id}/status
DELETE /api/v1/admin/matches/{id}
GET    /api/v1/admin/matches/{id}/team-applications
POST   /api/v1/admin/matches/{id}/team-applications/{application_id}/select
POST   /api/v1/admin/matches/{id}/team-applications/{application_id}/withdraw
```

Use reusable parameter components `TeamID`, `UserID`, `MatchID`, `GroupID`, `ApplicationID`, `Page`, `PageSize`, `Search`, `MatchStatus`, and `TeamStatus`.

- [ ] **Step 4: Define exact reusable schemas**

Mirror these code sources and JSON tags:

```text
auth/adapters/http/{handler.go,test_handler.go,admin_handler.go}
user/adapters/http/{app_handler.go,handler.go}
team/adapters/http/{handler.go,app_handler.go,member_handler.go}
match/adapters/http/{user_handler.go,admin_handler.go,user_registration_handler.go,team_application_handler.go}
shared/http/response.go
shared/adapters/httpapi/response.go
```

At minimum define reusable schemas for `ErrorResponse`, `User`, `Profile`, `Admin`, `Team`, `TeamMembership`, `AppTeamDetail`, `AppTeamMember`, `Member`, `MemberManagement`, `MemberCandidate`, `Match`, `UserMatch`, `RegistrationGroup`, `UserRegistration`, `MyRegistration`, `TeamApplication`, `MatchDetail`, `UserMatchDetail`, `MatchList`, `UserMatchList`, and `UserMatchHome`.

Use these exact enum values:

```yaml
PublicationMode: [offline_confirmed, online_team, online_individual]
OpponentState: [no_recruitment, recruiting, confirmed]
MatchStatus: [registering, ongoing, ended, cancelled]
GroupKind: [host_team, guest_team, individual_opponent]
GroupStatus: [open, closed, cancelled]
RegistrationStatus: [unknown, attending, leave, absent, cancelled]
WritableRegistrationStatus: [attending, leave, absent]
ApplicationStatus: [pending, selected, rejected, withdrawn]
TeamStatus: [active, frozen]
MemberStatus: [active, inactive]
MemberRole: [captain, leader, vice_captain, member]
AdminRole: [admin, super_admin]
```

All nullable pointer fields must use `nullable: true`; UUID strings use `format: uuid`; `time.Time` fields use `format: date-time`; IDs and counts use integer formats matching Go types.

- [ ] **Step 5: Run GREEN and inspect parity failures**

Run:

```bash
go test ./docs -count=1
go test -race ./internal/bootstrap ./docs
```

Expected: PASS with exactly 43 matching business operations and a valid OpenAPI document.

- [ ] **Step 6: Commit**

```bash
git add registration_system_go/docs/openapi.yaml registration_system_go/docs/openapi_test.go registration_system_go/go.mod registration_system_go/go.sum
git commit -m "docs(go): publish complete OpenAPI contract"
```

---

### Task 4: Publish usage docs and run final verification

**Files:**
- Modify: `README.md`
- Modify: `registration_system_go/README.md`
- Modify: `registration_system_go/task_plan.md`
- Modify: `registration_system_go/progress.md`

**Interfaces:**
- Consumes: the tested Swagger routes and complete OpenAPI contract.
- Produces: developer-facing URLs and final stage status without claiming frontend or PostgreSQL end-to-end completion.

- [ ] **Step 1: Update root and Go README**

Add these exact URLs to the Go startup sections:

```text
Swagger UI: http://127.0.0.1:18080/api/docs/
OpenAPI YAML: http://127.0.0.1:18080/api/docs/openapi.yaml
```

Document that UI assets are embedded, Swagger works without CDN/Docker, app endpoints require a user JWT, admin endpoints require an admin JWT, and the Authorize field expects the token value according to Swagger UI's bearer scheme.

- [ ] **Step 2: Finalize the plan status**

Keep stage 9 in progress because full frontend/PostgreSQL integration remains. Split its wording so OpenAPI and HTTP assembly are completed subitems while final integration stays incomplete. Update the `2026-08-09` progress entry from “正在接入” to the exact Swagger and OpenAPI URLs.

- [ ] **Step 3: Run formatting and all no-Docker verification**

Run:

```bash
gofmt -w .
go test -run '^$' ./...
go list ./... | rg -v '(/adapters/postgres$|/internal/migration/(legacymatches|legacyteams)$|/internal/testsupport$)' | xargs go test -race -count=1
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api
go build -o /tmp/importlegacyteams ./cmd/importlegacyteams
go build -o /tmp/importlegacymatches ./cmd/importlegacymatches
git diff --check
```

Expected: every command exits zero. Do not run packages whose tests call `testsupport.StartPostgres` because that starts Docker.

- [ ] **Step 4: Verify Swagger through a running local API when a safe development database is configured**

If the worktree already has a non-production `.env` with a reachable development `DATABASE_URL`, run:

```bash
go run ./cmd/api
curl -I http://127.0.0.1:18080/api/docs/
curl http://127.0.0.1:18080/api/docs/openapi.yaml
```

Expected: Swagger UI returns HTML and the YAML begins with `openapi: 3.0.3`. If no safe development database is configured, skip process startup and report that router-level `httptest` verification passed instead; never connect to an unknown database.

- [ ] **Step 5: Commit**

```bash
git add README.md registration_system_go/README.md registration_system_go/task_plan.md registration_system_go/progress.md
git commit -m "docs(go): publish Swagger access guide"
```
