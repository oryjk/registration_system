# 散人约球一人代多人报名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 散人约球（online_pickup）支持一人代多人报名：报名时选择人数 N，费用 = N × 人均费用，已支付后禁止修改/取消。

**Architecture:** 效开数据库既有的 `registration_count` 字段（方案 A）：后端放开三处 count=1 闸口、费用乘人数、下单前关闭旧 pending 订单、DTO 透出 count/paid；小程序新增报名人数面板；管理端名册展示人数与支付状态。同时修复两个阻断性存量缺陷（pickup 查询不可见、支付字段未映射）。

**Tech Stack:** Go + Gin + PostgreSQL + pgx + sqlc（后端）；uni-app + Vue 3 + TypeScript（小程序）；React + Ant Design（管理端）。

**Spec:** `docs/superpowers/specs/2026-08-19-pickup-multi-person-registration-design.md`

## Global Constraints

- 仅 `publication_mode = online_pickup` 且分组为 `individual_opponent` 允许 `registration_count > 1`；其他场景必须 = 1。
- 未支付可改人数/取消；已支付禁止修改与取消（幂等同值提交放行）。
- 人数上限 = 剩余名额（`max_players - 非本人 attending 人数和`）。
- 订单金额上限 `MembershipMaxAmountCents = 1_000_000`（现有校验）。
- Go 提交前：`gofmt -w .`、`go test -race ./...`、`go vet ./...`、`go build -o /tmp/registration-system-go-api ./cmd/api`。
- 小程序：`bun run type-check`；管理端：`bun run type-check`、`bun run lint`、`bun run build`。
- sqlc 生成用 `make generate`（`go run sqlc`，无需本地安装）。
- 不改 Rust 项目、不动小程序 legacy 挑战链路（`challenges/detail.vue`、`updateMyStand` 分支）。
- 工作区有其他未提交改动：每次提交只 `git add` 本任务明确列出的文件。

---

### Task 1: 领域层 — ApplyUserStatus 支持人数变更

**Files:**
- Modify: `registration_system_go/internal/match/domain/registration.go:74-88`
- Test: `registration_system_go/internal/match/domain/registration_test.go`

**Interfaces:**
- Produces: `func (r *Registration) ApplyUserStatus(status RegistrationStatus, count int, now time.Time) error`（Task 2 依赖此签名）。

- [ ] **Step 1: 写失败测试**

在 `registration_test.go` 追加：

```go
func TestApplyUserStatusUpdatesCountForPickup(t *testing.T) {
	now := time.Now()
	registration, err := NewRegistration(uuid.New(), 42, RegistrationAttending, 1, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := registration.ApplyUserStatus(RegistrationAttending, 3, now.Add(time.Minute)); err != nil {
		t.Fatalf("apply status with count: %v", err)
	}
	if registration.RegistrationCount != 3 {
		t.Fatalf("count should follow the command, got %d", registration.RegistrationCount)
	}
	if err := registration.ApplyUserStatus(RegistrationAttending, 0, now.Add(time.Minute)); err == nil {
		t.Fatal("count below 1 must be rejected")
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd registration_system_go && go test ./internal/match/domain/ -run TestApplyUserStatusUpdatesCountForPickup -v`
Expected: FAIL（编译错误，参数数量不匹配）。

- [ ] **Step 3: 实现**

`registration.go` 替换 `ApplyUserStatus`：

```go
// ApplyUserStatus applies a status (and registration count) that an app user is allowed to choose.
// count 由应用层显式传入：散人约球可 >1，其余场景恒为 1。
func (r *Registration) ApplyUserStatus(status RegistrationStatus, count int, now time.Time) error {
	switch status {
	case RegistrationAttending, RegistrationLeave, RegistrationAbsent:
	default:
		return sharederror.New(sharederror.KindValidation, "报名状态无效")
	}
	if count < 1 {
		return sharederror.New(sharederror.KindValidation, "报名人数必须大于 0")
	}
	if r.Status == status && r.CancelledAt == nil && r.RegistrationCount == count {
		return nil
	}
	r.Status = status
	r.RegistrationCount = count
	r.CancelledAt = nil
	r.UpdatedAt = now
	return nil
}
```

- [ ] **Step 4: 运行包测试（此时 application 层会编译失败，属预期，Task 2 修复）**

Run: `go test ./internal/match/domain/ -v`
Expected: domain 包 PASS。

---

### Task 2: 报名服务 — 放开多人、已付锁定、容量按人头投影

**Files:**
- Modify: `registration_system_go/internal/match/application/user_registration_service.go`
- Test: `registration_system_go/internal/match/application/user_registration_service_test.go`

**Interfaces:**
- Consumes: Task 1 的 `ApplyUserStatus(status, count, now)`。
- Produces: `PutMyRegistrationCommand.RegistrationCount` 语义放开（散人约球组可 >1）；错误文案「已支付的报名不可修改」「已支付的报名不可取消」「报名人数超过剩余名额（剩 N 个）」。

- [ ] **Step 1: 写失败测试**

在 `user_registration_service_test.go` 追加（复用既有 fake）：

```go
func pickupRegistrationFixture(now time.Time, minPlayers, maxPlayers int) registrationFixture {
	matchID := uuid.New()
	return registrationFixture{
		match: domain.Match{ID: matchID, PublicationMode: domain.OnlinePickup, OpponentState: domain.OpponentRecruiting, Status: domain.MatchRegistering, UpdatedAt: now},
		group: domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: minPlayers, MaxPlayers: maxPlayers}, now),
	}
}

func TestUserRegistrationPutPickupAllowsMultiPersonCount(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(pickupRegistrationFixture(now, 2, 10))
	service := NewUserRegistrationService(repository, fakeClock{now: now})

	registration, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 3,
	})
	if err != nil {
		t.Fatalf("pickup multi-person registration: %v", err)
	}
	if registration.RegistrationCount != 3 {
		t.Fatalf("expected count 3, got %d", registration.RegistrationCount)
	}
}

func TestUserRegistrationPutPickupEnforcesHeadcountCapacity(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(pickupRegistrationFixture(now, 2, 5))
	other, _ := domain.NewRegistration(repository.group.ID, 99, domain.RegistrationAttending, 4, now)
	repository.registrations[repository.group.ID] = []domain.Registration{other}
	service := NewUserRegistrationService(repository, fakeClock{now: now})

	_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 3,
	})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected capacity conflict, got %v", err)
	}
	// 剩 1 个名额：报 1 人应成功。
	if _, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 1,
	}); err != nil {
		t.Fatalf("register within remaining slots: %v", err)
	}
}

func TestUserRegistrationPutPickupAdjustCountBeforePayment(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(pickupRegistrationFixture(now, 2, 10))
	existing, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 3, now)
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Minute)})

	adjusted, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 2,
	})
	if err != nil || adjusted.RegistrationCount != 2 {
		t.Fatalf("adjust unpaid count: %+v err=%v", adjusted, err)
	}
}

func TestUserRegistrationPutAndDeleteRejectPaidChanges(t *testing.T) {
	now := time.Now()
	repository := newFakeUserRegistrationRepository(pickupRegistrationFixture(now, 2, 10))
	existing, _ := domain.NewRegistration(repository.group.ID, 42, domain.RegistrationAttending, 3, now)
	existing.Paid = true
	repository.registrations[repository.group.ID] = []domain.Registration{existing}
	service := NewUserRegistrationService(repository, fakeClock{now: now.Add(time.Minute)})

	// 幂等同值提交放行。
	same, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 3,
	})
	if err != nil || same.RegistrationCount != 3 {
		t.Fatalf("idempotent paid put: %+v err=%v", same, err)
	}
	_, err = service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
		Status: domain.RegistrationAttending, RegistrationCount: 2,
	})
	if !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected paid lock on count change, got %v", err)
	}
	if _, err := service.Delete(context.Background(), userActor(42), repository.match.ID, repository.group.ID); !errors.Is(err, sharederror.ErrConflict) {
		t.Fatalf("expected paid lock on delete, got %v", err)
	}
}

func TestUserRegistrationPutRejectsMultiCountOutsidePickup(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name    string
		fixture registrationFixture
	}{
		{name: "individual opponent match", fixture: individualRegistrationFixture(now, 1, 2)},
		{name: "team match", fixture: teamRegistrationFixture(now, domain.GroupHostTeam, 7)},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			repository := newFakeUserRegistrationRepository(test.fixture)
			repository.members = map[int64]map[int64]bool{7: {42: true}}
			service := NewUserRegistrationService(repository, fakeClock{now: now})
			_, err := service.Put(context.Background(), userActor(42), repository.match.ID, repository.group.ID, PutMyRegistrationCommand{
				Status: domain.RegistrationAttending, RegistrationCount: 2,
			})
			if !errors.Is(err, sharederror.ErrValidation) {
				t.Fatalf("expected count validation, got %v", err)
			}
		})
	}
}
```

同时改造既有测试 `TestUserRegistrationPutValidatesActorStatusAndCount`（L38-64）：`count` 用例改为 `RegistrationCount: 0`（保持"事务前拒绝"断言），count=2 的拒绝由新测试 `TestUserRegistrationPutRejectsMultiCountOutsidePickup` 覆盖（发生在事务内）。

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/match/application/ -run 'TestUserRegistrationPutPickup|TestUserRegistrationPutAndDeleteRejectPaid|TestUserRegistrationPutRejectsMultiCount' -v`
Expected: FAIL。

- [ ] **Step 3: 实现**

`user_registration_service.go`：

1. 基础校验（L165-167）改为：

```go
if command.RegistrationCount < 1 {
    return sharederror.New(sharederror.KindValidation, "报名人数必须为 1")
}
```

2. 新增（放在 `authorizeUserRegistration` 函数后）：

```go
// authorizeRegistrationCount 仅散人约球的散人组允许一次报多人；其余场景人数恒为 1。
func authorizeRegistrationCount(match domain.Match, group domain.RegistrationGroup, count int) error {
	if count == 1 {
		return nil
	}
	if match.PublicationMode == domain.OnlinePickup && group.Kind == domain.GroupIndividualOpponent {
		return nil
	}
	return sharederror.New(sharederror.KindValidation, "报名人数必须为 1")
}
```

3. `Put` 事务内、`authorizeUserRegistration` 调用之后（L61 附近）加：

```go
if err := authorizeRegistrationCount(match, group, command.RegistrationCount); err != nil {
    return err
}
```

4. 幂等短路（L65-68）改为：

```go
if found && current.Status == command.Status && current.CancelledAt == nil && current.RegistrationCount == command.RegistrationCount {
    result = current
    return nil
}
if found && current.Paid {
    return sharederror.New(sharederror.KindConflict, "已支付的报名不可修改")
}
```

5. 容量投影（L77-86）改为：

```go
projected := attending
if found && current.OccupiesCapacity() {
    projected -= current.RegistrationCount
}
base := projected
if command.Status == domain.RegistrationAttending {
    projected += command.RegistrationCount
}
if group.MaxPlayers != nil && projected > *group.MaxPlayers {
    remaining := *group.MaxPlayers - base
    if remaining < 0 {
        remaining = 0
    }
    return sharederror.New(sharederror.KindConflict, fmt.Sprintf("报名人数超过剩余名额（剩 %d 个）", remaining))
}
```

（文件头补 `"fmt"` import。）

6. 应用状态（L88-98）改为：

```go
if found {
    if err := current.ApplyUserStatus(command.Status, command.RegistrationCount, now); err != nil {
        return err
    }
    result = current
} else {
    result, err = domain.NewRegistration(groupID, actor.ID, command.Status, command.RegistrationCount, now)
    if err != nil {
        return err
    }
}
```

7. `Delete` 在 cancelled 幂等返回（L135-138）之后加：

```go
if current.Paid {
    return sharederror.New(sharederror.KindConflict, "已支付的报名不可取消")
}
```

- [ ] **Step 4: 运行包测试**

Run: `go test ./internal/match/... -v`
Expected: PASS（含既有测试；`TestUserRegistrationPutIsIdempotentAndReactivatesCancelledRow` 的 normalize 用例传 count=1 仍成立）。

- [ ] **Step 5: 提交**

```bash
git add registration_system_go/internal/match/domain/registration.go registration_system_go/internal/match/domain/registration_test.go registration_system_go/internal/match/application/user_registration_service.go registration_system_go/internal/match/application/user_registration_service_test.go
git commit -m "feat(go): pickup multi-person registration with paid lock"
```

---

### Task 3: 修复存量缺陷 — pickup 查询可见性与支付字段映射

**Files:**
- Modify: `registration_system_go/db/queries/match.sql`（7 处 `JOIN teams host` → `LEFT JOIN`，host.name 包 COALESCE）
- Modify: `registration_system_go/internal/match/adapters/postgres/repository_detail.go:103-115`（mapAdminDetailMatch 补映射）
- Regenerate: `make generate`
- Test: `registration_system_go/internal/match/adapters/postgres/repository_test.go`

**背景：** pickup 比赛 `host_team_id = NULL`，而 `GetMatchForAdmin` 等 7 个查询用 INNER JOIN `teams host`，会把 pickup 比赛整个过滤掉（详情 404、费用服务"比赛不存在"）；且 `mapAdminDetailMatch` 漏映射 `PaymentMode/FeePerPersonCents/IsFree`，费用服务读到空支付模式。两者叠加导致 b414c79 的付费链路在真实查询路径上不可用。

- [ ] **Step 1: 写失败集成测试**

在 `repository_test.go` 追加 fixture 与测试：

```go
func newPersistablePickupMatch(t *testing.T, userID int64, minPlayers, maxPlayers int, paymentMode domain.PaymentMode, feeCents int64) (domain.Match, []domain.RegistrationGroup) {
	t.Helper()
	start := time.Date(2026, 8, 25, 18, 0, 0, 0, time.UTC)
	match, groups, err := domain.NewMatch(domain.NewMatchInput{
		Name: "散人约球", PublicationMode: domain.OnlinePickup,
		CreatedByUserID: int64Pointer(userID), PlayersPerTeam: minPlayers,
		StartTime: start, EndTime: start.Add(2 * time.Hour), Location: "东安球场", CreatedAt: start.Add(-24 * time.Hour),
		PaymentMode: paymentMode, FeePerPersonCents: feeCents,
	}, domain.IndividualLimits{MinPlayers: minPlayers, MaxPlayers: maxPlayers})
	if err != nil {
		t.Fatalf("new pickup match: %v", err)
	}
	return match, groups
}

func TestRepositoryFindForUserReturnsPickupMatchWithPaymentFields(t *testing.T) {
	pool := testsupport.StartPostgres(t)
	ctx := context.Background()
	ownerID, _ := seedMatchOwner(t, pool)
	viewerID := seedMatchUser(t, pool)
	match, groups := newPersistablePickupMatch(t, ownerID, 4, 12, domain.PaymentPrepaid, 2500)
	repository := NewRepository(pool)
	if err := repository.CreateWithGroups(ctx, match, groups); err != nil {
		t.Fatalf("create pickup match: %v", err)
	}

	item, _, found, err := repository.FindForUser(ctx, match.ID, viewerID)
	if err != nil || !found || item.Match.ID != match.ID {
		t.Fatalf("pickup match must be visible: found=%t item=%+v err=%v", found, item, err)
	}
	if item.Match.PaymentMode != domain.PaymentPrepaid || item.Match.FeePerPersonCents != 2500 {
		t.Fatalf("payment fields must be mapped: %+v", item.Match)
	}
}
```

- [ ] **Step 2: 运行确认失败**

Run: `go test ./internal/match/adapters/postgres/ -run TestRepositoryFindForUserReturnsPickupMatchWithPaymentFields -v`（需要本地 Postgres，testsupport 按仓库既有方式提供）
Expected: FAIL（found=false 或字段为零值）。

- [ ] **Step 3: 修改 SQL 并重新生成**

`match.sql` 中 7 处（行 50、59、74、88、159、250、296 附近）：

```sql
JOIN teams host ON host.id = m.host_team_id
```

改为：

```sql
LEFT JOIN teams host ON host.id = m.host_team_id
```

同时把 5 个带 `host.name AS host_team_name` 的查询改为 `COALESCE(host.name, '') AS host_team_name`（保持生成类型为 string，免改下游映射）。搜索条件里的 `host.name ILIKE ...` 不动（pickup 无主队，搜队名不匹配是正确行为）。

`repository_detail.go` `mapAdminDetailMatch`（L103-115）在 `Description: row.Description,` 后补：

```go
		IsFree: row.IsFree, PaymentMode: domain.PaymentMode(row.PaymentMode), FeePerPersonCents: row.FeePerPersonCents,
```

然后：`cd registration_system_go && make generate`。

- [ ] **Step 4: 运行测试**

Run: `go test ./internal/match/adapters/postgres/ -v`
Expected: PASS（含既有全部仓储集成测试）。

- [ ] **Step 5: 提交**

```bash
git add registration_system_go/db/queries/match.sql registration_system_go/internal/match/adapters/postgres/ registration_system_go/internal/auth/adapters/postgres/sqlc/ registration_system_go/internal/team/adapters/postgres/sqlc/ registration_system_go/internal/minireview/adapters/postgres/sqlc/ registration_system_go/internal/payment/adapters/postgres/sqlc/ registration_system_go/internal/system/adapters/postgres/sqlc/ registration_system_go/internal/wallet/adapters/postgres/sqlc/
git commit -m "fix(go): make pickup matches visible in joined queries and map payment fields"
```

---

### Task 4: 名册与参与者透出 registration_count / paid

**Files:**
- Modify: `registration_system_go/db/queries/match.sql` `ListGroupRegistrations`（补两列）→ `make generate`
- Modify: `registration_system_go/internal/match/ports/repository.go`（UserParticipant + AdminRosterEntry）
- Modify: `registration_system_go/internal/match/adapters/postgres/repository_registration.go`、`repository_detail.go`
- Modify: `registration_system_go/internal/match/adapters/http/user_handler.go`、`admin_handler.go`
- Test: `repository_test.go`、`user_handler_test.go`

**Interfaces:**
- Produces: `ports.UserParticipant{..., RegistrationCount int}`；`ports.AdminRosterEntry{..., RegistrationCount int, Paid bool}`；HTTP `UserParticipantResponse.registration_count`、`RegistrationEntryResponse.registration_count/paid`（小程序 Task 8、管理端 Task 10 依赖这些 JSON 字段名）。

- [ ] **Step 1: 写失败测试**

`repository_test.go` 追加：

```go
func TestListGroupRegistrationEntriesExposeCountAndPaid(t *testing.T) {
	attending := domain.RegistrationAttending
	entries := mapUserParticipants([]ports.AdminRosterEntry{
		{UserID: 11, Nickname: "张三", Status: &attending, RegistrationCount: 3},
		{UserID: 12, Nickname: "李四", Status: &attending, RegistrationCount: 1},
	})
	if len(entries) != 2 || entries[0].RegistrationCount != 3 || entries[1].RegistrationCount != 1 {
		t.Fatalf("participants should carry registration count: %+v", entries)
	}
}
```

`user_handler_test.go` 追加（对齐既有 handler 测试构造方式）：

```go
func TestUserParticipantResponseIncludesRegistrationCount(t *testing.T) {
	response := mapUserParticipant(ports.UserParticipant{UserID: 11, Nickname: "张三", Status: domain.RegistrationAttending, RegistrationCount: 3})
	if response.RegistrationCount != 3 {
		t.Fatalf("expected registration_count 3, got %+v", response)
	}
}
```

（`mapUserParticipant` 若不存在则按 `user_handler.go` 内既有 participants 映射函数实际名称调整。）

- [ ] **Step 2: 确认失败后实现**

1. `match.sql` `ListGroupRegistrations` SELECT 列表加 `r.registration_count, r.paid`（放在 `r.status` 之后）；`make generate`。
2. `ports/repository.go`：`UserParticipant` 加 `RegistrationCount int`（注释：散人约球一人代多人时 >1，其余恒 1）；`AdminRosterEntry` 加 `RegistrationCount int` 与 `Paid bool`。
3. `repository_registration.go` `listGroupRegistrationEntries`：条目补 `RegistrationCount: int(row.RegistrationCount), Paid: row.Paid`。
4. `repository_detail.go` `mapUserParticipants`：透传 `RegistrationCount: entry.RegistrationCount`。
5. `user_handler.go`：`UserParticipantResponse` 加 `RegistrationCount int \`json:"registration_count"\`` 并在映射处赋值。
6. `admin_handler.go`：`RegistrationEntryResponse` 加 `RegistrationCount int \`json:"registration_count"\``、`Paid bool \`json:"paid"\``；`mapRegistrations` 赋值。

- [ ] **Step 3: 运行测试**

Run: `go test ./internal/match/... -v`
Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add registration_system_go/db/queries/match.sql registration_system_go/internal/match/
git commit -m "feat(go): expose registration count and paid state in rosters"
```

---

### Task 5: 费用按人数计算

**Files:**
- Modify: `registration_system_go/internal/match/application/registration_fee_service.go:50`
- Test: `registration_system_go/internal/match/application/registration_fee_service_test.go`

- [ ] **Step 1: 写失败测试**

```go
func TestRegistrationFeeMultipliesByRegistrationCount(t *testing.T) {
	now := time.Now()
	matchID := uuid.New()
	count := 3
	group := ports.UserGroupState{
		Group: domain.NewIndividualGroup(matchID, domain.IndividualLimits{MinPlayers: 2, MaxPlayers: 10}, now),
		MyRegistration: &domain.Registration{Status: domain.RegistrationAttending, RegistrationCount: count},
	}
	repository := &fakeFeeRepository{item: ports.MatchItem{Match: domain.Match{
		ID: matchID, PublicationMode: domain.OnlinePickup, Status: domain.MatchRegistering,
		PaymentMode: domain.PaymentPrepaid, FeePerPersonCents: 2500,
	}}, groups: []ports.UserGroupState{group}}
	service := NewRegistrationFeeService(repository)

	fee, err := service.RegistrationFee(context.Background(), matchID, 42)
	if err != nil {
		t.Fatalf("registration fee: %v", err)
	}
	if fee.AmountCents != 7500 {
		t.Fatalf("expected 3 x 2500 cents, got %d", fee.AmountCents)
	}
}
```

（`fakeFeeRepository` 按该测试文件既有 fake 命名调整；若无则新建实现 `UserMatchRepository.FindForUser`。）

- [ ] **Step 2: 确认失败，然后实现**

`registration_fee_service.go` L50 返回值改为：

```go
		return paymentports.MatchRegistrationFee{MatchID: matchID, AmountCents: match.FeePerPersonCents * int64(registration.RegistrationCount)}, nil
```

- [ ] **Step 3: 运行 + 提交**

Run: `go test ./internal/match/application/ -v`

```bash
git add registration_system_go/internal/match/application/
git commit -m "feat(go): pickup registration fee scales with headcount"
```

---

### Task 6: 支付下单前关闭同比赛同人旧 pending 订单

**Files:**
- Modify: `registration_system_go/db/queries/payment.sql`（新查询）
- Modify: `registration_system_go/internal/payment/ports/ports.go`（OrderRepository 加方法）
- Modify: `registration_system_go/internal/payment/adapters/postgres/repository.go`
- Modify: `registration_system_go/internal/payment/application/service.go`（CreateMatchRegistration）
- Test: `registration_system_go/internal/payment/application/service_test.go`、`internal/payment/adapters/postgres/repository_test.go`（如有仓储集成测试基建则补一条）

**Interfaces:**
- Produces: `OrderRepository.CancelPendingForMatch(ctx context.Context, matchID uuid.UUID, userID int64, now time.Time) error`。

- [ ] **Step 1: 写失败测试**

`service_test.go` 追加（fakePaymentStore 需同步加 `pendingCancelled` 计数与方法实现）：

```go
func TestCreateMatchRegistrationCancelsStalePendingOrders(t *testing.T) {
	store := newFakePaymentStore()
	store.stalePending = true
	gateway := &fakeGateway{unified: paymentports.UnifiedOrderResult{PrepayID: "prepay-m1", Parameters: paymentports.JSAPIParameters{Package: "prepay_id=prepay-m1"}}}
	fees := pricedRegistrationFees{fee: paymentports.MatchRegistrationFee{MatchID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), AmountCents: 7500}}
	service := NewService(store, store, gateway, store, store, allowTeams{}, fees, store, fixedOrderNumbers{"P-match-1"}, fixedClock{time.Unix(100, 0)})

	if _, err := service.CreateMatchRegistration(context.Background(), userActor(37), CreateMatchRegistrationCommand{MatchID: fees.fee.MatchID}); err != nil {
		t.Fatal(err)
	}
	if store.pendingCancels != 1 {
		t.Fatalf("stale pending orders must be cancelled once, got %d", store.pendingCancels)
	}
}
```

- [ ] **Step 2: 确认失败，然后实现**

1. `payment.sql` 追加：

```sql
-- name: CancelPendingMatchRegistrationOrders :execrows
-- 改人数后重新下单前关闭同比赛同人的遗留未付订单，避免旧金额订单被误付。
UPDATE payment_orders
SET status = 'cancelled', cancelled_at = $3, updated_at = $3
WHERE match_id = $1 AND user_id = $2 AND kind = 'match_registration' AND status = 'pending';
```

`make generate`。

2. `ports.go` `OrderRepository` 接口加 `CancelPendingForMatch(context.Context, uuid.UUID, int64, time.Time) error`。
3. `adapters/postgres/repository.go` 实现（调上述查询，`sqlc.arg` 形参按生成签名对齐）。
4. `service.go` `CreateMatchRegistration` 在 `s.orders.Create(ctx, order)` 之前加：

```go
	if err := s.orders.CancelPendingForMatch(ctx, command.MatchID, actor.ID, now); err != nil {
		return CreateRechargeResult{}, err
	}
```

5. `fakePaymentStore` 加 `stalePending bool`、`pendingCancels int` 与方法实现（`if f.stalePending { f.pendingCancels++ }`）。

- [ ] **Step 3: 运行 + 提交**

Run: `go test ./internal/payment/... -v`

```bash
git add registration_system_go/db/queries/payment.sql registration_system_go/internal/payment/
git commit -m "feat(go): close stale pending match fee orders before reordering"
```

---

### Task 7: 后端收尾 — OpenAPI 与全量验证

**Files:**
- Modify: `registration_system_go/docs/openapi.yaml`
- Test: `registration_system_go/docs/openapi_test.go`（如操作数变化需同步）

- [ ] **Step 1: OpenAPI 更新**

1. `MyRegistrationRequest.registration_count` 描述补「散人约球可传 >1，代表帮朋友代报的人数」。
2. participants（`UserParticipant` schema）加 `registration_count`（integer，默认 1）。
3. 管理端名册条目 schema（`RegistrationEntry`）加 `registration_count`、`paid`。
4. DELETE my-registration 的错误响应描述补「已支付报名不可取消」。
5. 确认 `openapi_test.go` 中 documented operations 计数不变（无新增端点）。

- [ ] **Step 2: 全量验证**

```bash
cd registration_system_go && gofmt -w . && go vet ./... && go test -race ./... && go build -o /tmp/registration-system-go-api ./cmd/api
```

- [ ] **Step 3: 提交**

```bash
git add registration_system_go/docs/openapi.yaml registration_system_go/docs/openapi_test.go
git commit -m "docs(go): openapi for multi-person pickup registration"
```

---

### Task 8: 小程序数据层 — API、类型、人数统计

**Files:**
- Modify: `registration_system_mini/src/api/match.ts:106-117`
- Modify: `registration_system_mini/src/types/match.ts`（AppMatchParticipant）
- Modify: `registration_system_mini/src/pages/matches/detailData.ts:186-190、209-212`
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts:94-95`
- Modify: `registration_system_mini/src/pages/matches/detailActions.ts:33-35`
- Modify: `registration_system_mini/src/mock/handlers.ts`（支付金额）、`src/mock/data/matches.ts`
- Test: `src/api/__tests__/matchApi.test.ts`、`src/pages/matches/__tests__/detailData.test.ts`

**Interfaces:**
- Consumes: 后端 `registration_count`（participants + PUT 请求体）。
- Produces: `putMyMatchRegistration(matchId, groupId, status, registrationCount = 1)`（Task 9 依赖）；`joinedCount` 按人头求和。

- [ ] **Step 1: 更新测试（先红）**

`matchApi.test.ts` 中断言 `registration_count: 1` 的两处改为断言新参数（如传 3 断言 `registration_count: 3`；默认调用仍为 1）。`detailData.test.ts` 补：participants 转换透传 `registration_count`。

- [ ] **Step 2: 实现**

1. `api/match.ts`：

```ts
export function putMyMatchRegistration(
  matchId: string,
  groupId: string,
  status: Extract<AppMatchRegistration["status"], "attending" | "leave" | "absent">,
  registrationCount = 1,
) {
  return requestApi<AppMatchRegistration>({
    url: `/matches/${matchId}/groups/${groupId}/my-registration`,
    method: "PUT",
    data: { status, registration_count: registrationCount },
    auth: true,
  });
}
```

2. `types/match.ts` `AppMatchParticipant` 加 `registration_count?: number`。
3. `detailData.ts`：participants 映射 `registration_count: participant.registration_count ?? 1`；`sourceTeamRegistrationCount` 改为 `Math.max(Number(activity.team_registration_count ?? 0) - activityUsers.filter((item) => item.stand === 1).reduce((total, item) => total + item.registration_count, 0), 0)`。
4. `useMatchDetailPage.ts`：`joinedCount = joinedRegistrations.value.reduce((total, item) => total + item.registration_count, 0) + sourceTeamRegistrationCount.value`。
5. `detailActions.ts` `submitMatchIndividualRegistration` 加第四参 `registrationCount = 1` 透传。
6. `useMatchDetailPage.ts` `participantPreview`：name 在 count>1 时追加 `（${count}人）`。
7. mock：`handlers.ts` 支付订单 handler 金额改为查 mock 比赛 `fee_per_person_cents × 该用户报名人数`（`getMockMatchDetail`/store 查询，兜底 2500）；`mock/data/matches.ts:754` `my_registration.registration_count` 用 store 中记录值。

- [ ] **Step 3: 验证**

Run: `cd registration_system_mini && bun run type-check && bun test src/api/__tests__/matchApi.test.ts src/pages/matches/__tests__/detailData.test.ts`（以仓库实际测试命令为准，见 package.json scripts）

- [ ] **Step 4: 提交**

```bash
git add registration_system_mini/src/api/match.ts registration_system_mini/src/types/match.ts registration_system_mini/src/pages/matches/detailData.ts registration_system_mini/src/pages/matches/useMatchDetailPage.ts registration_system_mini/src/pages/matches/detailActions.ts registration_system_mini/src/mock/ registration_system_mini/src/api/__tests__/matchApi.test.ts registration_system_mini/src/pages/matches/__tests__/detailData.test.ts
git commit -m "feat(mini): carry registration count through match data layer"
```

---

### Task 9: 小程序交互 — 报名人数面板与支付金额展示

**Files:**
- Create: `registration_system_mini/src/pages/matches/components/MatchSignupCountSheet.vue`
- Modify: `registration_system_mini/src/pages/matches/useMatchRegistration.ts`（pickup 分支）
- Modify: `registration_system_mini/src/pages/matches/useMatchDetailPage.ts`（CTA 状态、面板状态）
- Modify: `registration_system_mini/src/pages/matches/useMatchRegistrationPayment.ts`（金额 × 人数）
- Modify: `registration_system_mini/src/pages/matches/detail.vue`（装配面板）
- Modify: `registration_system_mini/src/pages/matches/components/MatchRegistrationStatusCard.vue`（待支付面板文案）

**Interfaces:**
- Consumes: Task 8 的 `putMyMatchRegistration(..., count)` 与 `joinedCount`。
- Produces: 报名/调人数/取消三入口；`pendingPaymentFeeLabel` = 单价 × 我的人数。

- [ ] **Step 1: 新建面板组件**

`MatchSignupCountSheet.vue`（overlay 结构照 `PublishTypeSheet.vue`，底部滑出面板；视觉 token 用 neo 变量）：

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";

const props = defineProps<{
  visible: boolean;
  minCount?: number;
  maxCount: number;
  currentCount: number;
  feePerPersonLabel?: string;
  submitting?: boolean;
  canCancel?: boolean;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm", count: number): void;
  (event: "cancelRegistration"): void;
}>();

const count = ref(props.currentCount || 1);
watch(() => props.visible, (visible) => { if (visible) count.value = props.currentCount || 1; });

const maxCount = computed(() => Math.max(props.maxCount, 1));
const totalFeeLabel = computed(() =>
  props.feePerPersonLabel ? `¥${(parseFloat(props.feePerPersonLabel.replace("¥", "")) * count.value).toFixed(2)}` : "",
);

function handleConfirm() {
  if (!props.submitting) emit("confirm", count.value);
}
</script>
```

template：标题「报名人数」+ `wd-input-number`（`:min="minCount ?? 1"` `:max="maxCount"` `v-model="count"` `integer`）+ 剩余名额提示 `最多可报 {{ maxCount }} 人` + 合计行（`feePerPersonLabel` 存在时显示 `合计 {{ totalFeeLabel }}`，否则显示 `免费`）+ 主按钮「确认报名」+ 次按钮（`canCancel` 时）「取消报名」（danger 色）。

- [ ] **Step 2: 接线（pickup 分支）**

1. `useMatchDetailPage.ts` 新增状态与计算：

```ts
const signupSheetVisible = ref(false);
const myRegistrationCount = computed(() =>
  registrations.value.find((item) => item.user_id === currentUser.value?.id && item.stand === 1)?.registration_count ?? 1,
);
const isPickupMatch = computed(() => sourceMatch.value?.publication_mode === "online_pickup");
const signupMaxCount = computed(() => Math.max(
  maxPlayers.value - joinedCount.value + (currentStatus.value === "参加" ? myRegistrationCount.value : 0), 1,
);
const feePerPersonLabel = computed(() => {
  const cents = sourceMatch.value?.fee_per_person_cents ?? 0;
  return cents > 0 ? `¥${(cents / 100).toFixed(2)}` : "";
});
```

`individualCtaLabel`（L235-239）pickup 已报名时改文案：未付（`!myRegistrationPaid`）→「调整人数」，已付 →「已报名」；`ctaDisabled`：已付为 true。

2. `useMatchRegistration.ts` `handleSelectIndividualSignup`：`isPickupMatch`（新依赖）且非取消流程时，不再弹纯文本确认框，改为 `signupSheetVisible.value = true`；新增 `handleSignupSheetConfirm(count)` 执行原提交逻辑（`submitIndividualRegistrationStatus("attending", count)`、`applyIndividualRegistrationState(1, count)`、prepaid 则 `payRegistrationFee()`）；`handleSignupSheetCancelRegistration` 复用 `handleCancelIndividualSignup`。非 pickup 场景保持原确认框流程不变（提交仍传 1）。
   - `submitIndividualRegistrationStatus` 增加可选 count 参数透传给 `submitMatchIndividualRegistration`；legacy 分支忽略 count。

3. `useMatchRegistrationPayment.ts`：`pendingPaymentFeeLabel` 金额乘 `myRegistrationCount`（新依赖，由页面传入；`sourceMatch.fee_per_person_cents × count / 100`），面板标题改「已报 {{count}} 人 · 报名费待支付」由 StatusCard 展示（新增 prop `pendingPaymentCountLabel?: string`）。

4. `detail.vue`：装配 `<MatchSignupCountSheet :visible="signupSheetVisible" :max-count="signupMaxCount" :current-count="myRegistrationCount" :fee-per-person-label="feePerPersonLabel" :submitting="submittingStatus" :can-cancel="currentStatus === '参加' && !myRegistrationPaid" @close="signupSheetVisible = false" @confirm="handleSignupSheetConfirm" @cancel-registration="handleSignupSheetCancelRegistration" />`。

- [ ] **Step 3: 验证**

Run: `bun run type-check`；`bun run build:mp-weixin`（可选，体验版验证前执行）。

- [ ] **Step 4: 提交**

```bash
git add registration_system_mini/src/pages/matches/
git commit -m "feat(mini): pickup signup sheet with headcount and total fee"
```

---

### Task 10: 管理端名册展示人数与支付状态

**Files:**
- Modify: `registration_system_backend_fe_go/src/api/matches.ts`（名册条目类型）
- Modify: `registration_system_backend_fe_go/src/pages/MatchDetailPage.tsx`

- [ ] **Step 1: 类型与展示**

1. `matches.ts` 名册条目接口加 `registration_count: number; paid: boolean;`。
2. `MatchDetailPage.tsx` 名册表格（registrations 列）加「人数」列（N=1 显示 `1`，N>1 强调样式如 Tag `×N`）与「支付」列（`paid ? <Tag color="success">已付</Tag> : <Tag>未付</Tag>`），按页面现有表格写法对齐。

- [ ] **Step 2: 验证 + 提交**

Run: `cd registration_system_backend_fe_go && bun run type-check && bun run lint && bun run build`

```bash
git add registration_system_backend_fe_go/src/
git commit -m "feat(admin-go): roster shows pickup headcount and payment state"
```

---

### Task 11: 全量验证

- [ ] Go：`gofmt -w . && go vet ./... && go test -race ./... && go build -o /tmp/registration-system-go-api ./cmd/api`
- [ ] 小程序：`bun run type-check`
- [ ] 管理端：`bun run type-check && bun run lint && bun run build`
- [ ] `git log --oneline` 核对提交序列干净（无夹带工作区其他未提交改动）

## Self-Review 记录

- 规格覆盖：放开闸口/容量/锁定（Task 1-2）、存量缺陷修复（Task 3，规格「风险与备注」隐含但实现必需）、DTO 透出（Task 4）、费用乘法（Task 5）、旧单关闭（Task 6）、OpenAPI（Task 7）、小程序数据层与交互（Task 8-9）、管理端（Task 10）。
- 类型一致性：`ApplyUserStatus(status, count, now)`、`putMyMatchRegistration(..., registrationCount = 1)`、`CancelPendingForMatch(ctx, matchID, userID, now)`、`UserParticipant.RegistrationCount`、`AdminRosterEntry.RegistrationCount/Paid` 贯穿一致。
- Task 3 的 sqlc 重新生成会触碰多个模块的生成文件，提交时需包含全部生成目录。
