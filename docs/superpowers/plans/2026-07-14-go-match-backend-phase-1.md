# Go Match Backend Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建可运行的 `registration_system_go/`，以 Gin、PostgreSQL 和六边形架构交付真实鉴权、球队权限、三种比赛发布、球队候选选择、双方/散人报名及后台人数配置闭环。

**Architecture:** 按 `auth/user/team/match/system` 限界上下文组织，每个模块内部使用 `domain/application/ports/adapters`。Match 是唯一比赛聚合根；PostgreSQL 事务只存在于 adapter，Gin 只存在于 HTTP adapter/bootstrap。第一阶段先用新库运行完整 Match API，Rust 项目只读且不修改；旧库迁移和前端切换分别使用后续计划。

**Tech Stack:** Go 1.22、Gin、pgx v5、sqlc、goose、OpenAPI/oapi-codegen、slog、testcontainers-go、PostgreSQL。

---

## Scope Boundary

本计划包含：项目脚手架、协作文档、数据库 schema、JWT/微信登录、用户与球队最小读模型、Match 领域和 API、候选球队流程、报名流程、后台默认人数配置、集成测试和本地运行。

本计划不修改：`registration_system_rs/**`、小程序、管理后台、移动管理 App。本计划不实现订单、支付、账单、结算、签到或通知，也不执行旧库到新库的数据迁移。

## File Map

```text
registration_system_go/
  AGENTS.md                         # Go 子项目协作和验证约束
  CLAUDE.md                         # AI 修改顺序与边界
  README.md                         # 本地启动、配置、接口入口
  .env.example                     # 非敏感配置模板
  go.mod / go.sum                  # Go module 与锁定依赖
  Makefile                         # generate/migrate/test/lint/run
  sqlc.yaml                        # sqlc 配置
  api/openapi.yaml                 # 新 API 唯一契约
  cmd/api/main.go                  # 进程入口
  db/migrations/00001_initial.sql  # 第一阶段完整 schema
  db/queries/*.sql                 # 按模块分 SQL
  internal/bootstrap/*.go          # 配置、DI、Gin 路由
  internal/shared/*                # Actor、错误、响应、时钟
  internal/auth/*                  # 微信登录、JWT
  internal/user/*                  # 用户最小领域与持久化
  internal/team/*                  # 球队/成员/队长领队权限
  internal/match/*                 # Match、报名组、候选申请及用例
  internal/system/*                # 按赛制默认人数配置
  internal/testsupport/*           # PostgreSQL 容器与 fixture
```

### Task 1: Scaffold Go Service and Enforce Repository Rules

**Files:**
- Create: `registration_system_go/go.mod`
- Create: `registration_system_go/cmd/api/main.go`
- Create: `registration_system_go/internal/bootstrap/config.go`
- Create: `registration_system_go/internal/bootstrap/router.go`
- Create: `registration_system_go/internal/bootstrap/router_test.go`
- Create: `registration_system_go/Makefile`
- Create: `registration_system_go/.env.example`
- Create: `registration_system_go/README.md`
- Create: `registration_system_go/AGENTS.md`
- Create: `registration_system_go/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Create the failing health-route test**

```go
func TestHealthRoute(t *testing.T) {
    router := NewRouter(Dependencies{})
    request := httptest.NewRequest(http.MethodGet, "/health", nil)
    response := httptest.NewRecorder()
    router.ServeHTTP(response, request)
    require.Equal(t, http.StatusOK, response.Code)
    require.JSONEq(t, `{"code":0,"message":"ok","data":{"status":"ok"}}`, response.Body.String())
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/bootstrap -run TestHealthRoute -v`

Expected: FAIL because the module and `NewRouter` do not exist.

- [ ] **Step 3: Create the module and minimal Gin bootstrap**

Initialize module `github.com/oryjk/registration_system/registration_system_go`. Implement `Config.Load()` for `HTTP_ADDR`, `DATABASE_URL`, `JWT_SECRET`, `WECHAT_APP_ID`, and `WECHAT_APP_SECRET`. Implement `NewRouter` with recovery/request logging middleware and `GET /health` returning the repository-standard response envelope.

```go
type Response[T any] struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Data    T      `json:"data"`
}

func NewRouter(deps Dependencies) *gin.Engine {
    router := gin.New()
    router.Use(gin.Recovery())
    router.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, Response[gin.H]{Code: 0, Message: "ok", Data: gin.H{"status": "ok"}})
    })
    return router
}
```

Add root/subproject documentation stating that Rust is read-only, Go uses feature-based hexagonal modules, Gin cannot escape HTTP adapters, and standard verification is `go test ./... && go vet ./...`.

- [ ] **Step 4: Run GREEN and format**

Run: `cd registration_system_go && gofmt -w . && go test ./internal/bootstrap -run TestHealthRoute -v && go vet ./...`

Expected: PASS, exit 0.

- [ ] **Step 5: Commit scaffold**

```bash
git add AGENTS.md CLAUDE.md README.md registration_system_go
git commit -m "feat(go): scaffold hexagonal backend"
```

### Task 2: Create PostgreSQL Schema and Generated Query Boundary

**Files:**
- Create: `registration_system_go/db/migrations/00001_initial.sql`
- Create: `registration_system_go/db/queries/auth.sql`
- Create: `registration_system_go/db/queries/team.sql`
- Create: `registration_system_go/db/queries/match.sql`
- Create: `registration_system_go/db/queries/system.sql`
- Create: `registration_system_go/sqlc.yaml`
- Create: `registration_system_go/internal/testsupport/postgres.go`
- Create: `registration_system_go/internal/testsupport/schema_test.go`
- Create: generated files under `registration_system_go/internal/*/adapters/postgres/sqlc/`

- [ ] **Step 1: Write the failing schema contract test**

The test starts PostgreSQL with testcontainers, runs goose migrations, then queries `information_schema` and `pg_constraint`.

```go
func TestInitialSchemaContainsMatchAggregateTables(t *testing.T) {
    pool := StartPostgres(t)
    requireTable(t, pool, "users")
    requireTable(t, pool, "teams")
    requireTable(t, pool, "team_members")
    requireTable(t, pool, "matches")
    requireTable(t, pool, "match_registration_groups")
    requireTable(t, pool, "match_registrations")
    requireTable(t, pool, "match_team_applications")
    requireTable(t, pool, "match_registration_defaults")
    requireCheckConstraint(t, pool, "matches", "matches_publication_mode_check")
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/testsupport -run TestInitialSchemaContainsMatchAggregateTables -v`

Expected: FAIL because no migration exists.

- [ ] **Step 3: Implement the initial migration**

Create UUID-backed tables with these required columns and constraints:

```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY,
  name varchar(255) NOT NULL,
  publication_mode varchar(32) NOT NULL CHECK (publication_mode IN ('offline_confirmed','online_team','online_individual')),
  opponent_state varchar(32) NOT NULL CHECK (opponent_state IN ('no_recruitment','recruiting','confirmed')),
  status varchar(24) NOT NULL CHECK (status IN ('registering','ongoing','ended','cancelled')),
  host_team_id bigint NOT NULL REFERENCES teams(id),
  away_team_id bigint NULL REFERENCES teams(id),
  opponent_name varchar(255) NULL,
  players_per_team integer NOT NULL CHECK (players_per_team > 0),
  start_time timestamp NOT NULL,
  end_time timestamp NOT NULL,
  location varchar(255) NOT NULL,
  location_latitude double precision NULL,
  location_longitude double precision NULL,
  description text NULL,
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CHECK (away_team_id IS NULL OR away_team_id <> host_team_id),
  CHECK ((publication_mode = 'offline_confirmed' AND opponent_name IS NOT NULL AND opponent_state = 'no_recruitment') OR publication_mode <> 'offline_confirmed'),
  CHECK ((publication_mode <> 'offline_confirmed' AND opponent_name IS NULL) OR publication_mode = 'offline_confirmed')
);
```

Add registration-group kind/status constraints, nullable team/min/max cross-field checks, partial unique indexes for active groups/applications, and a `cancelled_at` field on registrations so cancellation is audited rather than deleted.

- [ ] **Step 4: Configure sqlc and generate**

Keep generated packages inside each persistence adapter. SQL query files may share the migration schema but must emit into module-specific packages.

Run: `cd registration_system_go && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate`

Expected: generated Go code compiles and no generated package imports Gin.

- [ ] **Step 5: Run GREEN**

Run: `cd registration_system_go && go test ./internal/testsupport -run TestInitialSchemaContainsMatchAggregateTables -v && go test ./...`

Expected: PASS.

- [ ] **Step 6: Commit schema**

```bash
git add registration_system_go/db registration_system_go/sqlc.yaml registration_system_go/internal/testsupport registration_system_go/internal/*/adapters/postgres/sqlc
git commit -m "feat(go): add match database schema"
```

### Task 3: Implement Shared Errors, Actor, JWT, and Gin Authentication

**Files:**
- Create: `registration_system_go/internal/shared/domain/error.go`
- Create: `registration_system_go/internal/shared/auth/actor.go`
- Create: `registration_system_go/internal/auth/ports/token_service.go`
- Create: `registration_system_go/internal/auth/adapters/jwt/service.go`
- Create: `registration_system_go/internal/auth/adapters/jwt/service_test.go`
- Create: `registration_system_go/internal/auth/adapters/http/middleware.go`
- Create: `registration_system_go/internal/auth/adapters/http/middleware_test.go`
- Create: `registration_system_go/internal/shared/http/response.go`

- [ ] **Step 1: Write failing JWT and middleware tests**

```go
func TestJWTServiceRoundTripsUserActor(t *testing.T) {
    service := NewService("01234567890123456789012345678901", time.Hour)
    token, err := service.IssueUser(context.Background(), 42)
    require.NoError(t, err)
    actor, err := service.Parse(context.Background(), token)
    require.NoError(t, err)
    require.Equal(t, sharedauth.Actor{Kind: sharedauth.ActorUser, ID: 42}, actor)
}

func TestRequireUserRejectsAdminToken(t *testing.T) {
    // Send a valid admin token through the user middleware and expect 403.
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/auth/... -v`

Expected: FAIL because token service and middleware do not exist.

- [ ] **Step 3: Implement framework-independent auth types**

```go
type ActorKind string
const (
    ActorUser  ActorKind = "user"
    ActorAdmin ActorKind = "admin"
)

type Actor struct {
    Kind         ActorKind
    ID           int64
    IsSuperAdmin bool
}
```

Define typed business errors `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `Validation`, and `Internal`; map them to 401/403/404/409/422/500 only in `internal/shared/http`.

- [ ] **Step 4: Implement JWT adapter and Gin middleware**

Use explicit claims for actor kind, actor ID, super-admin flag, issued-at, and expiry. Middleware parses `Authorization: Bearer`, stores `Actor` under a private context key, and exposes `MustActor(c)` only inside HTTP adapters.

- [ ] **Step 5: Run GREEN**

Run: `cd registration_system_go && go test ./internal/auth/... -v && go vet ./...`

Expected: PASS.

- [ ] **Step 6: Commit authentication boundary**

```bash
git add registration_system_go/internal/auth registration_system_go/internal/shared
git commit -m "feat(go): add actor authentication boundary"
```

### Task 4: Implement WeChat Login and Minimal User/Team Access

**Files:**
- Create: `registration_system_go/internal/user/domain/user.go`
- Create: `registration_system_go/internal/user/ports/repository.go`
- Create: `registration_system_go/internal/user/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/auth/ports/wechat_gateway.go`
- Create: `registration_system_go/internal/auth/application/wechat_login.go`
- Create: `registration_system_go/internal/auth/application/wechat_login_test.go`
- Create: `registration_system_go/internal/auth/adapters/wechat/client.go`
- Create: `registration_system_go/internal/auth/adapters/http/handler.go`
- Create: `registration_system_go/internal/team/domain/team.go`
- Create: `registration_system_go/internal/team/ports/repository.go`
- Create: `registration_system_go/internal/team/application/query_service.go`
- Create: `registration_system_go/internal/team/application/query_service_test.go`
- Create: `registration_system_go/internal/team/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/team/adapters/http/handler.go`

- [ ] **Step 1: Write failing application tests**

```go
func TestWechatLoginCreatesMissingUserAndIssuesJWT(t *testing.T) {
    gateway := &fakeWechatGateway{openid: "openid-1"}
    users := newFakeUsers()
    tokens := &fakeTokenService{token: "jwt-1"}
    result, err := NewWechatLogin(gateway, users, tokens).Execute(context.Background(), "wx-code")
    require.NoError(t, err)
    require.Equal(t, "jwt-1", result.Token)
    require.Equal(t, "openid-1", users.created.OpenID)
}

func TestTeamAccessAllowsCaptainAndLeaderOnly(t *testing.T) {
    service := NewQueryService(fakeTeamRepository{roles: map[int64]domain.Role{1: domain.RoleCaptain, 2: domain.RoleLeader, 3: domain.RoleMember}})
    require.NoError(t, service.EnsureManager(context.Background(), 10, 1))
    require.NoError(t, service.EnsureManager(context.Background(), 10, 2))
    require.ErrorIs(t, service.EnsureManager(context.Background(), 10, 3), sharederror.ErrForbidden)
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/auth/application ./internal/team/application -v`

Expected: FAIL because use cases do not exist.

- [ ] **Step 3: Implement minimal domain and ports**

User contains `ID`, `OpenID`, `Nickname`, `AvatarURL`, and active status. Team/member contains team identity, member status, and roles `captain`, `leader`, `vice_captain`, `member`; only captain and leader satisfy Match publishing permissions. Preserve `vice_captain` as data but do not grant publishing permission unless a later requirement changes it.

- [ ] **Step 4: Implement application and adapters**

Wechat gateway calls `jscode2session`, validates non-empty openid and non-zero WeChat errors, and never logs app secret or full code. User repository upserts by openid. Team endpoints expose only the current user's active teams and role data needed by Match pages.

- [ ] **Step 5: Run GREEN and HTTP tests**

Run: `cd registration_system_go && go test ./internal/auth/... ./internal/user/... ./internal/team/... -v`

Expected: PASS.

- [ ] **Step 6: Commit identity and team access**

```bash
git add registration_system_go/internal/auth registration_system_go/internal/user registration_system_go/internal/team registration_system_go/db/queries
git commit -m "feat(go): add user and team access"
```

### Task 5: Model Match Aggregate and Publication Invariants

**Files:**
- Create: `registration_system_go/internal/match/domain/match.go`
- Create: `registration_system_go/internal/match/domain/registration_group.go`
- Create: `registration_system_go/internal/match/domain/team_application.go`
- Create: `registration_system_go/internal/match/domain/match_test.go`

- [ ] **Step 1: Write failing table-driven domain tests**

```go
func TestNewMatchPublicationModes(t *testing.T) {
    tests := []struct {
        name string
        input NewMatchInput
        wantMode PublicationMode
        wantOpponent OpponentState
        wantGroup GroupKind
        wantErr error
    }{
        {"offline requires opponent", NewMatchInput{Mode: OfflineConfirmed}, "", "", "", ErrOpponentNameRequired},
        {"offline opens host registration", validOfflineInput(), OfflineConfirmed, OpponentNoRecruitment, GroupHostTeam, nil},
        {"team online recruits while host registers", validTeamOnlineInput(), OnlineTeam, OpponentRecruiting, GroupHostTeam, nil},
        {"individual creates opponent group", validIndividualInput(8, 8, 10), OnlineIndividual, OpponentRecruiting, GroupIndividualOpponent, nil},
    }
    // Execute NewMatch and assert exact groups/state.
}

func TestIndividualDefaultLimits(t *testing.T) {
    min, max := ResolveIndividualLimits(8, nil)
    require.Equal(t, 8, min)
    require.Equal(t, 10, max)
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/match/domain -v`

Expected: FAIL because domain types do not exist.

- [ ] **Step 3: Implement Match constructors and transitions**

Use typed string enums and constructors; do not expose setters that can produce invalid combinations.

```go
func NewMatch(input NewMatchInput, limits IndividualLimits) (Match, []RegistrationGroup, error)
func (m *Match) ConfirmTeamOpponent(awayTeamID int64) error
func (m *Match) ReopenTeamRecruitment() error
func (m *Match) RecalculateIndividualOpponent(active int) error
```

Require non-empty name/location, `end_time > start_time`, positive `players_per_team`, valid coordinates pair, offline opponent name only for offline mode, and no client-provided individual limits.

- [ ] **Step 4: Run GREEN**

Run: `cd registration_system_go && go test ./internal/match/domain -v`

Expected: PASS.

- [ ] **Step 5: Commit domain**

```bash
git add registration_system_go/internal/match/domain
git commit -m "feat(go): model match publication modes"
```

### Task 6: Implement Match Creation and Query Use Cases

**Files:**
- Create: `registration_system_go/internal/match/ports/repository.go`
- Create: `registration_system_go/internal/match/ports/team_access.go`
- Create: `registration_system_go/internal/match/ports/default_limits.go`
- Create: `registration_system_go/internal/match/application/create_match.go`
- Create: `registration_system_go/internal/match/application/create_match_test.go`
- Create: `registration_system_go/internal/match/application/query_matches.go`
- Create: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/match/adapters/postgres/repository_test.go`

- [ ] **Step 1: Write failing application tests**

```go
func TestCreateOnlineTeamMatchOpensHostGroupImmediately(t *testing.T) {
    repo := newFakeMatchRepository()
    useCase := NewCreateMatch(repo, allowManager(7, 101), fixedLimits(8, 10), fixedClock())
    result, err := useCase.Execute(ctx, actor(101), CreateMatchCommand{Mode: domain.OnlineTeam, HostTeamID: 7, PlayersPerTeam: 8, Name: "周末约球", Location: "东安球场", StartTime: futureStart(), EndTime: futureEnd()})
    require.NoError(t, err)
    require.Equal(t, domain.OpponentRecruiting, result.Match.OpponentState)
    require.Equal(t, domain.GroupHostTeam, result.Groups[0].Kind)
    require.Equal(t, domain.GroupOpen, result.Groups[0].Status)
}

func TestCreateMatchRejectsOrdinaryMember(t *testing.T) {
    useCase := NewCreateMatch(newFakeMatchRepository(), denyManager(), fixedLimits(8, 10), fixedClock())
    _, err := useCase.Execute(ctx, actor(103), validCreateCommand())
    require.ErrorIs(t, err, sharederror.ErrForbidden)
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/match/application -run 'TestCreateMatch' -v`

Expected: FAIL because ports/use case do not exist.

- [ ] **Step 3: Implement application ports and use cases**

`CreateMatch` checks actor kind, captain/leader permission, resolves server-side individual defaults, constructs Match/groups, and calls one atomic repository method. `QueryMatches` supports publication mode, opponent state, team relation, future-time, page, and page-size filters without exposing SQL types.

- [ ] **Step 4: Implement PostgreSQL transaction**

`CreateWithGroups(ctx, match, groups)` begins a pgx transaction, inserts Match and all initial groups, and commits only after every insert succeeds. Add an integration test that forces a group constraint failure and asserts no Match remains.

- [ ] **Step 5: Run GREEN**

Run: `cd registration_system_go && go test ./internal/match/application ./internal/match/adapters/postgres -v`

Expected: PASS.

- [ ] **Step 6: Commit creation/query**

```bash
git add registration_system_go/internal/match registration_system_go/db/queries/match.sql
git commit -m "feat(go): create and query matches"
```

### Task 7: Implement Team Applications, Selection, and Withdrawal

**Files:**
- Create: `registration_system_go/internal/match/application/apply_team.go`
- Create: `registration_system_go/internal/match/application/select_team.go`
- Create: `registration_system_go/internal/match/application/withdraw_guest.go`
- Create: `registration_system_go/internal/match/application/team_application_test.go`
- Modify: `registration_system_go/internal/match/ports/repository.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Modify: `registration_system_go/db/queries/match.sql`

- [ ] **Step 1: Write failing business tests**

```go
func TestCandidateMustDescribeStyleAndAge(t *testing.T) {
    _, err := newApplyTeamUseCase().Execute(ctx, candidateManager, ApplyTeamCommand{MatchID: matchID, TeamID: 22, Introduction: "  "})
    require.ErrorIs(t, err, sharederror.ErrValidation)
}

func TestSelectingCandidateOpensOnlySelectedGuestGroup(t *testing.T) {
    result, err := fixture.Select.Execute(ctx, hostManager, SelectTeamCommand{MatchID: matchID, ApplicationID: applicationB})
    require.NoError(t, err)
    require.Equal(t, int64(22), *result.Match.AwayTeamID)
    require.Equal(t, domain.ApplicationSelected, result.Selected.Status)
    require.Equal(t, domain.ApplicationRejected, fixture.Application(applicationA).Status)
    require.Equal(t, domain.GroupOpen, result.GuestGroup.Status)
}

func TestGuestWithdrawalKeepsHostRegistrationsAndReopensRecruitment(t *testing.T) {
    result, err := fixture.Withdraw.Execute(ctx, selectedGuestManager, WithdrawGuestCommand{MatchID: matchID})
    require.NoError(t, err)
    require.Equal(t, domain.OpponentRecruiting, result.Match.OpponentState)
    require.Nil(t, result.Match.AwayTeamID)
    require.Equal(t, domain.GroupCancelled, result.GuestGroup.Status)
    require.Equal(t, 3, fixture.ActiveHostRegistrationCount())
    require.Equal(t, 0, fixture.ActiveGuestRegistrationCount())
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/match/application -run 'TestCandidate|TestSelecting|TestGuestWithdrawal' -v`

Expected: FAIL because the use cases do not exist.

- [ ] **Step 3: Implement application behavior**

Validate `online_team`, recruiting state, different host/candidate teams, active candidate manager, non-empty introduction, host-manager-only selection, and selected-guest-manager-only withdrawal.

- [ ] **Step 4: Implement atomic repository operations**

`SelectApplication` uses `SELECT ... FOR UPDATE` on Match and applications, rejects all other pending applications, inserts exactly one guest group, and updates the opponent state. `WithdrawSelectedGuest` locks Match, cancels active guest registrations with `cancelled_at`, cancels the group, marks the selected application withdrawn, clears away team, and reopens recruitment.

- [ ] **Step 5: Add PostgreSQL race test**

Start two goroutines selecting different applications for the same Match. Assert exactly one succeeds and the database contains one selected application and one active guest group.

- [ ] **Step 6: Run GREEN**

Run: `cd registration_system_go && go test -race ./internal/match/application ./internal/match/adapters/postgres -v`

Expected: PASS with exactly one selection winner.

- [ ] **Step 7: Commit team recruitment flow**

```bash
git add registration_system_go/internal/match registration_system_go/db/queries/match.sql
git commit -m "feat(go): add team opponent selection"
```

### Task 8: Implement Host, Guest, and Individual Registration

**Files:**
- Create: `registration_system_go/internal/match/application/update_registration.go`
- Create: `registration_system_go/internal/match/application/update_registration_test.go`
- Create: `registration_system_go/internal/match/application/update_group_capacity.go`
- Modify: `registration_system_go/internal/match/ports/repository.go`
- Modify: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Modify: `registration_system_go/db/queries/match.sql`

- [ ] **Step 1: Write failing registration tests**

```go
func TestHostMemberCanRegisterWhileTeamOpponentIsRecruiting(t *testing.T) {
    result, err := fixture.Registration.Execute(ctx, hostMember, UpdateRegistrationCommand{MatchID: matchID, TeamID: ptr(int64(7)), Attending: true})
    require.NoError(t, err)
    require.Equal(t, domain.GroupHostTeam, result.Group.Kind)
}

func TestUnselectedCandidateMemberCannotRegister(t *testing.T) {
    _, err := fixture.Registration.Execute(ctx, candidateMember, UpdateRegistrationCommand{MatchID: matchID, TeamID: ptr(int64(22)), Attending: true})
    require.ErrorIs(t, err, sharederror.ErrForbidden)
}

func TestHostMemberCannotJoinIndividualOpponent(t *testing.T) {
    _, err := fixture.Registration.Execute(ctx, hostMember, UpdateRegistrationCommand{MatchID: individualMatchID, Attending: true})
    require.ErrorIs(t, err, sharederror.ErrForbidden)
}

func TestIndividualRegistrationConfirmsAtMinAndClosesAtMax(t *testing.T) {
    registerIndividuals(t, fixture, 7)
    eighth := registerIndividual(t, fixture, user(8))
    require.Equal(t, domain.OpponentConfirmed, eighth.Match.OpponentState)
    require.Equal(t, domain.GroupOpen, eighth.Group.Status)
    registerIndividual(t, fixture, user(9))
    tenth := registerIndividual(t, fixture, user(10))
    require.Equal(t, domain.GroupClosed, tenth.Group.Status)
    _, err := fixture.Registration.Execute(ctx, user(11), individualJoin(individualMatchID))
    require.ErrorIs(t, err, sharederror.ErrConflict)
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/match/application -run 'TestHostMember|TestUnselected|TestIndividualRegistration' -v`

Expected: FAIL because registration use cases do not exist.

- [ ] **Step 3: Implement group resolution and permission checks**

For team registrations require explicit `team_id`, active membership, and an open group for that team. Without `team_id`, resolve only the individual-opponent group and reject active host-team members. Cancellation reactivates capacity and recalculates opponent state.

- [ ] **Step 4: Implement concurrency-safe PostgreSQL registration**

Lock the registration group with `FOR UPDATE`, count active registrations, reject only when `active >= max_players`, upsert/cancel the user's registration, then update group/opponent state inside the same transaction.

- [ ] **Step 5: Add max-capacity race test**

With one slot remaining, start two registrations concurrently. Assert one success, one conflict, and final active count exactly equals max.

- [ ] **Step 6: Run GREEN**

Run: `cd registration_system_go && go test -race ./internal/match/application ./internal/match/adapters/postgres -v`

Expected: PASS.

- [ ] **Step 7: Commit registration flow**

```bash
git add registration_system_go/internal/match registration_system_go/db/queries/match.sql
git commit -m "feat(go): add match registration groups"
```

### Task 9: Implement Admin Default Limits and Per-Match Overrides

**Files:**
- Create: `registration_system_go/internal/system/domain/match_limits.go`
- Create: `registration_system_go/internal/system/ports/repository.go`
- Create: `registration_system_go/internal/system/application/match_limits.go`
- Create: `registration_system_go/internal/system/application/match_limits_test.go`
- Create: `registration_system_go/internal/system/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/system/adapters/http/handler.go`
- Modify: `registration_system_go/internal/match/application/update_group_capacity.go`

- [ ] **Step 1: Write failing default and override tests**

```go
func TestMissingConfiguredLimitsUseSingleSideFormula(t *testing.T) {
    limits, err := NewMatchLimitsService(emptyLimitsRepo()).Resolve(ctx, 8)
    require.NoError(t, err)
    require.Equal(t, MatchLimits{PlayersPerTeam: 8, MinPlayers: 8, MaxPlayers: 10}, limits)
}

func TestAdminCanOverridePublishedIndividualLimitsWithoutChangingDefaults(t *testing.T) {
    err := fixture.Override.Execute(ctx, superAdmin, OverrideIndividualLimitsCommand{MatchID: matchID, MinPlayers: 7, MaxPlayers: 12})
    require.NoError(t, err)
    require.Equal(t, 7, fixture.IndividualGroup().MinPlayers)
    require.Equal(t, 12, fixture.IndividualGroup().MaxPlayers)
    require.Equal(t, MatchLimits{PlayersPerTeam: 8, MinPlayers: 8, MaxPlayers: 10}, fixture.Defaults.Resolve(8))
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/system/... ./internal/match/application -run 'TestMissing|TestAdminCanOverride' -v`

Expected: FAIL because system limits service does not exist.

- [ ] **Step 3: Implement defaults and admin override**

Validate positive `players_per_team`, `min > 0`, `max > 0`, and `min <= max`. Upsert defaults by `players_per_team`; Match creation copies resolved values. Per-Match override updates only the individual group and immediately recalculates open/closed and recruiting/confirmed state from current active count.

- [ ] **Step 4: Run GREEN**

Run: `cd registration_system_go && go test ./internal/system/... ./internal/match/application -v`

Expected: PASS.

- [ ] **Step 5: Commit system configuration**

```bash
git add registration_system_go/internal/system registration_system_go/internal/match registration_system_go/db/queries/system.sql
git commit -m "feat(go): configure match signup limits"
```

### Task 10: Publish OpenAPI and Gin HTTP Adapters

**Files:**
- Create: `registration_system_go/api/openapi.yaml`
- Create: generated `registration_system_go/internal/shared/adapters/httpapi/api.gen.go`
- Create: `registration_system_go/internal/match/adapters/http/dto.go`
- Create: `registration_system_go/internal/match/adapters/http/handler.go`
- Create: `registration_system_go/internal/match/adapters/http/routes.go`
- Create: `registration_system_go/internal/match/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`
- Modify: `registration_system_go/Makefile`

- [ ] **Step 1: Write failing route and contract tests**

```go
func TestAppAndAdminMatchRoutesAreIsolated(t *testing.T) {
    router := bootstrap.NewRouter(testDependencies())
    require.Equal(t, http.StatusUnauthorized, perform(router, "POST", "/api/matches", nil, "").Code)
    require.Equal(t, http.StatusForbidden, perform(router, "GET", "/api/admin/matches", nil, userToken).Code)
    require.Equal(t, http.StatusNotFound, perform(router, "GET", "/api/activity/infos", nil, userToken).Code)
    require.Equal(t, http.StatusNotFound, perform(router, "GET", "/api/challenges", nil, userToken).Code)
}
```

Add an OpenAPI test that parses `api/openapi.yaml`, verifies every canonical Match route, and asserts old activity/challenge paths are absent.

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/match/adapters/http ./internal/bootstrap -v`

Expected: FAIL because routes/contract do not exist.

- [ ] **Step 3: Define complete OpenAPI operations and generate types**

Include request/response schemas for all user/admin routes from the design, bearer auth, pagination, typed enums, and standard error response. Generate types/server interface with `oapi-codegen`; do not hand-maintain duplicate wire DTOs when generated types are sufficient.

- [ ] **Step 4: Implement Gin handlers and route groups**

Handlers bind generated DTOs, extract Actor, call one application use case, map domain/application errors centrally, and return the standard envelope. Build `/api` with user middleware and `/api/admin` with admin middleware; do not branch behavior by actor kind inside a shared route.

- [ ] **Step 5: Run GREEN and generation drift check**

Run: `cd registration_system_go && make generate && git diff --exit-code -- api internal/shared/adapters/httpapi && go test ./internal/match/adapters/http ./internal/bootstrap -v`

Expected: generated files stable and tests PASS.

- [ ] **Step 6: Commit HTTP API**

```bash
git add registration_system_go/api registration_system_go/internal registration_system_go/Makefile
git commit -m "feat(go): expose canonical match API"
```

### Task 11: Wire Production Dependencies and Verify the Backend

**Files:**
- Create: `registration_system_go/internal/bootstrap/dependencies.go`
- Create: `registration_system_go/internal/bootstrap/app.go`
- Modify: `registration_system_go/cmd/api/main.go`
- Modify: `registration_system_go/README.md`
- Modify: `registration_system_go/.env.example`
- Modify: `registration_system_go/AGENTS.md`
- Modify: `registration_system_go/CLAUDE.md`

- [ ] **Step 1: Write failing bootstrap smoke test**

```go
func TestBuildAppWithPostgresServesHealthAndRejectsUnauthenticatedMatchCreate(t *testing.T) {
    databaseURL := testsupport.StartPostgresURL(t)
    app, cleanup, err := BuildApp(Config{DatabaseURL: databaseURL, JWTSecret: testSecret, WechatAppID: "test", WechatAppSecret: "test"})
    require.NoError(t, err)
    t.Cleanup(cleanup)
    require.Equal(t, http.StatusOK, perform(app.Router, "GET", "/health", nil, "").Code)
    require.Equal(t, http.StatusUnauthorized, perform(app.Router, "POST", "/api/matches", validPayload(), "").Code)
}
```

- [ ] **Step 2: Run RED**

Run: `cd registration_system_go && go test ./internal/bootstrap -run TestBuildAppWithPostgres -v`

Expected: FAIL because `BuildApp` is not wired.

- [ ] **Step 3: Implement dependency injection and lifecycle**

Open pgx pool, construct sqlc-backed repositories, JWT/WeChat adapters, use cases, handlers, Gin route groups, HTTP server timeouts, and graceful shutdown. `main.go` only loads config, builds the app, runs it, and logs fatal startup errors without printing secrets.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
cd registration_system_go
gofmt -w .
go test -race ./...
go vet ./...
go build ./cmd/api
```

Expected: all commands exit 0 with no failing tests or vet diagnostics.

- [ ] **Step 5: Run local HTTP smoke check**

Start PostgreSQL, apply migrations, run the server, then verify:

```bash
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/api/matches
curl -i http://127.0.0.1:8080/api/activity/infos
```

Expected: health 200, unauthenticated Match request 401, old Activity path 404.

- [ ] **Step 6: Update project working documents**

Record completed tasks and exact verification output in the Go subproject `task_plan.md`, `findings.md`, and `progress.md`. Confirm root and Go `AGENTS.md/CLAUDE.md` describe the actual commands and scope.

- [ ] **Step 7: Commit production wiring**

```bash
git add registration_system_go AGENTS.md CLAUDE.md README.md
git commit -m "feat(go): complete match backend phase one"
```

## Phase 1 Exit Criteria

- `registration_system_go` starts against a clean PostgreSQL database;
- real JWT middleware and WeChat gateway are wired;
- only captain/leader roles can publish;
- all three Match modes satisfy the approved lifecycle;
- host registration opens immediately for every mode;
- only selected guest teams receive a guest registration group;
- individual opponent confirms at min and closes at max;
- team selection/withdrawal and capacity enforcement pass race/integration tests;
- admin defaults and per-Match overrides work;
- OpenAPI contains only canonical Match routes;
- Rust source remains byte-for-byte untouched by Phase 1 commits;
- `go test -race ./...`, `go vet ./...`, and `go build ./cmd/api` pass.
