# Go Mini V1 Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish versioned app/admin API roots, active-user authentication, WeChat and gated H5 test login, and a Go-compatible mini-program request/session foundation.

**Architecture:** Gin exposes separate `/api/v1/app` and `/api/v1/admin` groups; app JWT parsing is followed by a narrow user-status guard backed by the user repository. The mini program owns one complete app API base URL, parses the Go envelope centrally, and restores a session through `/users/me` then `/teams/my`. Existing `VITE_USE_MOCK` behavior remains an explicit development adapter and is updated to the same DTO contract.

**Tech Stack:** Go 1.26.5, Gin, pgx/sqlc, PostgreSQL, JWT, uni-app, Vue 3, TypeScript, Vite, Bun, Umi Max, React, Vitest-compatible Bun tests.

## Global Constraints

- Business roots are exactly `/api/v1/app/*` and `/api/v1/admin/*`; `/health` remains unversioned.
- Frontend base URLs already include their complete API root; domain clients only append paths such as `/auth/wechat/login`.
- App and admin JWT actor types remain isolated; every protected app request also verifies that the user still exists and is active.
- H5 test routes exist only when `APP_ENV` is explicitly `development` or `test` and `ENABLE_H5_TEST_LOGIN=true`; production must return `404` because routes are not registered.
- `H5_TEST_DEFAULT_USER_ID` defaults to `37`; a missing or frozen configured default is a server configuration error, never an automatic fallback.
- Rust JWT/cache are not proactively deleted; an old token receives `401`, and a successful Go login overwrites it.
- Go responses use `{ code, message, data }` with `code=0` on success; Rust `{ success, message, data }` is not accepted on the Go path.
- Preserve and adapt current `VITE_USE_MOCK`, `src/mock/`, singleton bootstrap promise, session version, and manual logout behavior.
- Do not modify `registration_system_rs/` or any Rust/legacy data.
- First-stage profile editing includes only `nickname` and `real_name`; no phone binding or avatar upload.

---

## File Structure

- `registration_system_go/internal/bootstrap/router.go`: owns V1 group construction and route registration only.
- `registration_system_go/internal/bootstrap/config.go`: parses strict app environment and H5 test-login switches.
- `registration_system_go/internal/user/application/app_service.go`: current-user reads/updates and active-account checks.
- `registration_system_go/internal/user/adapters/http/app_handler.go`: app-specific user DTO and `/users/me` handlers.
- `registration_system_go/internal/auth/application/test_login.go`: gated test identity listing and token issuance.
- `registration_system_go/internal/auth/adapters/http/test_handler.go`: non-sensitive H5 test DTOs.
- `registration_system_mini/src/config/apiBase.ts`: validates the complete app API root.
- `registration_system_mini/src/utils/request.ts`: sole Go envelope and error parser while retaining mock interception.
- `registration_system_mini/src/api/{auth,user,team}.ts`: app-domain relative paths and DTOs.
- `registration_system_mini/src/stores/appSession.ts`: session state machine and identity bootstrap.
- `registration_system_mini/src/components/H5TestLoginPanel.vue`: development-only account selector.
- `registration_system_backend_fe_go/src/config/api.ts`: complete admin API root and independent health URL.

### Task 1: Version the Go app/admin route tree

**Files:**
- Modify: `registration_system_go/internal/bootstrap/router.go`
- Modify: `registration_system_go/internal/bootstrap/router_test.go`
- Modify: `registration_system_go/internal/auth/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/auth/adapters/http/admin_handler_test.go`
- Modify: `registration_system_go/internal/team/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler_test.go`
- Modify: `registration_system_go/internal/match/adapters/http/admin_handler_test.go`
- Modify: `registration_system_go/internal/match/adapters/http/team_application_handler_test.go`

**Interfaces:**
- Consumes: existing `RegisterPublicRoutes`, `RegisterUserRoutes`, `RegisterAdminRoutes`, and JWT middleware methods.
- Produces: public app group `/api/v1/app`, protected app group on the same root, public/protected admin group `/api/v1/admin`, and no business aliases under `/api`.

- [ ] **Step 1: Write failing route-boundary tests**

Add table-driven assertions to `internal/bootstrap/router_test.go` using minimal fake dependencies:

```go
func TestBusinessRoutesUseV1AudiencePrefixesOnly(t *testing.T) {
    router := NewRouter(testDependencies())
    cases := []struct{ method, path string; want int }{
        {http.MethodPost, "/api/v1/app/auth/wechat/login", http.StatusUnprocessableEntity},
        {http.MethodPost, "/api/v1/admin/auth/login", http.StatusUnprocessableEntity},
        {http.MethodPost, "/api/auth/wechat/login", http.StatusNotFound},
        {http.MethodPost, "/api/admin/auth/login", http.StatusNotFound},
    }
    for _, tc := range cases {
        response := httptest.NewRecorder()
        router.ServeHTTP(response, httptest.NewRequest(tc.method, tc.path, nil))
        if response.Code != tc.want { t.Fatalf("%s %s: got %d want %d", tc.method, tc.path, response.Code, tc.want) }
    }
}
```

Update handler route tests so app URLs start with `/api/v1/app` and admin URLs with `/api/v1/admin`. Add one assertion that a user token on an admin endpoint and an admin token on an app endpoint never succeeds.

- [ ] **Step 2: Run the route tests and confirm the old router fails them**

Run: `cd registration_system_go && go test ./internal/bootstrap ./internal/auth/adapters/http ./internal/team/adapters/http ./internal/match/adapters/http`

Expected: FAIL because `/api/v1/app` and `/api/v1/admin` are not registered and old aliases still exist.

- [ ] **Step 3: Construct explicit V1 audience groups**

Replace the unversioned group construction in `router.go` with:

```go
v1 := router.Group("/api/v1")
app := v1.Group("/app")
admin := v1.Group("/admin")

dependencies.UserAuth.RegisterPublicRoutes(app)
dependencies.AdminAuth.RegisterPublicRoutes(admin)

appProtected := app.Group("")
appProtected.Use(dependencies.AuthMiddleware.RequireUser())
adminProtected := admin.Group("")
adminProtected.Use(dependencies.AuthMiddleware.RequireAdmin())
```

Keep every nil guard currently used by `NewRouter`. Register teams, user matches, and team applications only on `appProtected`; register admin auth, teams, profiles, matches, and applications only on `adminProtected`.

- [ ] **Step 4: Run route packages and the full Go suite**

Run: `cd registration_system_go && go test ./internal/bootstrap ./internal/auth/adapters/http ./internal/team/adapters/http ./internal/match/adapters/http && go test ./...`

Expected: PASS; `/health` still returns `{"code":0,"message":"ok","data":{"status":"ok"}}`.

- [ ] **Step 5: Commit the route boundary**

```bash
git add registration_system_go/internal/bootstrap/router.go registration_system_go/internal/bootstrap/router_test.go registration_system_go/internal/auth/adapters/http registration_system_go/internal/team/adapters/http registration_system_go/internal/match/adapters/http
git commit -m "feat(go): version app and admin API routes"
```

### Task 2: Move the Go admin frontend to the complete V1 admin root

**Files:**
- Modify: `registration_system_backend_fe_go/src/config/api.ts`
- Modify: `registration_system_backend_fe_go/src/config/api.test.ts`
- Modify: `registration_system_backend_fe_go/src/api/client.test.ts`
- Modify: `registration_system_backend_fe_go/.env.example`
- Modify: `registration_system_backend_fe_go/README.md`
- Modify: `registration_system_backend_fe_go/src/pages/AccessPage.tsx`
- Modify: `registration_system_backend_fe_go/AGENTS.md`
- Modify: `registration_system_go/AGENTS.md`
- Modify: `registration_system_mini/AGENTS.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `request<T>(path, options)` with domain-relative paths and `auth: "none"` for health.
- Produces: `buildAdminApiUrl(path)` against `ADMIN_API_BASE_URL=/go-api/api/v1/admin` or `/api/v1/admin`, plus `buildHealthUrl()` outside that root.

- [ ] **Step 1: Update URL tests to the complete-root contract**

Assert these exact results in `src/config/api.test.ts` and `src/api/client.test.ts`:

```ts
expect(buildAdminApiUrl("", "/matches")).toBe("/api/v1/admin/matches");
expect(buildAdminApiUrl("/go-api/api/v1/admin", "/auth/login")).toBe(
  "/go-api/api/v1/admin/auth/login",
);
expect(buildHealthUrl("/go-api/api/v1/admin")).toBe("/go-api/health");
expect(() => buildAdminApiUrl("/go-api/api/v1/admin", "/api/v1/admin/matches")).toThrow();
```

Keep client tests for session expiration on `401` and no authorization header on health.

- [ ] **Step 2: Run focused frontend tests and verify they fail**

Run: `cd registration_system_backend_fe_go && bun test src/config/api.test.ts src/api/client.test.ts`

Expected: FAIL because the current helper appends `/api/admin` and uses the old configured base.

- [ ] **Step 3: Split business and health URL builders**

Implement the config contract without changing domain API files:

```ts
const DEFAULT_ADMIN_API_BASE_URL = "/api/v1/admin";
const ADMIN_SUFFIX = "/api/v1/admin";

export function getAdminApiBaseUrl(): string {
  const value = (process.env.ADMIN_API_BASE_URL?.trim() || DEFAULT_ADMIN_API_BASE_URL).replace(/\/+$/, "");
  if (!value.endsWith(ADMIN_SUFFIX)) throw new Error(`ADMIN_API_BASE_URL 必须以 ${ADMIN_SUFFIX} 结尾`);
  return value;
}

export function buildAdminApiUrl(base: string, path: string): string {
  if (!path.startsWith("/") || path.startsWith("/api/")) throw new Error("管理端请求必须使用领域相对路径");
  return `${(base || DEFAULT_ADMIN_API_BASE_URL).replace(/\/+$/, "")}${path}`;
}
```

`buildHealthUrl` removes the final `/api/v1/admin` from the configured root and appends `/health`. Update `.env.example` to `ADMIN_API_BASE_URL=/go-api/api/v1/admin`; leave `src/api/auth.ts`, `teams.ts`, and `matches.ts` paths domain-relative.

- [ ] **Step 4: Synchronize operator-facing documentation**

Replace old `/api/admin` examples in the listed READMEs, AccessPage, and four `AGENTS.md` files with `/api/v1/admin`; document `/api/v1/app` for user traffic and unversioned `/health`. Do not describe compatibility aliases.

- [ ] **Step 5: Verify and commit the admin migration**

Run: `cd registration_system_backend_fe_go && bun test src/config/api.test.ts src/api/client.test.ts && bun run type-check && bun run lint && bun run build`

Expected: PASS and emitted admin requests use `/api/v1/admin` exactly once.

```bash
git add AGENTS.md registration_system_go/AGENTS.md registration_system_mini/AGENTS.md registration_system_backend_fe_go/AGENTS.md registration_system_backend_fe_go/.env.example registration_system_backend_fe_go/README.md registration_system_backend_fe_go/src
git commit -m "feat(admin): use V1 admin API root"
```

### Task 3: Add current-user use cases and an active-user guard

**Files:**
- Create: `registration_system_go/internal/user/application/app_service.go`
- Create: `registration_system_go/internal/user/application/app_service_test.go`
- Modify: `registration_system_go/internal/user/domain/user.go`
- Modify: `registration_system_go/internal/user/domain/user_test.go`
- Create: `registration_system_go/internal/user/adapters/http/app_handler.go`
- Create: `registration_system_go/internal/user/adapters/http/app_handler_test.go`
- Modify: `registration_system_go/internal/user/ports/repository.go`
- Modify: `registration_system_go/internal/user/adapters/postgres/repository.go`
- Modify: `registration_system_go/db/queries/auth.sql`
- Modify: `registration_system_go/internal/auth/adapters/http/middleware.go`
- Modify: `registration_system_go/internal/auth/adapters/http/middleware_test.go`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`

**Interfaces:**
- Consumes: `ports.Repository.FindByID(ctx, id) (domain.User, bool, error)` and authenticated `sharedauth.Actor`.
- Produces: `AppService.GetMe(context.Context, sharedauth.Actor) (domain.User, error)`, `AppService.UpdateMe(context.Context, sharedauth.Actor, UpdateMeCommand) (domain.User, error)`, and `ActiveUserChecker.EnsureActive(context.Context, int64) error`.

- [ ] **Step 1: Write application tests for read, update, and validation**

Cover user actors only, missing/frozen users, at least one patch field, trim behavior, 120-character limits, and empty-string clearing:

```go
func TestAppServiceUpdatesCurrentUserOnly(t *testing.T) {
    nickname, realName := "  新昵称  ", ""
    got, err := service.UpdateMe(ctx, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 37}, application.UpdateMeCommand{
        Nickname: &nickname, RealName: &realName,
    })
    if err != nil || got.Nickname != "新昵称" || got.RealName != nil { t.Fatalf("got=%+v err=%v", got, err) }
}
```

Preserve the current admin `UpdateProfile(context.Context, domain.User)` method and add the app-specific persistence method explicitly:

```go
type Repository interface {
    FindByID(context.Context, int64) (domain.User, bool, error)
    FindByOpenID(context.Context, string) (domain.User, bool, error)
    Create(context.Context, domain.User) (domain.User, error)
    UpdateProfile(context.Context, domain.User) (domain.User, error)
    UpdateAppProfile(context.Context, domain.User) (domain.User, error)
}
```

- [ ] **Step 2: Run the user tests and verify missing interfaces fail compilation**

Run: `cd registration_system_go && go test ./internal/user/...`

Expected: FAIL because `AppService`, `UpdateMeCommand`, `FindByID`, and the app handler do not exist.

- [ ] **Step 3: Implement app use cases and app-only DTOs**

Add `User.UpdateAppProfile(nickname, realName *string) (User, error)` so nil preserves a field, an empty string clears the optional real name, nickname is trimmed, and both provided values enforce the 120-rune limit. `UpdateAppProfile` persists only `nickname` and `real_name`, leaving phone/avatar unchanged. Create `AppUserResponse` in `app_handler.go`:

```go
type AppUserResponse struct {
    ID int64 `json:"id"`; Nickname string `json:"nickname"`; AvatarURL *string `json:"avatar_url"`
    RealName *string `json:"real_name"`; PhoneNumber *string `json:"phone_number"`; Status domain.UserStatus `json:"status"`
}
type UpdateMeRequest struct { Nickname *string `json:"nickname"`; RealName *string `json:"real_name"` }
```

Register `GET /users/me` and `PATCH /users/me` only on protected app routes. Map validation to `422`, missing user to `401`, and return the updated `AppUserResponse`.

- [ ] **Step 4: Write and run active-user middleware tests**

Add a narrow dependency:

```go
type ActiveUserChecker interface { EnsureActive(context.Context, int64) error }
func (m Middleware) RequireActiveUser(checker ActiveUserChecker) gin.HandlerFunc
```

Tests must show an active account reaches the handler, a missing/frozen account gets `401`, a repository failure gets `500`, and an admin actor cannot enter this middleware.

Run: `cd registration_system_go && go test ./internal/auth/adapters/http ./internal/user/...`

Expected before implementation: FAIL; after implementation: PASS.

- [ ] **Step 5: Attach the guard to the entire protected app group**

In `router.go`, use middleware in this order:

```go
appProtected.Use(
    dependencies.AuthMiddleware.RequireUser(),
    dependencies.AuthMiddleware.RequireActiveUser(dependencies.ActiveUsers),
)
```

Use separate dependency fields: `AppUsers *userhttp.AppHandler` for route registration and `ActiveUsers authhttp.ActiveUserChecker` for middleware validation.

Extend a router test with a validly signed token for a frozen user and assert `GET /api/v1/app/teams/my` returns `401` before the team handler runs.

- [ ] **Step 6: Generate sqlc, verify, and commit**

Run: `cd registration_system_go && sqlc generate && gofmt -w internal/user internal/auth/adapters/http internal/bootstrap && go test ./internal/user/... ./internal/auth/adapters/http ./internal/bootstrap && go test ./...`

Expected: PASS.

```bash
git add registration_system_go/db/queries/auth.sql registration_system_go/internal/user registration_system_go/internal/auth/adapters/http registration_system_go/internal/bootstrap
git commit -m "feat(go): add active app user profile endpoints"
```

### Task 4: Add strictly gated H5 test login

**Files:**
- Modify: `registration_system_go/internal/bootstrap/config.go`
- Modify: `registration_system_go/internal/bootstrap/config_test.go`
- Create: `registration_system_go/internal/auth/application/test_login.go`
- Create: `registration_system_go/internal/auth/application/test_login_test.go`
- Create: `registration_system_go/internal/auth/adapters/http/test_handler.go`
- Create: `registration_system_go/internal/auth/adapters/http/test_handler_test.go`
- Modify: `registration_system_go/internal/user/ports/repository.go`
- Modify: `registration_system_go/internal/user/adapters/postgres/repository.go`
- Modify: `registration_system_go/db/queries/auth.sql`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`
- Modify: `registration_system_go/.env.example`

**Interfaces:**
- Consumes: user repository and `TokenService.IssueUser(ctx, userID)`.
- Produces: `TestLoginService.ListUsers(ctx, defaultID) (TestLoginUsersResult, error)` and `TestLoginService.Login(ctx, userID) (WechatLoginResult, error)`; routes `/test-auth/users` and `/test-auth/login` only when configuration enables them.

- [ ] **Step 1: Test strict environment parsing**

Extend `Config` with:

```go
type AppEnvironment string
const (EnvironmentDevelopment AppEnvironment = "development"; EnvironmentTest AppEnvironment = "test"; EnvironmentProduction AppEnvironment = "production")
// Config fields: AppEnvironment, EnableH5TestLogin bool, H5TestDefaultUserID int64
```

Table-test missing/unknown `APP_ENV` as production, exact lowercase `development`/`test`, true parsing only for `ENABLE_H5_TEST_LOGIN=true`, default ID `37`, invalid non-positive IDs as configuration errors, and `H5TestLoginEnabled()` false in production regardless of the flag.

- [ ] **Step 2: Run configuration tests and confirm they fail**

Run: `cd registration_system_go && go test ./internal/bootstrap -run 'TestLoadConfig|TestH5TestLogin'`

Expected: FAIL because the fields and strict parser are absent.

- [ ] **Step 3: Implement test-login application behavior with non-sensitive projections**

Add repository projection and method:

```go
type TestLoginUser struct {
    User domain.User
    Teams []TestLoginTeam
}
type TestLoginTeam struct { ID int64; Name string; Role string }
ListActiveTestLoginUsers(context.Context) ([]TestLoginUser, error)
```

Use one bounded query for active users plus active teams ordered by `users.id, teams.id`, then group rows in the adapter. `display_name` is trimmed `real_name`, else trimmed `nickname`, else `fmt.Sprintf("用户 #%d", id)`.

Tests must assert sorted active-only users, default `37`, missing/frozen default -> internal/configuration error, unknown login ID -> `404`, frozen login ID -> `403`, and issued token is a user token.

- [ ] **Step 4: Implement HTTP DTOs and conditional registration**

Use exact response shapes:

```go
type TestLoginUserResponse struct { ID int64 `json:"id"`; DisplayName string `json:"display_name"`; AvatarURL *string `json:"avatar_url"`; Teams []TestLoginTeamResponse `json:"teams"` }
type TestLoginUsersResponse struct { Items []TestLoginUserResponse `json:"items"`; DefaultUserID int64 `json:"default_user_id"` }
type TestLoginRequest struct { UserID int64 `json:"user_id" binding:"required"` }
```

Add `TestAuth *authhttp.TestHandler` and `H5TestLoginEnabled bool` to `bootstrap.Dependencies`; dependency assembly sets the boolean from `config.H5TestLoginEnabled()`. Only call `dependencies.TestAuth.RegisterRoutes(app)` inside `if dependencies.H5TestLoginEnabled && dependencies.TestAuth != nil`. Do not register a handler that checks production at request time.

- [ ] **Step 5: Verify production absence and enabled behavior**

Run: `cd registration_system_go && sqlc generate && gofmt -w internal/auth internal/user internal/bootstrap && go test ./internal/auth/... ./internal/user/... ./internal/bootstrap && go test ./...`

Expected: PASS; router tests prove production returns `404` and enabled development returns the test users envelope.

- [ ] **Step 6: Commit test authentication**

```bash
git add registration_system_go/.env.example registration_system_go/db/queries/auth.sql registration_system_go/internal/auth registration_system_go/internal/user registration_system_go/internal/bootstrap
git commit -m "feat(go): add gated H5 test login"
```

### Task 5: Convert the mini request layer and domain APIs to Go

**Files:**
- Modify: `registration_system_mini/src/env.d.ts`
- Modify: `registration_system_mini/src/config/apiBase.ts`
- Create: `registration_system_mini/src/config/__tests__/apiBase.test.ts`
- Create: `registration_system_mini/scripts/validate-api-base.mjs`
- Modify: `registration_system_mini/package.json`
- Modify: `registration_system_mini/src/types/api.ts`
- Create: `registration_system_mini/src/types/app.ts`
- Modify: `registration_system_mini/src/utils/request.ts`
- Create: `registration_system_mini/src/utils/__tests__/request.test.ts`
- Create: `registration_system_mini/src/api/auth.ts`
- Modify: `registration_system_mini/src/api/user.ts`
- Modify: `registration_system_mini/src/api/team.ts`
- Modify: `registration_system_mini/src/mock/handlers.ts`
- Modify: `registration_system_mini/src/mock/data/` files that represent auth, users, or teams
- Modify: `registration_system_mini/.env.development`
- Create: `registration_system_mini/.env.production.example`

**Interfaces:**
- Consumes: Go `ApiResponse<T> = { code: number; message: string; data: T }` and the app DTOs fixed in the design.
- Produces: `requestApi<TResponse, TBody>(options): Promise<TResponse>`, `wechatLogin(jsCode): Promise<LoginResponse>`, `getMe()`, `updateMe()`, `getMyTeams()`; mock handlers return the same envelope and paths.

- [ ] **Step 1: Write API-base and request parser tests**

Test development fallback and strict paths:

```ts
expect(normalizeAppApiBase("http://127.0.0.1:18080/api/v1/app/")).toBe("http://127.0.0.1:18080/api/v1/app");
expect(() => normalizeAppApiBase("http://127.0.0.1:18080/api")).toThrow();
expect(() => buildAppApiUrl("http://x/api/v1/app", "/api/v1/app/users/me")).toThrow();
expect(buildAppApiUrl("http://x/api/v1/app", "/users/me")).toBe("http://x/api/v1/app/users/me");
```

Mock `uni.request` and assert `code=0` returns data, a `200` envelope with `code=422` rejects with `ApiRequestError.statusCode===422`, HTTP `401` is unauthorized, HTTP `403` is not unauthorized, and network failures keep `statusCode===0`.

- [ ] **Step 2: Run the focused tests and confirm old envelope behavior fails**

Run: `cd registration_system_mini && bun test src/config/__tests__/apiBase.test.ts src/utils/__tests__/request.test.ts`

Expected: FAIL because the old request parser checks `response.success` and `403` is currently treated as session expiration.

- [ ] **Step 3: Implement complete-base validation and Go envelope parsing**

Use:

```ts
export interface ApiResponse<T> { code: number; message: string; data: T }
export const FALLBACK_APP_API_BASE = "http://127.0.0.1:18080/api/v1/app";

export function buildAppApiUrl(base: string, path: string) {
  if (!path.startsWith("/") || path.startsWith("/api/")) throw new Error("请求必须使用领域相对路径");
  return `${normalizeAppApiBase(base)}${path}`;
}
```

`requestRaw` must keep `isMockEnabled()/tryMockRequest` before `uni.request`. `requestApi` rejects whenever HTTP is not 2xx or envelope `code !== 0`; preserve the backend message for `401/403/404/409/422` and use a generic message for `500`.

- [ ] **Step 4: Add build-time production validation**

`scripts/validate-api-base.mjs` reads `VITE_API_BASE_URL`, fails production builds when absent or not ending in `/api/v1/app`, and never prints secrets. Wire it to `prebuild:h5` and before the existing MP version sync without removing `prebuild:mp-weixin` behavior.

- [ ] **Step 5: Replace auth/user/team foundation calls and types**

Define in `src/types/app.ts`:

```ts
export type AppUserStatus = "active" | "frozen";
export interface AppUser { id: number; nickname: string; avatar_url: string | null; real_name: string | null; phone_number: string | null; status: AppUserStatus }
export interface LoginResponse { token: string; user: AppUser }
export type MyTeamRole = "captain" | "leader" | "vice_captain" | "member";
export interface MyTeam { id: number; name: string; description: string | null; logo_url: string | null; role: MyTeamRole; joined_at: string }
```

Replace `/wx/login -> /user/login` with a single `POST /auth/wechat/login`, `/user/info` with `/users/me`, and `/teams/my-teams` with `/teams/my`. Remove phone/avatar write exports from the Go foundation API rather than leaving dead Rust paths under new names.

- [ ] **Step 6: Adapt existing mock interception to identical URLs and envelopes**

Update `src/mock/handlers.ts` so `POST /auth/wechat/login`, `GET/PATCH /users/me`, and `GET /teams/my` return `{ code: 0, message: "ok", data }`. Keep `VITE_USE_MOCK`; do not bypass `requestApi` from page code.

- [ ] **Step 7: Verify and commit the request foundation**

Run: `cd registration_system_mini && bun test src/config/__tests__/apiBase.test.ts src/utils/__tests__/request.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5`

Expected: PASS.

```bash
git add registration_system_mini/package.json registration_system_mini/scripts/validate-api-base.mjs registration_system_mini/.env.development registration_system_mini/.env.production.example registration_system_mini/src/env.d.ts registration_system_mini/src/config registration_system_mini/src/types registration_system_mini/src/utils/request.ts registration_system_mini/src/utils/__tests__/request.test.ts registration_system_mini/src/api/auth.ts registration_system_mini/src/api/user.ts registration_system_mini/src/api/team.ts registration_system_mini/src/mock
git commit -m "feat(mini): adopt Go V1 request contract"
```

### Task 6: Switch session bootstrap and add the H5 account selector

**Files:**
- Modify: `registration_system_mini/src/stores/appSession.ts`
- Modify: `registration_system_mini/src/stores/__tests__/appSession.test.ts`
- Modify: `registration_system_mini/src/components/FloatingLoginPrompt.vue`
- Modify: `registration_system_mini/src/components/__tests__/floatingLoginPrompt.test.ts`
- Create: `registration_system_mini/src/components/H5TestLoginPanel.vue`
- Create: `registration_system_mini/src/api/testAuth.ts`
- Modify: `registration_system_mini/src/types/app.ts`
- Modify: `registration_system_mini/src/env.d.ts`
- Modify: `registration_system_mini/src/mock/handlers.ts`

**Interfaces:**
- Consumes: `wechatLogin(jsCode): LoginResponse`, `getMe(): AppUser`, `getMyTeams(): MyTeam[]`, `listTestLoginUsers(): TestLoginUsersResponse`, and `testLogin(userID): LoginResponse`.
- Produces: `ensureSessionReady(force?)`, `loginWithTestUser(userID)`, `restoreSessionFromStorage()`, and reactive login state without automatic retry loops.

- [ ] **Step 1: Extend session tests for Go-specific failure behavior**

Test these transitions with mocked API modules:

```ts
test("401 clears the old token and waits for an explicit login", async () => { /* getMe -> ApiRequestError(401) */ });
test("403 and network failures preserve the token", async () => { /* getMe -> 403/status 0 */ });
test("successful WeChat login stores result.token then loads users/me and teams/my", async () => {});
test("two callers share one bootstrap promise and logout invalidates late responses", async () => {});
test("mock mode still uses Go DTO handlers without calling uni.login", async () => {});
```

- [ ] **Step 2: Run tests and confirm the old two-step login fails**

Run: `cd registration_system_mini && bun test src/stores/__tests__/appSession.test.ts src/components/__tests__/floatingLoginPrompt.test.ts`

Expected: FAIL because `appSession` still performs `/wx/login` then `/user/login`, and treats `403` as unauthorized.

- [ ] **Step 3: Implement explicit session restoration and login entry points**

On startup with a token, call `getMe()` then `getMyTeams()`. On `401`, clear only Go access/session state and expose the existing login prompt; do not immediately call `uni.login`. On explicit WeChat login, call `uni.login`, `wechatLogin(code)`, store `token`, then load `/teams/my`. Retain `bootstrapPromise`, `sessionVersion`, `hasManualLogout`, and mock bootstrap guards.

Add:

```ts
export async function loginWithTestUser(userId: number) {
  const version = ++sessionVersion;
  const result = await testLogin(userId);
  assertSessionVersion(version);
  setAccessToken(result.token);
  currentUser.value = result.user;
  await loadTeamContext();
}
```

- [ ] **Step 4: Add platform-and-mode-gated H5 selector**

Define:

```ts
export interface TestLoginUser { id: number; display_name: string; avatar_url: string | null; teams: Array<{ id: number; name: string; role: MyTeamRole }> }
export interface TestLoginUsersResponse { items: TestLoginUser[]; default_user_id: number }
```

`H5TestLoginPanel.vue` loads the list only under `#ifdef H5` and only when `import.meta.env.MODE !== "production" && import.meta.env.VITE_ENABLE_H5_TEST_LOGIN === "true"`. Select `default_user_id` when present, render returned `display_name` and team/role context, and submit `user_id`. Do not hardcode OpenID or phone number.

- [ ] **Step 5: Add test-login mock behavior and component tests**

Mock `/test-auth/users` with user `37` selected by default and `/test-auth/login` with the normal `LoginResponse`. Test production source/build conditions, missing default selection error display, alternate account selection, and failed login preserving the chosen user.

- [ ] **Step 6: Verify and commit session foundation**

Run: `cd registration_system_mini && bun test src/stores/__tests__/appSession.test.ts src/components/__tests__/floatingLoginPrompt.test.ts && bun run type-check && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app VITE_ENABLE_H5_TEST_LOGIN=true bun run build:h5 && VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin`

Expected: PASS; the MP bundle contains no test-login UI route trigger.

```bash
git add registration_system_mini/src/stores registration_system_mini/src/components registration_system_mini/src/api/testAuth.ts registration_system_mini/src/types/app.ts registration_system_mini/src/env.d.ts registration_system_mini/src/mock
git commit -m "feat(mini): establish Go login and session flow"
```

### Task 7: Run the foundation acceptance gate

**Files:**
- Modify: `registration_system_go/README.md`
- Modify: `registration_system_mini/README.md`
- Create: `docs/runbooks/go-mini-auth-smoke.md`

**Interfaces:**
- Consumes: all deliverables from Tasks 1-6.
- Produces: reproducible local startup variables and smoke checks for app/admin path isolation, WeChat/H5 login, user restore, and `/teams/my` bootstrap.

- [ ] **Step 1: Document non-secret local configuration**

Document non-secret example values and exact roots:

```text
APP_ENV=development
ENABLE_H5_TEST_LOGIN=true
H5_TEST_DEFAULT_USER_ID=37
VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app
ADMIN_API_BASE_URL=/go-api/api/v1/admin
```

Include curl examples for `/health`, production-like `404` on `/api/v1/app/test-auth/users`, and enabled-development test login. Never include a JWT, OpenID, database URL, or AppSecret.

- [ ] **Step 2: Execute all automated gates**

Run:

```bash
cd registration_system_go
gofmt -w .
go test -race ./...
go vet ./...
go build -o /tmp/registration-system-go-api ./cmd/api

cd ../registration_system_backend_fe_go
bun run type-check
bun run lint
bun run build

cd ../registration_system_mini
bun run type-check
VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:h5
VITE_API_BASE_URL=http://127.0.0.1:18080/api/v1/app bun run build:mp-weixin
```

Expected: every command exits `0`.

- [ ] **Step 3: Perform the manual smoke matrix**

Verify H5 user `37`, one other active user, a frozen user rejection, an unknown user rejection, old/Rust token `401`, network-offline retry preserving the token, manual logout, user JWT rejected by admin, admin JWT rejected by app, and `/teams/my` loaded after login. Record date, environment, and pass/fail only; do not record credentials.

- [ ] **Step 4: Commit acceptance documentation**

```bash
git add registration_system_go/README.md registration_system_mini/README.md docs/runbooks/go-mini-auth-smoke.md
git commit -m "docs: add Go mini auth smoke runbook"
```

## Plan Completion Gate

- [ ] Every business route test uses exactly one of `/api/v1/app` or `/api/v1/admin`; old aliases return `404`.
- [ ] `/users/me`, active-user guard, WeChat login, and gated H5 login return the shared `AppUser` shape.
- [ ] Mini request/session code preserves current mock support and distinguishes `401`, `403`, and network failures.
- [ ] Admin health stays outside the admin API root.
- [ ] No Rust backend file or legacy database was modified.
- [ ] All Go, mini, and Go-admin verification commands pass before Plan 2 begins.
