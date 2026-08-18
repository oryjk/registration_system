# 比赛球服颜色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 比赛支持主队/客队球服颜色：小程序创建时提交已收集的颜色，管理端编辑时可设置（默认主白 #FFFFFF、客红 #FF0000），小程序详情展示真实颜色、未设置走默认色。

**Architecture:** Go `matches` 表新增可空 `host_color`/`away_color` 列，domain 层校验归一化 hex6；用户端创建/详情与管理端编辑 DTO 透传；管理端 React 表单用 antd ColorPicker；小程序把表单颜色接进创建 payload 并在详情页映射展示。存量数据不迁移（NULL → 读侧兜底）。

**Tech Stack:** Go 1.26.5 + Gin + pgx + sqlc（`emit_pointers_for_null_types`）+ goose；React + TS + Ant Design 5 + Bun；uni-app + Vue 3 + TS + bun test。

**Spec:** `docs/superpowers/specs/2026-08-18-match-jersey-colors-design.md`

## Global Constraints

- 工作区当前有**其他未提交改动**（小程序修复批次 + spec 文档）。每次提交只 `git add` 本任务明确列出的文件，禁止 `git add -A` / `git add .`。
- Go 模块代理固定：`GOPROXY=https://goproxy.cn,direct`、`GOSUMDB=sum.golang.google.cn`（Makefile 已内置，用 `make` 目标即可）。
- 颜色格式统一 `#rrggbb` 小写 hex6；空 = 未设置；非法格式返回 KindValidation 错误。
- 不修改 `registration_system_rs/`（冻结）；不做存量颜色迁移。
- PostgreSQL 集成测试只认显式 `TEST_DATABASE_URL`，未设置自动 skip；禁止 TRUNCATE 共享表。
- 提交信息用英文 conventional 风格（`feat(go): ...` / `feat(admin): ...` / `feat(mini): ...`）。

---

### Task 1: Go domain — 球服颜色字段、校验与三态更新

**Files:**
- Modify: `registration_system_go/internal/match/domain/match.go`
- Test: `registration_system_go/internal/match/domain/match_test.go`（追加，package domain，复用文件内既有 `validInput` 辅助函数）

**Interfaces:**
- Consumes: 现有 `NewMatchInput` / `UpdateMatchDetails` / `trimOptional`。
- Produces（后续任务依赖的精确签名）:
  - `Match.HostColor string`、`Match.AwayColor string`（空串 = 未设置）
  - `NewMatchInput.HostColor *string`、`NewMatchInput.AwayColor *string`
  - `UpdateMatchDetails.HostColor *string`、`UpdateMatchDetails.AwayColor *string`（nil=不改；空串=清除；值=设置）
  - `func NormalizeJerseyColor(raw string) (string, error)`

- [ ] **Step 1: 写失败测试（追加到 match_test.go 末尾）**

```go
func TestNormalizeJerseyColor(t *testing.T) {
	got, err := NormalizeJerseyColor("  #2F6BFF ")
	if err != nil || got != "#2f6bff" {
		t.Fatalf("want #2f6bff, got %q err=%v", got, err)
	}
	if got, err := NormalizeJerseyColor(""); err != nil || got != "" {
		t.Fatalf("empty should pass through, got %q err=%v", got, err)
	}
	if _, err := NormalizeJerseyColor("#fff"); err == nil {
		t.Fatal("3-digit hex should be rejected")
	}
	if _, err := NormalizeJerseyColor("2f6bff"); err == nil {
		t.Fatal("missing # should be rejected")
	}
}

func TestNewMatchStoresNormalizedJerseyColors(t *testing.T) {
	host, away := "#2F6BFF", "#C8FF00"
	input := validInput(OnlineTeam)
	input.HostColor, input.AwayColor = &host, &away
	match, _, err := NewMatch(input, IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	if match.HostColor != "#2f6bff" || match.AwayColor != "#c8ff00" {
		t.Fatalf("colors not normalized: %q %q", match.HostColor, match.AwayColor)
	}

	bad := "magenta"
	input2 := validInput(OnlineTeam)
	input2.HostColor = &bad
	if _, _, err := NewMatch(input2, IndividualLimits{}); err == nil {
		t.Fatal("invalid color should fail creation")
	}
}

func TestUpdateDetailsJerseyColorThreeStates(t *testing.T) {
	match, _, err := NewMatch(validInput(OnlineTeam), IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	now := time.Now().UTC()

	set := "#ff0000"
	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) { u.HostColor = &set }), now); err != nil {
		t.Fatalf("set color: %v", err)
	}
	if match.HostColor != "#ff0000" {
		t.Fatalf("want #ff0000, got %q", match.HostColor)
	}

	clear := ""
	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) { u.HostColor = &clear }), now); err != nil {
		t.Fatalf("clear color: %v", err)
	}
	if match.HostColor != "" {
		t.Fatalf("cleared color should be empty, got %q", match.HostColor)
	}

	if err := match.UpdateDetails(UpdateDetailsInput(match, func(u *UpdateMatchDetails) {}), now); err != nil {
		t.Fatalf("nil color keeps value: %v", err)
	}
}
```

`UpdateDetailsInput` 是避免重复填十几个字段的测试辅助（放在同文件）：以 match 当前值填充 `UpdateMatchDetails`，再由 fn 覆盖：

```go
func UpdateDetailsInput(m Match, fn func(*UpdateMatchDetails)) UpdateMatchDetails {
	input := UpdateMatchDetails{
		Name: m.Name, StartTime: m.StartTime, EndTime: m.EndTime,
		RegistrationStartAt: m.RegistrationStartAt, RegistrationEndAt: m.RegistrationEndAt,
		Location: m.Location, LocationLatitude: m.LocationLatitude, LocationLongitude: m.LocationLongitude,
		Description: m.Description,
	}
	fn(&input)
	return input
}
```

（若 `validInput` 返回的 `NewMatchInput` 字段与上面用法有出入，以现文件为准微调，测试意图不变。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd registration_system_go && go test ./internal/match/domain/ -run 'JerseyColor|NormalizeJersey' -v`
Expected: FAIL，`undefined: NormalizeJerseyColor` / `input.HostColor undefined`。

- [ ] **Step 3: 最小实现（match.go）**

顶部 import 增加 `"regexp"`。`Match` 结构体 `Description *string` 之后、`IsFree` 之前加：

```go
	HostColor           string
	AwayColor           string
```

`NewMatchInput` 同位置加：

```go
	HostColor           *string
	AwayColor           *string
```

新增校验函数与模式（放在 `trimOptional` 附近）：

```go
var jerseyColorPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)

// NormalizeJerseyColor 校验并归一化球服颜色；空串原样返回（表示清除/未设置）。
func NormalizeJerseyColor(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	lower := strings.ToLower(trimmed)
	if !jerseyColorPattern.MatchString(lower) {
		return "", sharederror.New(sharederror.KindValidation, "球服颜色必须是 #RRGGBB 格式")
	}
	return lower, nil
}
```

`validateNewMatchInput` 的 `LocationLatitude/Longitude` 校验之后加：

```go
	for _, color := range []*string{input.HostColor, input.AwayColor} {
		if color == nil {
			continue
		}
		if _, err := NormalizeJerseyColor(*color); err != nil {
			return err
		}
	}
```

`NewMatch` 的 `match := Match{...}` 中 `Description:` 之后加（并对 error 提前返回）：

```go
	hostColor, err := normalizeOptionalColor(input.HostColor)
	if err != nil {
		return Match{}, nil, err
	}
	awayColor, err := normalizeOptionalColor(input.AwayColor)
	if err != nil {
		return Match{}, nil, err
	}
	// match 字面量中：
	HostColor: hostColor,
	AwayColor: awayColor,
```

辅助函数：

```go
func normalizeOptionalColor(value *string) (string, error) {
	if value == nil {
		return "", nil
	}
	return NormalizeJerseyColor(*value)
}
```

`UpdateMatchDetails` 结构体 `OpponentName *string` 之后加：

```go
	// HostColor/AwayColor 非 nil 时更新球服颜色（空串清除为 NULL）；nil 表示不改。
	HostColor *string
	AwayColor *string
```

`UpdateDetails` 方法中 `opponentName` 处理之后、`validation := NewMatchInput{...}` 之前加，并在赋值段 `m.OpponentName = opponentName` 后加：

```go
	hostColor := m.HostColor
	if input.HostColor != nil {
		if hostColor, err = NormalizeJerseyColor(*input.HostColor); err != nil {
			return err
		}
	}
	awayColor := m.AwayColor
	if input.AwayColor != nil {
		if awayColor, err = NormalizeJerseyColor(*input.AwayColor); err != nil {
			return err
		}
	}
	// 赋值段：
	m.HostColor = hostColor
	m.AwayColor = awayColor
```

（`UpdateDetails` 里已有 `err` 变量则复用；没有则 `if v, err := NormalizeJerseyColor(...); err != nil { return err } else { hostColor = v }` 形式。）

- [ ] **Step 4: 跑测试确认通过**

Run: `go test ./internal/match/domain/ -v`
Expected: 全部 PASS（含既有用例）。

- [ ] **Step 5: 提交**

```bash
cd /Users/carlwang/registration_system/registration_system_go
gofmt -w internal/match/domain/
git add internal/match/domain/match.go internal/match/domain/match_test.go
git commit -m "feat(go): match jersey color fields with hex validation"
```

---

### Task 2: Go 持久化 — 迁移、SQL、sqlc、repository

**Files:**
- Create: `registration_system_go/db/migrations/00014_match_jersey_colors.sql`
- Modify: `registration_system_go/db/queries/match.sql`（`CreateMatch` 插入列、`UpdateMatchDetails` SET 子句）
- Regenerate: `registration_system_go/internal/match/adapters/postgres/sqlc/`（`make generate`）
- Modify: `registration_system_go/internal/match/adapters/postgres/repository.go`
- Test: `registration_system_go/internal/match/adapters/postgres/repository_test.go`（追加）

**Interfaces:**
- Consumes: Task 1 的 `Match.HostColor/AwayColor string`；sqlc `emit_pointers_for_null_types`（可空 TEXT 列生成 `*string`）。
- Produces: `CreateMatchParams.HostColor/AwayColor *string`、`UpdateMatchDetailsParams.HostColor/AwayColor *string`（sqlc 生成）；repository `mapMatch`/`createMatchParams`/`UpdateDetails` 全部携带颜色。

- [ ] **Step 1: 写迁移 00014_match_jersey_colors.sql**

```sql
-- +goose Up
ALTER TABLE matches
    ADD COLUMN host_color TEXT NULL,
    ADD COLUMN away_color TEXT NULL;

-- +goose Down
ALTER TABLE matches
    DROP COLUMN away_color,
    DROP COLUMN host_color;
```

（格式对齐 00013 现有文件的注释风格；`db/migrations_test.go` 会校验版本唯一。）

- [ ] **Step 2: 改 match.sql**

`CreateMatch` 插入列清单 `is_free,` 之后、`created_by_user_id,` 之前加两列；VALUES 加 `$21, $22`：

```sql
    is_free,
    host_color,
    away_color,
    created_by_user_id,
    created_by_admin_id
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
)
```

`UpdateMatchDetails` SET 子句 `opponent_name = $11,` 之后加：

```sql
    host_color = $12,
    away_color = $13,
    updated_at = NOW()
```

- [ ] **Step 3: 重新生成 sqlc**

Run: `cd registration_system_go && make generate`
Expected: `internal/match/adapters/postgres/sqlc/match.sql.go` 中 `CreateMatchParams`/`UpdateMatchDetailsParams` 出现 `HostColor/AwayColor *string`，`Match` 行结构出现同名字段。若 `make generate` 不可用，`sqlc generate`（v1.31.1）。

- [ ] **Step 4: 写失败集成测试（追加到 repository_test.go，复用既有 `seedMatchOwner`、`repositoryTestClock` 辅助）**

```go
func TestRepositoryPersistsJerseyColors(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, teamID := seedMatchOwner(t, pool)

	input := validOnlineTeamInput(t, ownerID, teamID)
	host, away := "#2F6BFF", "#C8FF00"
	input.HostColor, input.AwayColor = &host, &away
	match, groups, err := domain.NewMatch(input, domain.IndividualLimits{})
	if err != nil {
		t.Fatalf("new match: %v", err)
	}
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create: %v", err)
	}

	loaded, _, found, err := repository.FindByID(ctx, match.ID)
	if err != nil || !found {
		t.Fatalf("find: %v found=%v", err, found)
	}
	if loaded.HostColor != "#2f6bff" || loaded.AwayColor != "#c8ff00" {
		t.Fatalf("colors not round-tripped: %q %q", loaded.HostColor, loaded.AwayColor)
	}

	clear := ""
	loaded.HostColor = ""
	loaded.AwayColor = ""
	if err := loaded.UpdateDetails(domain.UpdateMatchDetails{
		Name: loaded.Name, StartTime: loaded.StartTime, EndTime: loaded.EndTime,
		Location: loaded.Location, HostColor: &clear, AwayColor: &clear,
	}, time.Now().UTC()); err != nil {
		t.Fatalf("clear colors: %v", err)
	}
	if err := repository.UpdateDetails(ctx, loaded, nil); err != nil {
		t.Fatalf("update: %v", err)
	}
	reloaded, _, _, err := repository.FindByID(ctx, match.ID)
	if err != nil {
		t.Fatalf("refind: %v", err)
	}
	if reloaded.HostColor != "" || reloaded.AwayColor != "" {
		t.Fatalf("cleared colors should be empty, got %q %q", reloaded.HostColor, reloaded.AwayColor)
	}
}
```

`validOnlineTeamInput` 若文件中无现成等价辅助，就地新增（基于 domain 包测试的 `validInput` 字段复制到 repository 包，创建者用 `CreatedByUserID: &ownerID`、`HostTeamID: teamID`、`PublicationMode: domain.OnlineTeam`、起止时间晚于 now）。

Run: `TEST_DATABASE_URL=<本地测试库> go test ./internal/match/adapters/postgres/ -run TestRepositoryPersistsJerseyColors -v`
Expected: FAIL —— 编译错误 `unknown field HostColor`（sqlc 未接线前先失败于 params/row 缺字段；若已在 Step 3 生成则失败于 repository 未赋值导致空值断言）。

- [ ] **Step 5: 实现 repository.go**

`createMatchParams` 的 `Description:` 之后加：

```go
		HostColor:           stringPointerOrNil(match.HostColor),
		AwayColor:           stringPointerOrNil(match.AwayColor),
```

`UpdateDetails` 方法的 `queries.UpdateMatchDetails(ctx, ...)` 参数 `OpponentName: match.OpponentName,` 之后加：

```go
		HostColor: stringPointerOrNil(match.HostColor),
		AwayColor: stringPointerOrNil(match.AwayColor),
```

`mapMatch` 的 `Description: row.Description,` 之后加：

```go
		HostColor:           textValue(row.HostColor),
		AwayColor:           textValue(row.AwayColor),
```

文件内 `int32Pointer` 辅助旁新增（若命名冲突改为 `jerseyColorPointer`）：

```go
func stringPointerOrNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func textValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
```

- [ ] **Step 6: 跑集成测试确认通过 + 全量回归**

Run: `TEST_DATABASE_URL=<本地测试库> go test ./internal/match/... -v`
Expected: PASS（含既有全部用例）。

- [ ] **Step 7: 提交**

```bash
gofmt -w internal/match/adapters/postgres/
git add db/migrations/00014_match_jersey_colors.sql db/queries/match.sql internal/match/adapters/postgres/repository.go internal/match/adapters/postgres/repository_test.go internal/match/adapters/postgres/sqlc/
git commit -m "feat(go): persist match jersey colors with sqlc and migration"
```

---

### Task 3: Go API — application 命令、HTTP DTO、OpenAPI

**Files:**
- Modify: `registration_system_go/internal/match/application/create_match.go`（`CreateMatchCommand`）
- Modify: `registration_system_go/internal/match/application/admin_service.go`（`UpdateMatchCommand`）
- Modify: `registration_system_go/internal/match/adapters/http/user_handler.go`（`CreateMatchRequest` 由 admin_handler.go 声明、两端共用；`UserMatchResponse` + `mapUserMatch`）
- Modify: `registration_system_go/internal/match/adapters/http/admin_handler.go`（`CreateMatchRequest`、`UpdateMatchRequest`、`MatchResponse` + `mapMatch`）
- Modify: `registration_system_go/docs/openapi.yaml`
- Test: 追加 `registration_system_go/internal/match/adapters/http/user_handler_test.go`、`admin_handler_test.go` 用例

**Interfaces:**
- Consumes: Task 1/2 的 domain 字段与持久化。
- Produces（前端任务依赖的 JSON 契约）: 创建请求 `host_color`/`away_color`（可选字符串）；所有比赛响应含 `"host_color": "#rrggbb" | null, "away_color": ...`；管理端 PATCH 三态（字段缺省=不改，`""`=清除，值=设置）。

- [ ] **Step 1: 写失败 handler 测试（追加到 user_handler_test.go，沿用文件内既有构造请求/断言辅助）**

核心断言（按既有测试的 router/请求搭建方式适配）：

```go
func TestCreateMatchStoresJerseyColors(t *testing.T) {
	// 既有测试里创建比赛的 JSON body 增加：
	//   "host_color": "#2F6BFF",
	//   "away_color": "#C8FF00",
	// 断言响应 data.host_color == "#2f6bff" 且 data.away_color == "#c8ff00"（归一化后回显）。
}

func TestCreateMatchRejectsInvalidJerseyColor(t *testing.T) {
	// body 带 "host_color": "red" → 400（KindValidation 映射）。
}
```

admin_handler_test.go 追加：

```go
func TestAdminUpdateMatchJerseyColorThreeStates(t *testing.T) {
	// PATCH body 带 "host_color": "#FF0000" → 200 且 data.host_color == "#ff0000"；
	// 再 PATCH "host_color": "" → data.host_color == null；
	// 再 PATCH 不带字段 → data.host_color 保持 null（未设置）。
}
```

（按两个测试文件既有的 mock service / router 构造方式落地；若 handler 测试走真实 application + 内存 fake repository，则按现有模式扩展 fake。）

Run: `go test ./internal/match/adapters/http/ -run JerseyColor -v`
Expected: FAIL（请求字段被忽略 / 响应无 host_color）。

- [ ] **Step 2: 实现 application 层**

`create_match.go` `CreateMatchCommand` 的 `Description *string` 之后加：

```go
	HostColor *string
	AwayColor *string
```

`Execute` 内组装 `domain.NewMatchInput{...}` 处（`Description: command.Description,` 之后）加：

```go
		HostColor: command.HostColor,
		AwayColor: command.AwayColor,
```

`admin_service.go` `UpdateMatchCommand` 的 `OpponentName *string` 注释块之后加：

```go
	// HostColor/AwayColor 非 nil 时更新球服颜色（空串清除）；nil 表示不改。
	HostColor *string
	AwayColor *string
```

该 service 组装 `domain.UpdateMatchDetails{...}` 处（`OpponentName:` 之后）加：

```go
		HostColor: command.HostColor,
		AwayColor: command.AwayColor,
```

- [ ] **Step 3: 实现 HTTP DTO**

`admin_handler.go` `CreateMatchRequest` 的 `Description *string` 之后加：

```go
	HostColor           *string                `json:"host_color"`
	AwayColor           *string                `json:"away_color"`
```

`UpdateMatchRequest` 的 `HostCapacityLimit` 之后加：

```go
	// HostColor/AwayColor 为 nil（未传或 null）表示本次不修改；传空串表示清除。
	HostColor *string `json:"host_color"`
	AwayColor *string `json:"away_color"`
```

`MatchResponse` 的 `Description *string` 之后加：

```go
	HostColor           *string                `json:"host_color"`
	AwayColor           *string                `json:"away_color"`
```

`admin_handler.go` 的 `mapMatch` 赋值段 `Description: match.Description,` 之后加：

```go
		HostColor: jerseyColorResponse(match.HostColor), AwayColor: jerseyColorResponse(match.AwayColor),
```

`user_handler.go` `UserMatchResponse` 的 `Description *string` 之后加同名字段（json 同上）；`mapUserMatch` 赋值段加：

```go
		HostColor: jerseyColorResponse(match.HostColor), AwayColor: jerseyColorResponse(match.AwayColor),
```

两个 handler 的创建/更新调用点把新字段传入 command（user_handler.go `application.CreateMatchCommand{...}` 加 `HostColor: request.HostColor, AwayColor: request.AwayColor,`；admin 创建同理；admin 更新的 `UpdateMatchCommand` 同理）。

共用辅助放 `user_handler.go`（同 package）：

```go
func jerseyColorResponse(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
```

- [ ] **Step 4: 更新 docs/openapi.yaml**

在比赛相关 schema（`UserMatch`/`MatchDetail`/创建请求/管理端更新请求，按现有字段 `opponent_name` 的位置）追加：

```yaml
        host_color:
          type: string
          nullable: true
          description: 主队球服颜色（#rrggbb，未设置为 null）
          example: "#ffffff"
        away_color:
          type: string
          nullable: true
          description: 客队球服颜色（#rrggbb，未设置为 null）
          example: "#ff0000"
```

（创建/更新请求 schema 中去掉 `nullable`，仅可选字符串。）

- [ ] **Step 5: 跑测试确认通过（含 openapi_test）**

Run: `go test ./internal/match/... ./docs/ -v && go vet ./... && go build -o /tmp/registration-system-go-api ./cmd/api`
Expected: 全 PASS。

- [ ] **Step 6: 提交**

```bash
gofmt -w internal/match/
git add internal/match/application/create_match.go internal/match/application/admin_service.go internal/match/adapters/http/ docs/openapi.yaml
git commit -m "feat(go): expose jersey colors on match create, detail and admin update APIs"
```

（`git add internal/match/adapters/http/` 会包含两个测试文件，符合本任务范围。）

---

### Task 4: 管理端 FE — 类型、payload、ColorPicker 表单

**Files:**
- Modify: `registration_system_backend_fe_go/src/types/match.ts`
- Modify: `registration_system_backend_fe_go/src/utils/match-form-payload.ts`
- Modify: `registration_system_backend_fe_go/src/pages/MatchFormPage.tsx`
- Test: `registration_system_backend_fe_go/src/utils/match-form-payload.test.ts`（追加）

**Interfaces:**
- Consumes: Task 3 的 JSON 契约（`host_color`/`away_color` 可空字符串）。
- Produces: `MatchFormPayloadValues.host_color?: string; away_color?: string`；payload 恒定输出小写 hex6 或 null。

- [ ] **Step 1: 写失败 payload 测试（追加到 match-form-payload.test.ts，复用文件内既有 values 构造）**

```ts
test("carries jersey colors normalized to lowercase hex", () => {
  const values = baseFormValues({ host_color: "#2F6BFF", away_color: "#FF0000" });
  expect(buildCreateMatchPayload(values)).toMatchObject({
    host_color: "#2f6bff",
    away_color: "#ff0000",
  });
  expect(buildUpdateMatchPayload(values)).toMatchObject({
    host_color: "#2f6bff",
    away_color: "#ff0000",
  });
});

test("omits jersey colors when unset so update keeps them untouched", () => {
  const values = baseFormValues({});
  expect(buildUpdateMatchPayload(values)).toMatchObject({
    host_color: null,
    away_color: null,
  });
});
```

（`baseFormValues` 为文件内既有构造辅助的包装：展开默认必填字段再覆盖；若无现成辅助则就地补齐最小必填字段。）

Run: `cd registration_system_backend_fe_go && bun test src/utils/match-form-payload.test.ts`
Expected: FAIL（类型/字段不存在）。

- [ ] **Step 2: types/match.ts**

`MatchItem` 的 `description: string | null;` 之后加：

```ts
  host_color: string | null;
  away_color: string | null;
```

`CreateMatchPayload` 与 `UpdateMatchPayload` 末尾各加：

```ts
  host_color?: string | null;
  away_color?: string | null;
```

- [ ] **Step 3: match-form-payload.ts**

`MatchFormPayloadValues` 的 `description?: string;` 之后加：

```ts
  host_color?: string;
  away_color?: string;
```

新增归一化（文件内、`defaultHostCapacityLimit` 旁）：

```ts
// 球服颜色统一提交小写 hex6；未设置返回 null（创建走默认，更新表示不改）。
function normalizeJerseyColor(value?: string): string | null {
  const trimmed = value?.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed ?? "") ? trimmed : null;
}
```

`buildUpdateMatchPayload` 返回对象加：

```ts
    host_color: normalizeJerseyColor(values.host_color),
    away_color: normalizeJerseyColor(values.away_color),
```

（`buildCreateMatchPayload` 展开 `buildUpdateMatchPayload` 自动携带。）

- [ ] **Step 4: MatchFormPage.tsx**

`MatchFormValues` 的 `description?: string;` 之后加 `host_color?: string; away_color?: string;`；`initialValues` 加 `host_color: "#FFFFFF", away_color: "#FF0000"`；编辑回填 `formInitialValues` 的 `description:` 之后加：

```ts
        host_color: match.host_color || "#FFFFFF",
        away_color: match.away_color || "#FF0000",
```

表单区（`opponent_name` 的 Form.Item 附近、对手信息之后）加两个 Form.Item，`import { ColorPicker } from "antd"`（并入现有 antd import）：

```tsx
<Form.Item label="主队球服颜色" name="host_color"
  getValueFromEvent={(color) => color.toHexString()}
  rules={[{ pattern: /^#[0-9a-fA-F]{6}$/, message: "颜色格式必须为 #RRGGBB" }]}>
  <ColorPicker showText presets={jerseyColorPresets} />
</Form.Item>
<Form.Item label="客队球服颜色" name="away_color"
  getValueFromEvent={(color) => color.toHexString()}
  rules={[{ pattern: /^#[0-9a-fA-F]{6}$/, message: "颜色格式必须为 #RRGGBB" }]}>
  <ColorPicker showText presets={jerseyColorPresets} />
</Form.Item>
```

组件外常量：

```ts
const jerseyColorPresets = [
  {
    label: "常用球服色",
    colors: [
      "#FFFFFF", "#FF0000", "#2F6BFF", "#111310",
      "#C8FF00", "#FF6B35", "#B34DFF", "#D8DDE6",
    ],
  },
];
```

- [ ] **Step 5: 验证**

Run: `bun test src/utils/match-form-payload.test.ts && bun run type-check && bun run build`
Expected: 测试 PASS、类型与构建通过。

- [ ] **Step 6: 提交**

```bash
git add src/types/match.ts src/utils/match-form-payload.ts src/utils/match-form-payload.test.ts src/pages/MatchFormPage.tsx
git commit -m "feat(admin): jersey color pickers on match form with white/red defaults"
```

---

### Task 5: 小程序 — 创建 payload 接线与详情展示

**Files:**
- Modify: `registration_system_mini/src/api/match.ts`（`CreateMatchPayload`）
- Modify: `registration_system_mini/src/types/match.ts`（`AppMatchSummary`）
- Modify: `registration_system_mini/src/pages/matches/create/createMatchPayload.ts`
- Modify: `registration_system_mini/src/pages/matches/detailData.ts`（`toBackendActivity`）
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`（兜底色）
- Test: `registration_system_mini/src/pages/matches/create/__tests__/createMatchPayload.test.ts`、`src/pages/matches/__tests__/detailData.test.ts`（追加）

**Interfaces:**
- Consumes: Task 3 契约；表单模型既有 `MatchPublishFormModel.color/opposingColor: string`。
- Produces: 创建请求带 `host_color`/`away_color`；`BackendActivity.color/opposing_color` 映射自新字段（空串 = 未设置）。

- [ ] **Step 1: 写失败测试**

`createMatchPayload.test.ts` 追加（复用文件内既有 form/hostTeam 构造）：

```ts
test("把表单球服颜色映射为 host_color/away_color", () => {
  const payload = buildCreateMatchPayload(withForm({ color: "#2F6BFF", opposingColor: "#C8FF00" }), hostTeam);
  expect(payload.host_color).toEqual("#2F6BFF");
  expect(payload.away_color).toEqual("#C8FF00");
});
```

`detailData.test.ts` 追加：

```ts
test("maps jersey colors from the match api onto the activity model", () => {
  const activity = toBackendActivity({
    ...matchSummary,
    host_color: "#2f6bff",
    away_color: "#ff0000",
  });
  expect({ color: activity.color, opposing_color: activity.opposing_color }).toEqual({
    color: "#2f6bff",
    opposing_color: "#ff0000",
  });

  const unset = toBackendActivity(matchSummary);
  expect({ color: unset.color, opposing_color: unset.opposing_color }).toEqual({
    color: "",
    opposing_color: "",
  });
});
```

（`withForm` 为既有构造辅助包装，按文件现状适配。）

Run: `cd registration_system_mini && bun test src/pages/matches/create/__tests__/createMatchPayload.test.ts src/pages/matches/__tests__/detailData.test.ts`
Expected: FAIL（`host_color` 不在 payload / `AppMatchSummary` 无该字段导致类型或断言失败）。

- [ ] **Step 2: 实现**

`src/types/match.ts` `AppMatchSummary` 的 `is_free?: boolean;` 之后加：

```ts
  host_color?: string | null;
  away_color?: string | null;
```

`src/api/match.ts` `CreateMatchPayload` 的 `is_free?: boolean;` 之后加：

```ts
  host_color?: string;
  away_color?: string;
```

`createMatchPayload.ts` 返回对象 `is_free:` 之后加：

```ts
    ...(form.color ? { host_color: form.color } : {}),
    ...(form.opposingColor ? { away_color: form.opposingColor } : {}),
```

`detailData.ts` `toBackendActivity` 中删除硬编码 `color: "#9be22b"` / `opposing_color: "#0f766e"`，改为：

```ts
    color: match.host_color ?? "",
    opposing_color: match.away_color ?? "",
```

`useMatchDetailPage.ts` 兜底色改为：

```ts
  const homeTeamColor = computed(() => match.value?.color?.trim() || "#FFFFFF");
  const awayTeamColor = computed(() => match.value?.opposing_color?.trim() || "#FF0000");
```

- [ ] **Step 3: 跑测试与既有回归**

Run: `bun test src/pages/matches/ && bun run type-check`
Expected: 新旧用例 PASS（注意既有 `toBackendActivity` 相关断言若写死了旧硬编码色值，按新语义修正断言——未设置为空串）。

- [ ] **Step 4: 小程序构建验证**

Run: `MINI_REVIEW_SKIP=1 bun run build:mp-weixin`
Expected: 构建成功、组件注册检查通过；构建后 `git checkout -- src/manifest.json src/config/generatedMiniProgramVersion.ts` 还原版本号副作用。

- [ ] **Step 5: 提交**

```bash
git add src/api/match.ts src/types/match.ts src/pages/matches/create/createMatchPayload.ts src/pages/matches/create/__tests__/createMatchPayload.test.ts src/pages/matches/detailData.ts src/pages/matches/useMatchDetailPage.ts src/pages/matches/__tests__/detailData.test.ts
git commit -m "feat(mini): submit and display match jersey colors with white/red fallback"
```

---

### Task 6: 全量验证与 out109 部署

**Files:** 无代码改动（验证与部署）。

- [ ] **Step 1: Go 全量**

Run: `cd registration_system_go && gofmt -w . && go test -race ./... && go vet ./... && go build -o /tmp/registration-system-go-api ./cmd/api`
Expected: 全部通过（集成测试无 `TEST_DATABASE_URL` 时按规则 skip）。

- [ ] **Step 2: 管理端**

Run: `cd registration_system_backend_fe_go && bun run type-check && bun run lint && bun run build`
Expected: 通过。

- [ ] **Step 3: 小程序**

Run: `cd registration_system_mini && bun run type-check && bun test`
Expected: 通过（既有 3 个存量失败除外：`App session foundation` ×2、`create match Wot UI integration` ×1，与本次无关）。

- [ ] **Step 4: 部署 out109（Go + H5 + 管理端全量，含 DB 迁移）**

Run: `cd /Users/carlwang/registration_system && ./deploy_out109_go_h5.sh`
前置：本地 main 已推送 origin（任务 1-5 的提交需先 push；工作区若有上一批未提交修复文件，先按用户指示处理）。脚本会先跑 goose 迁移（00014）再替换容器。
Expected: 脚本末尾健康检查与三端入口校验全绿。

- [ ] **Step 5: 人工验收清单**

1. 管理端编辑任一比赛 → 球服颜色默认显示白/红 → 改色保存 → 刷新回显。
2. 小程序 H5（oryjk.cn:82/mini-v3/）创建比赛选色 → 提交 → 详情页 hero 旗标/球服点显示所选色。
3. 未设置颜色的存量比赛详情 → 主白客红。
4. 小程序正式版随下次 `mp:release` 发版携带（本任务不执行发版）。

---

## Self-Review 记录

- Spec 覆盖：迁移/领域校验（Task 1-2）、用户端创建+详情/列表响应（Task 3，`UserMatchResponse` 被 `mapUserMatch`/`mapUserDetail` 复用）、管理端 PATCH 三态（Task 3）、管理端 UI（Task 4）、小程序 payload/展示/兜底（Task 5）、存量不迁移（Global Constraints）、OpenAPI（Task 3）。
- 类型一致性：domain `string`（空=未设置）、DB/DTO/FE 可空以 `*string`/`string | null` 表达，响应 null 语义统一。
- 无占位符；测试代码均为可落地形态（标注了需按既有文件辅助函数适配的两处）。
