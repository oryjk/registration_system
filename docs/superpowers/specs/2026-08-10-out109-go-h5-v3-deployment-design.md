# out109 Go + H5 V3 Parallel Deployment Design

## Goal

Deploy a complete acceptance environment for the Go backend and the mini-app H5 frontend on `out109`, while preserving the existing Rust backend and existing H5 deployment without changes.

The new public entry points are:

- H5: `https://oryjk.cn:82/mini-v3/`
- Go API proxy: `https://oryjk.cn:82/regist-v3/`
- H5 Go App API base: `https://oryjk.cn:82/regist-v3/api/v1/app`

## Existing Environment

- The existing Rust container `registration-system-backend-rs` owns host port `18080`.
- Nginx currently proxies `/regist-v2/` to host port `18080`.
- The existing H5 build is served from `/mini/`.
- The existing Rust routes and H5 files must remain available during and after this deployment.
- The checked-out repository on `out109` is `/home/wangrui/projects/registration_system_repo` on branch `main`.
- Host port `18081` is currently free.
- `out109` has Docker but no Go toolchain. Bun and Node are available.
- The existing Go PostgreSQL database endpoint is reachable from `out109` and uses the separate `registration_system_go` database.

## Architecture

### Go API

The Go API runs in a dedicated Docker container named `registration-system-backend-go-v3`.

- Container port: `18081`
- Host binding: `127.0.0.1:18081:18081`
- Restart policy: `unless-stopped`
- Source: the `registration_system_go/` directory from the server-side `main` checkout after `git pull --ff-only origin main`
- Build: a multi-stage Docker build using Go 1.26.5 and a minimal runtime image
- Health check: `GET /health`
- Runtime configuration: untracked server-side environment file with mode `0600`

The container binds only to loopback on the host. Public traffic reaches it exclusively through Nginx.

### H5 Frontend

The H5 build is generated on `out109` from the server-side `main` checkout.

- Build base: `/mini-v3/`
- API base: `https://oryjk.cn:82/regist-v3/api/v1/app`
- Build mode: acceptance/test mode
- H5 test login: explicitly enabled for this build
- Output directory: `registration_system_mini/dist/build/h5`
- Nginx static directory: `/mnt/e/docker_data/nginx/html/mini-v3/`

The existing `/mnt/e/docker_data/nginx/html/mini/` directory is not overwritten.

### Nginx

Nginx receives two additive route blocks:

```nginx
location = /mini-v3 {
    return 301 https://$host:82/mini-v3/;
}

location /mini-v3/ {
    alias /usr/share/nginx/html/mini-v3/;
    try_files $uri $uri/ /mini-v3/index.html;
    index index.html;
}

location /regist-v3/ {
    proxy_pass http://host.docker.internal:18081/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The configuration update is idempotent, preserves literal Nginx variables such as `$host` and `$uri`, creates a timestamped backup, runs `nginx -t`, and reloads only after validation succeeds.

## Acceptance Authentication

This deployment is an acceptance environment, not the production login configuration.

The frontend and backend must both opt into H5 test login:

- Frontend build: `VITE_ENABLE_H5_TEST_LOGIN=true`
- Go backend: `APP_ENV=test` and `ENABLE_H5_TEST_LOGIN=true`

The Go backend continues to reject test-login route registration in production mode. The H5 production build continues to avoid exposing the test-login path. This keeps the acceptance capability explicit and prevents a future production deployment from inheriting it accidentally.

The H5 login flow is:

1. Load `GET /api/v1/app/test-auth/users`.
2. Select the configured default user when present, otherwise the first returned user.
3. Submit `POST /api/v1/app/test-auth/login` with `user_id`.
4. Store the returned JWT.
5. Load the current user and team context from the Go API.

## Runtime Configuration

The server-side environment file is created outside Git and is never printed in logs. It uses the existing Go database and authentication secrets, plus these non-secret acceptance settings:

```dotenv
HTTP_ADDR=:18081
APP_ENV=test
ENABLE_H5_TEST_LOGIN=true
H5_TEST_DEFAULT_USER_ID=37
WECHAT_PAY_USE_MOCK=true
```

The environment file must remain readable only by its owner. Deployment output reports only which required keys are present, never their values.

## Database Migration

Before replacing or starting the Go container:

1. Read the acceptance environment file without printing values.
2. Run all Go migrations from `registration_system_go/db/migrations` against the configured `registration_system_go` database.
3. Stop immediately if migration fails.
4. Do not run down migrations automatically.
5. Do not modify the Rust database or Rust container.

Migrations are forward-only during deployment. The application container is started only after migrations complete successfully.

## Deployment Workflow

Deployment is performed from the `out109` checkout and does not copy source build artifacts from the development machine.

1. Verify the remote checkout has no conflicting tracked changes.
2. Run `git checkout main` and `git pull --ff-only origin main`.
3. Verify the pulled commit matches `origin/main`.
4. Install frozen H5 dependencies.
5. Run Go migrations using the acceptance environment.
6. Build the Go Docker image from the pulled source.
7. Start or replace only `registration-system-backend-go-v3` on `127.0.0.1:18081`.
8. Wait for `http://127.0.0.1:18081/health` to return HTTP 200.
9. Build H5 with `/mini-v3/`, the `/regist-v3/` API base, and acceptance test login enabled.
10. Replace only the `mini-v3` static directory.
11. Add the isolated Nginx routes, test configuration, and reload.
12. Verify public health, test-user list, test login, authenticated user context, H5 rendering, and client-side routing.

## Failure Handling And Rollback

- A failed Git pull, dependency install, migration, image build, container health check, H5 build, or Nginx validation stops deployment immediately.
- The previous Go V3 container remains available until the new image is built successfully.
- The previous `mini-v3` static directory is moved to a timestamped backup before replacement.
- Nginx configuration is backed up before modification and restored if validation fails.
- Rollback never changes `/regist-v2/`, the Rust container, or `/mini/`.
- Database migrations are not automatically reversed. An application rollback must remain compatible with the migrated schema.

## Verification

Before deployment:

- Mini frontend: `bun test`, `bun run type-check`, acceptance H5 build, and `bun run build:mp-weixin`
- Go backend: `gofmt -w .`, `go test -race ./...`, `go vet ./...`, and Linux API build

After deployment:

- `GET https://oryjk.cn:82/regist-v3/health` returns HTTP 200.
- `GET https://oryjk.cn:82/regist-v3/api/v1/app/test-auth/users` returns a Go success envelope with at least one user.
- `POST https://oryjk.cn:82/regist-v3/api/v1/app/test-auth/login` returns a JWT for the selected test user.
- The JWT can load `/api/v1/app/users/me` and `/api/v1/app/teams/my`.
- `GET https://oryjk.cn:82/mini-v3/` returns the new H5 index with `/mini-v3/` asset URLs.
- Clicking `立即登录` in the public H5 completes the test-login flow without calling `uni.login`.
- Existing `/mini/` and `/regist-v2/health` continue to return their previous successful responses.

## Out Of Scope

- Replacing or stopping the Rust backend.
- Reusing port `18080` for Go.
- Enabling H5 test login in a production Go environment.
- Implementing browser WeChat OAuth.
- Enabling real WeChat payment in this acceptance deployment.
- Automatically rolling back database migrations.
