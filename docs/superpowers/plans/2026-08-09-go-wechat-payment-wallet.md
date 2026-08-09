# Go WeChat Payment and Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe WeChat Pay V2 mini-program recharge flow that credits an idempotent Go wallet and exposes versioned App/Admin APIs.

**Architecture:** Keep `payment` and `wallet` as separate hexagonal modules. Payment owns provider communication and order lifecycle; wallet owns balances and immutable transactions; a PostgreSQL settlement adapter atomically crosses their tables after a verified provider result.

**Tech Stack:** Go 1.26.5, Gin, PostgreSQL, pgx v5, sqlc, goose, standard-library XML/HTTP/crypto packages.

## Global Constraints

- Only modify `registration_system_go/` and repository documentation; do not modify the mini program, admin frontends, or Rust backend.
- Use WeChat Pay V2 XML + MD5 and support mini-program JSAPI only.
- Accept integer cents with a minimum of 1 and no business maximum beyond `int64` and provider limits.
- Do not implement refund, withdrawal, manual adjustment, public debit, H5 payment, or legacy financial migration.
- Mock payment is development/test only and becomes paid only through sync.
- Local development and tests must not start Docker; PostgreSQL integration tests require an explicit isolated `TEST_DATABASE_URL`.

---

### Task 1: Payment and wallet domain contracts

**Status:** Completed in `02cdff0`.

**Files:**
- Create: `registration_system_go/internal/payment/domain/order.go`
- Create: `registration_system_go/internal/payment/domain/order_test.go`
- Create: `registration_system_go/internal/wallet/domain/wallet.go`
- Create: `registration_system_go/internal/wallet/domain/wallet_test.go`

**Interfaces:**
- Produces: `paymentdomain.Order`, `Status`, `NewRechargeOrder`, `MarkPrepared`, `MarkPaid`, `MarkCancelled`, `MarkFailed`.
- Produces: `walletdomain.Account`, `Transaction`, `Debit`, `ErrInsufficientBalance`.

- [ ] Write table-driven failing tests for 1-cent validation, illegal order transitions, idempotent paid transition, and debit underflow.
- [ ] Run `go test ./internal/payment/domain ./internal/wallet/domain` and verify missing-package/type failures.
- [ ] Implement only the tested domain values and transitions.
- [ ] Re-run the two packages and confirm PASS.
- [ ] Commit as `feat(go): define payment and wallet domains`.

### Task 2: Ports and application use cases

**Status:** Completed in `59e3547`.

**Files:**
- Create: `registration_system_go/internal/payment/ports/ports.go`
- Create: `registration_system_go/internal/payment/application/service.go`
- Create: `registration_system_go/internal/payment/application/service_test.go`
- Create: `registration_system_go/internal/wallet/ports/repository.go`
- Create: `registration_system_go/internal/wallet/application/service.go`
- Create: `registration_system_go/internal/wallet/application/service_test.go`

**Interfaces:**
- `Gateway.UnifiedOrder(context.Context, UnifiedOrderRequest) (JSAPIParameters, error)`.
- `Gateway.QueryOrder(context.Context, string) (ProviderPayment, error)`.
- `Gateway.CloseOrder(context.Context, string) (CloseOutcome, error)`.
- `Gateway.ParseNotification([]byte) (ProviderPayment, error)`.
- `OrderRepository` provides create/get/list/preparation/failure/cancellation operations.
- `Settlement.CreditRecharge(context.Context, VerifiedPayment) (SettlementResult, error)` is atomic and idempotent.
- Wallet query/debit ports expose `GetAccount`, `ListTransactions`, and `Debit`.

- [ ] Write failing fake-port tests for create, sync, close success, close `ORDERPAID`, webhook settlement reuse, ownership, wallet zero balance, and insufficient debit.
- [ ] Run the application package tests and verify RED because services are absent.
- [ ] Implement focused create/query/sync/cancel/notification and wallet query/debit services.
- [ ] Re-run and confirm PASS, including duplicate settlement returning unchanged balance.
- [ ] Commit as `feat(go): orchestrate recharge and wallet use cases`.

### Task 3: WeChat V2 and Mock gateways

**Status:** Completed in `6c8959b`.

**Files:**
- Create: `registration_system_go/internal/payment/adapters/wechatv2/signature.go`
- Create: `registration_system_go/internal/payment/adapters/wechatv2/xml.go`
- Create: `registration_system_go/internal/payment/adapters/wechatv2/client.go`
- Create: `registration_system_go/internal/payment/adapters/wechatv2/client_test.go`
- Create: `registration_system_go/internal/payment/adapters/mock/gateway.go`
- Create: `registration_system_go/internal/payment/adapters/mock/gateway_test.go`

**Interfaces:**
- `wechatv2.NewClient(httpClient, Config) (*Client, error)` implements `paymentports.Gateway`.
- `mock.NewGateway(appID string) *Gateway` returns pending on create and paid on sync.

- [ ] Write failing tests using fixed V2 sign vectors and `httptest.Server` responses for unified order, query, close, invalid signature, wrong merchant/app ID, malformed XML, and upstream `SYSTEMERROR`.
- [ ] Run gateway tests and verify RED.
- [ ] Implement deterministic signing, constant-time verification, typed XML messages, timeout-bound HTTP calls, and outcome mapping.
- [ ] Implement the in-memory Mock gateway and verify create remains pending until query.
- [ ] Run gateway tests and confirm PASS.
- [ ] Commit as `feat(go): add WeChat Pay V2 gateway`.

### Task 4: Database schema, sqlc, and PostgreSQL adapters

**Status:** Completed in `32bc885`; merge review moved the schema to unique migration version 6 and added migration/source-conflict/concurrency guards. PostgreSQL integration tests skip unless `TEST_DATABASE_URL` is explicit.

**Files:**
- Create: `registration_system_go/db/migrations/00006_payment_wallet.sql`
- Create: `registration_system_go/db/migrations_test.go`
- Create: `registration_system_go/db/queries/payment.sql`
- Create: `registration_system_go/db/queries/wallet.sql`
- Modify: `registration_system_go/sqlc.yaml`
- Create: `registration_system_go/internal/payment/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/payment/adapters/postgres/repository_test.go`
- Create: `registration_system_go/internal/payment/adapters/postgres/sqlc/*` (generated)
- Create: `registration_system_go/internal/wallet/adapters/postgres/repository.go`
- Create: `registration_system_go/internal/wallet/adapters/postgres/repository_test.go`
- Create: `registration_system_go/internal/wallet/adapters/postgres/sqlc/*` (generated)
- Modify: `registration_system_go/internal/testsupport/postgres.go`

**Interfaces:**
- Payment repository implements `OrderRepository`, `UserOpenIDReader`, and `Settlement` over one pgx pool.
- Wallet repository implements query and atomic debit ports.

- [ ] Add tests that require an explicit `TEST_DATABASE_URL`, clean only the new tables, apply migrations, and fail for missing schema/adapter behavior.
- [ ] Run with an isolated test URL when available; otherwise verify the tests skip with an explicit reason.
- [ ] Add migration constraints and sqlc queries, then run `make generate`.
- [ ] Implement order persistence and the row-locking settlement transaction with unique `(source_type,source_id)` idempotency.
- [ ] Implement wallet zero-view, transaction pagination, and row-locking debit.
- [ ] Run adapter tests and `go test ./internal/payment/... ./internal/wallet/...`.
- [ ] Commit as `feat(go): persist payments and wallet balances`.

### Task 5: HTTP adapters and dependency wiring

**Status:** Completed in `d9f8190`.

**Files:**
- Create: `registration_system_go/internal/payment/adapters/http/handler.go`
- Create: `registration_system_go/internal/payment/adapters/http/handler_test.go`
- Create: `registration_system_go/internal/wallet/adapters/http/handler.go`
- Create: `registration_system_go/internal/wallet/adapters/http/handler_test.go`
- Modify: `registration_system_go/internal/bootstrap/config.go`
- Modify: `registration_system_go/internal/bootstrap/config_test.go`
- Modify: `registration_system_go/internal/bootstrap/dependencies.go`
- Modify: `registration_system_go/internal/bootstrap/router.go`
- Modify: `registration_system_go/internal/bootstrap/router_test.go`

**Interfaces:**
- App handlers register below `/api/v1/app`, Admin handlers below `/api/v1/admin`, webhook below `/api/v1/webhooks`.
- HTTP errors use the existing `{code,message,data}` envelope; webhook always returns typed V2 XML.

- [ ] Write failing handler/router tests for all routes, JWT audience protection, 1-cent validation, ownership, 502 provider errors, and success/failure webhook XML.
- [ ] Write failing config tests proving production rejects Mock/missing merchant configuration and development can explicitly enable Mock.
- [ ] Run targeted tests and verify RED.
- [ ] Implement DTO mapping, error mapping, handlers, config parsing/validation, dependency construction, and router registration.
- [ ] Re-run targeted tests and confirm PASS.
- [ ] Commit as `feat(go): expose payment and wallet APIs`.

### Task 6: OpenAPI and operational documentation

**Status:** Completed in `f28771a`.

**Files:**
- Modify: `registration_system_go/docs/openapi.yaml`
- Modify: `registration_system_go/docs/openapi_test.go`
- Modify: `registration_system_go/.env.example`
- Modify: `registration_system_go/README.md`
- Modify: `registration_system_go/progress.md`
- Modify: `registration_system_go/AGENTS.md`

**Interfaces:**
- OpenAPI documents every App/Admin/webhook route, request, response, security requirement, pagination parameter, payment state, wallet and V2 XML media type.

- [ ] Add failing route-drift assertions for all payment/wallet paths and HTTP methods.
- [ ] Run `go test ./docs ./internal/bootstrap` and verify RED.
- [ ] Update OpenAPI and operational docs, removing the obsolete “payment is out of scope” statement.
- [ ] Re-run docs/bootstrap tests and confirm PASS.
- [ ] Commit as `docs(go): document payment and wallet APIs`.

### Task 7: Full verification

**Status:** Completed; PostgreSQL integration tests were skipped because `TEST_DATABASE_URL` was not configured.

**Files:**
- Verify only; fix defects in the owning files with a new failing regression test first.

**Interfaces:**
- Produces a buildable API and a verification report that distinguishes unit/compile checks from optional database integration checks.

- [x] Run `gofmt -w .`.
- [x] Run `go test -race` for all packages that do not require PostgreSQL.
- [x] Run `TEST_DATABASE_URL=<isolated-url> go test -race ./internal/payment/adapters/postgres ./internal/wallet/adapters/postgres` only when a dedicated test database is available. No dedicated URL was configured, so the adapters skipped explicitly.
- [x] Run `go test -run '^$' ./...`, `go vet ./...`, `go build -o /tmp/registration-system-go-api ./cmd/api`, and `git diff --check`.
- [x] Inspect `git status`, verify no mini/Rust files changed, and commit any final regression/documentation fixes.
