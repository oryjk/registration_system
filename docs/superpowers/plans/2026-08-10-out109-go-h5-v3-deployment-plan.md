# out109 Go + H5 V3 Parallel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a separate Go acceptance API and H5 build on out109 so the user can log in and verify completed mini-app features without affecting the existing Rust `/regist-v2/` and H5 `/mini/` deployments.

**Architecture:** Keep Rust on port `18080`. Build the Go API from the remote `main` checkout into a dedicated Docker image, bind it to `127.0.0.1:18081`, and expose it through Nginx at `/regist-v3/`. Build H5 in Vite `test` mode with `/mini-v3/` assets and the V3 API base, then serve it from a separate Nginx directory.

**Tech Stack:** Go 1.26.5, Gin, PostgreSQL, Docker, Goose, uni-app, Vue 3, Vite, Bun, Nginx.

## Global Constraints

- Preserve `/regist-v2/`, port `18080`, the Rust container, and `/mini/` unchanged.
- Update out109 code only with `git checkout main` and `git pull --ff-only origin main`.
- Never commit or print secrets; use a remote mode-`0600` env file.
- Run only forward migrations against the separate `registration_system_go` database.
- Enable test login only with `VITE_ENABLE_H5_TEST_LOGIN=true`, `APP_ENV=test`, and `ENABLE_H5_TEST_LOGIN=true`.
- Pass the repository frontend and Go verification commands before deployment.

---

### Task 1: Add an explicit acceptance H5 build

**Files:**
- Modify: `registration_system_mini/package.json`
- Test: `registration_system_mini/src/stores/__tests__/goAuthFoundation.test.ts`

**Interfaces:**
- Produces `build:h5:acceptance` with value `uni build --mode test`.
- Leaves `build:h5` unchanged.

- [ ] **Step 1: Write the failing test**

Read `package.json` and assert `scripts["build:h5:acceptance"] === "uni build --mode test"`.

- [ ] **Step 2: Verify red**

```bash
cd registration_system_mini && bun test src/stores/__tests__/goAuthFoundation.test.ts
```

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Add the script**

```json
"build:h5:acceptance": "uni build --mode test"
```

- [ ] **Step 4: Verify green and commit**

```bash
cd registration_system_mini && bun test src/stores/__tests__/goAuthFoundation.test.ts
git add registration_system_mini/package.json registration_system_mini/src/stores/__tests__/goAuthFoundation.test.ts
git commit -m "build(mini): add acceptance H5 build mode"
```

### Task 2: Add the Go container image

**Files:**
- Create: `registration_system_go/Dockerfile`
- Create: `registration_system_go/.dockerignore`

**Interfaces:**
- Produces `registration-system-backend-go-v3:current`.
- Entrypoint: `/app/registration-system-go-api`.

- [ ] **Step 1: Verify the missing image definition**

```bash
test -f registration_system_go/Dockerfile
```

Expected: FAIL before implementation.

- [ ] **Step 2: Add the multi-stage image**

Use `golang:1.26.5-bookworm`, `CGO_ENABLED=0`, `GOOS=linux`, and `GOARCH=amd64`; copy the binary and CA certificates into `debian:bookworm-slim`.

- [ ] **Step 3: Add build-context exclusions**

Exclude `.env*`, `.git`, local binaries, coverage, and import mapping credentials while retaining Go source and module files.

- [ ] **Step 4: Build, inspect, and commit**

```bash
docker build --platform linux/amd64 -t registration-system-backend-go-v3:current registration_system_go
docker image inspect registration-system-backend-go-v3:current
git add registration_system_go/Dockerfile registration_system_go/.dockerignore
git commit -m "build(go): add isolated API container image"
```

Expected: image build exits 0 and config runs `/app/registration-system-go-api`.

### Task 3: Verify the acceptance auth contract

**Files:**
- Test: `registration_system_mini/src/stores/__tests__/goAuthFoundation.test.ts`
- Test: `registration_system_go/internal/auth/adapters/http/test_handler_test.go`
- Test: `registration_system_go/internal/bootstrap/router_test.go`

**Interfaces:**
- Go test routes exist only for explicit test/development configuration.
- H5 test login remains protected by `VITE_ENABLE_H5_TEST_LOGIN=true` and test build mode.

- [ ] **Step 1: Assert frontend gates and API paths**

Add source-contract assertions for the acceptance build script, `/test-auth/users`, `/test-auth/login`, and the explicit H5 flag.

- [ ] **Step 2: Run focused frontend tests**

```bash
cd registration_system_mini && bun test src/stores/__tests__/goAuthFoundation.test.ts
```

- [ ] **Step 3: Run Go auth/router tests**

```bash
cd registration_system_go && go test ./internal/auth/adapters/http ./internal/bootstrap
```

Expected: all tests pass without changing production route gating.

### Task 4: Run complete pre-deployment verification

**Files:**
- No source changes unless verification identifies a defect in Tasks 1-3.

**Interfaces:**
- Produces a verified candidate suitable for `main`.

- [ ] **Step 1: Verify mini-app tests and builds**

```bash
cd registration_system_mini && bun test
cd registration_system_mini && bun run type-check
cd registration_system_mini && VITE_PUBLIC_BASE=/mini-v3/ VITE_API_BASE_URL=https://oryjk.cn:82/regist-v3/api/v1/app VITE_ENABLE_H5_TEST_LOGIN=true bun run build:h5:acceptance
cd registration_system_mini && bun run build:mp-weixin
```

- [ ] **Step 2: Verify Go**

```bash
cd registration_system_go && gofmt -w .
cd registration_system_go && go test -race ./...
cd registration_system_go && go vet ./...
cd registration_system_go && go build -o /tmp/registration-system-go-api ./cmd/api
```

- [ ] **Step 3: Check, merge, and push**

```bash
git diff --check
git switch main
git merge --ff-only codex/out109-go-h5-v3
git push origin main
```

Preserve `.zcode/` and verify local `main` equals `origin/main`.

### Task 5: Deploy Go V3 through remote git pull

**Files:**
- Remote only: `registration_system_go/.env.acceptance-v3`

**Interfaces:**
- Runs container `registration-system-backend-go-v3` on `127.0.0.1:18081`.
- Leaves Rust `18080` unchanged.

- [ ] **Step 1: Pull main on out109**

```bash
cd /home/wangrui/projects/registration_system_repo && git checkout main && git pull --ff-only origin main
```

- [ ] **Step 2: Install acceptance environment**

Copy the existing Go credentials out-of-band, set `HTTP_ADDR=:18081`, `APP_ENV=test`, `ENABLE_H5_TEST_LOGIN=true`, `H5_TEST_DEFAULT_USER_ID=37`, and `WECHAT_PAY_USE_MOCK=true`, then set mode `0600` without printing values.

- [ ] **Step 3: Run forward migrations**

Run Goose from a temporary Go 1.26.5 container against the configured `DATABASE_URL`; stop on failure and never run `down`.

- [ ] **Step 4: Build and start Go V3**

```bash
docker build --platform linux/amd64 -t registration-system-backend-go-v3:current registration_system_go
```

Replace only `registration-system-backend-go-v3`, using `--restart unless-stopped`, `--env-file`, and `-p 127.0.0.1:18081:18081`. Wait for local `/health` HTTP 200.

### Task 6: Deploy H5 V3 and Nginx

**Files:**
- Remote only: `/mnt/e/docker_data/nginx/html/mini-v3/`
- Remote only: `/mnt/e/docker_data/nginx/config/default.conf`

**Interfaces:**
- H5: `https://oryjk.cn:82/mini-v3/`.
- API: `https://oryjk.cn:82/regist-v3/`.

- [ ] **Step 1: Build from remote main**

```bash
cd /home/wangrui/projects/registration_system_repo/registration_system_mini && VITE_PUBLIC_BASE=/mini-v3/ VITE_API_BASE_URL=https://oryjk.cn:82/regist-v3/api/v1/app VITE_ENABLE_H5_TEST_LOGIN=true bun run build:h5:acceptance
```

- [ ] **Step 2: Back up and replace only `mini-v3`**

Keep a timestamped backup, copy the fresh H5 output, and do not touch `/mini/`.

- [ ] **Step 3: Add literal Nginx blocks**

Add `/mini-v3/` static fallback and `/regist-v3/` proxy using a quoted write method so Nginx variables remain literal. Run `nginx -t` before reload.

### Task 7: Verify login and regression safety

**Files:**
- No source changes.

**Interfaces:**
- The V3 H5 can log in and access completed features.

- [ ] **Step 1: Verify public API auth**

Call test-user list, test login, `/users/me`, and `/teams/my`; never print the JWT.

- [ ] **Step 2: Verify H5 in the browser**

Open `/mini-v3/`, click `我的`, click `立即登录`, and verify the logged-in profile appears without the unsupported `uni.login` error.

- [ ] **Step 3: Verify old routes**

Confirm `/mini/` and `/regist-v2/health` still succeed, Rust remains on `18080`, and Go V3 is the only service on `18081`.

- [ ] **Step 4: Record final evidence**

Record local/remote `main`, container state, Nginx validation, public URLs, tests, and browser checks before marking completion.
