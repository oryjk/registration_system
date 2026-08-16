#!/usr/bin/env zsh

# 部署 Go 后端（Docker）+ 小程序 H5（静态文件）到 out109 验收环境。
#
# - Go: 在 out109 的 git checkout 上构建镜像 registration-system-backend-go-v3，
#   先跑 goose 前向迁移，再替换 127.0.0.1:18081 上的容器。
# - H5: 本地用 --mode test 构建（读取 registration_system_mini/.env.test），
#   打包上传到 nginx volume 目录，备份旧 mini-v3 后原子替换。
# - nginx 的 /regist-v3/ 与 /mini-v3/ 配置已存在，本脚本不修改 nginx 配置。
#
# 前置条件：
# - 本地 main 已推送到 origin（脚本会校验，不一致则退出）
# - registration_system_mini/.env.test 存在（VITE_PUBLIC_BASE / VITE_API_BASE_URL / VITE_ENABLE_H5_TEST_LOGIN）
# - out109 的 ${REPO_DIR}/registration_system_go/.env 存在且包含必需键（不打印值）
#
# 可选环境变量：PROXY_PORT 指定宿主机代理端口（默认自动探测 7890/7897）

set -euo pipefail

if [ -z "${ZSH_VERSION:-}" ]; then
    exec zsh "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

BRANCH="${DEPLOY_BRANCH:-main}"
BUILD_HOST="${BUILD_HOST:-out109}"
REPO_DIR="${REPO_DIR:-/home/wangrui/projects/registration_system_repo}"

GO_IMAGE="${GO_IMAGE:-registration-system-backend-go-v3}"
GO_CONTAINER="${GO_CONTAINER:-registration-system-backend-go-v3}"
GO_PORT="${GO_PORT:-18081}"
GOOSE_VERSION="${GOOSE_VERSION:-v3.27.2}"
GOLANG_IMAGE="${GOLANG_IMAGE:-golang:1.26.5-bookworm}"
GO_MOD_CACHE_VOLUME="${GO_MOD_CACHE_VOLUME:-registration-go-mod-cache}"

H5_HTML_ROOT="${H5_HTML_ROOT:-/mnt/e/docker_data/nginx/html}"
H5_DIR="${H5_DIR:-mini-v3}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://oryjk.cn:82}"

MINI_DIR="${SCRIPT_DIR}/registration_system_mini"
H5_DIST="${MINI_DIR}/dist/build/h5"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

echo "🚀 部署 Go + H5 到 ${BUILD_HOST}（分支 ${BRANCH}）"
cd "${SCRIPT_DIR}"

echo "🔍 校验本地 ${BRANCH} 已推送到 origin"
if command -v gtimeout >/dev/null 2>&1; then
    gtimeout 30 git fetch origin "${BRANCH}"
elif command -v timeout >/dev/null 2>&1; then
    timeout 30 git fetch origin "${BRANCH}"
else
    git fetch origin "${BRANCH}"
fi
LOCAL_HEAD="$(git rev-parse "${BRANCH}")"
REMOTE_HEAD="$(git rev-parse "origin/${BRANCH}")"
if [ "${LOCAL_HEAD}" != "${REMOTE_HEAD}" ]; then
    echo "❌ ${BRANCH} 分支尚未推送到 origin"
    echo "local : ${LOCAL_HEAD}"
    echo "remote: ${REMOTE_HEAD}"
    exit 1
fi
IMAGE_TAG="$(git rev-parse --short HEAD)"

if [ ! -f "${MINI_DIR}/.env.test" ]; then
    echo "❌ 未找到 ${MINI_DIR}/.env.test（验收构建环境文件）"
    exit 1
fi

echo "🏗️  本地构建 H5（--mode test）"
(cd "${MINI_DIR}" && bun run build:h5:acceptance)
if [ ! -f "${H5_DIST}/index.html" ]; then
    echo "❌ H5 构建产物缺失: ${H5_DIST}/index.html"
    exit 1
fi
if ! grep -q '"/'"${H5_DIR}"'/' "${H5_DIST}/index.html"; then
    echo "❌ H5 产物资源未携带 /${H5_DIR}/ 前缀，请检查 .env.test 的 VITE_PUBLIC_BASE"
    exit 1
fi
echo "✅ H5 构建完成，资源前缀 /${H5_DIR}/ 校验通过"

echo "📥 更新 ${BUILD_HOST} 上的代码仓库"
ssh "${BUILD_HOST}" \
    "REPO_DIR='${REPO_DIR}' BRANCH='${BRANCH}' EXPECTED='${LOCAL_HEAD}' PROXY_PORT='${PROXY_PORT:-}' bash -s" << 'EOF'
set -euo pipefail

# out109 直连 GitHub 不通，需走宿主机代理；端口会变（Clash 7890/7897），自动探测。
GATEWAY="$(ip route show default | awk '{print $3}')"
if [ -z "${PROXY_PORT}" ]; then
    for port in 7890 7897; do
        if timeout 3 bash -c "echo > /dev/tcp/${GATEWAY}/${port}" 2>/dev/null; then
            PROXY_PORT="${port}"
            break
        fi
    done
fi
if [ -n "${PROXY_PORT}" ]; then
    export http_proxy="http://${GATEWAY}:${PROXY_PORT}"
    export https_proxy="http://${GATEWAY}:${PROXY_PORT}"
    export all_proxy="socks5://${GATEWAY}:${PROXY_PORT}"
    export no_proxy="localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
    echo "🌐 远端代理: ${GATEWAY}:${PROXY_PORT}"
else
    echo "❌ 未找到可用的宿主机代理端口（7890/7897），无法访问 GitHub"
    exit 1
fi

if [ ! -d "${REPO_DIR}/.git" ]; then
    git clone https://github.com/oryjk/registration_system.git "${REPO_DIR}"
fi
cd "${REPO_DIR}"
if ! git diff --quiet || ! git diff --cached --quiet; then
    git stash push -m "deploy-go-h5-$(date +%Y%m%d%H%M%S)"
fi
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
ACTUAL="$(git rev-parse HEAD)"
if [ "${ACTUAL}" != "${EXPECTED}" ]; then
    echo "❌ 远端检出 ${ACTUAL} 与 origin/${BRANCH} ${EXPECTED} 不一致"
    exit 1
fi
echo "✅ 远端代码已到 ${ACTUAL}"
EOF

echo "🔑 校验远端 Go 环境文件（只检查键，不打印值）"
ssh "${BUILD_HOST}" "REPO_DIR='${REPO_DIR}' bash -s" << 'EOF'
set -euo pipefail
ENV_FILE="${REPO_DIR}/registration_system_go/.env"
if [ ! -f "${ENV_FILE}" ]; then
    echo "❌ 远端缺少 ${ENV_FILE}，请先手动创建（模式 0600）"
    exit 1
fi
missing=""
for key in HTTP_ADDR DATABASE_URL JWT_SECRET WECHAT_APP_ID WECHAT_APP_SECRET APP_ENV; do
    if ! grep -q "^${key}=" "${ENV_FILE}"; then
        missing="${missing} ${key}"
    fi
done
if [ -n "${missing}" ]; then
    echo "❌ 远端环境文件缺少必需键:${missing}"
    exit 1
fi
echo "✅ 远端环境文件键齐全"
EOF

echo "🗄️  执行数据库前向迁移（goose，仅 up）"
ssh "${BUILD_HOST}" \
    "REPO_DIR='${REPO_DIR}' GOOSE_VERSION='${GOOSE_VERSION}' GOLANG_IMAGE='${GOLANG_IMAGE}' GO_MOD_CACHE_VOLUME='${GO_MOD_CACHE_VOLUME}' bash -s" << 'EOF'
set -euo pipefail
docker run --rm --network host \
    --env-file "${REPO_DIR}/registration_system_go/.env" \
    -e GOPROXY=https://goproxy.cn,direct \
    -e GOSUMDB=sum.golang.google.cn \
    -v "${REPO_DIR}/registration_system_go:/src:ro" \
    -v "${GO_MOD_CACHE_VOLUME}:/go/pkg/mod" \
    -w /src \
    "${GOLANG_IMAGE}" \
    sh -c 'go run github.com/pressly/goose/v3/cmd/goose@'"${GOOSE_VERSION}"' -dir db/migrations postgres "$DATABASE_URL" up'
EOF

echo "📦 在 ${BUILD_HOST} 构建 Go 镜像"
ssh "${BUILD_HOST}" \
    "REPO_DIR='${REPO_DIR}' GO_IMAGE='${GO_IMAGE}' IMAGE_TAG='${IMAGE_TAG}' PROXY_PORT='${PROXY_PORT:-}' bash -s" << 'EOF'
set -euo pipefail
cd "${REPO_DIR}/registration_system_go"

GATEWAY="$(ip route show default | awk '{print $3}')"
if [ -z "${PROXY_PORT}" ]; then
    for port in 7890 7897; do
        if timeout 3 bash -c "echo > /dev/tcp/${GATEWAY}/${port}" 2>/dev/null; then
            PROXY_PORT="${port}"
            break
        fi
    done
fi
build_args=()
if [ -n "${PROXY_PORT}" ]; then
    # 容器内访问宿主机代理需换成 host.docker.internal
    build_args+=(--build-arg "http_proxy=http://host.docker.internal:${PROXY_PORT}")
    build_args+=(--build-arg "https_proxy=http://host.docker.internal:${PROXY_PORT}")
    build_args+=(--build-arg "all_proxy=socks5://host.docker.internal:${PROXY_PORT}")
    echo "🌐 构建代理: host.docker.internal:${PROXY_PORT}"
fi
docker build --pull \
    "${build_args[@]}" \
    -t "${GO_IMAGE}:${IMAGE_TAG}" \
    -t "${GO_IMAGE}:current" \
    .
EOF

echo "🔄 替换 Go 容器（127.0.0.1:${GO_PORT}）"
ssh "${BUILD_HOST}" \
    "REPO_DIR='${REPO_DIR}' GO_IMAGE='${GO_IMAGE}' IMAGE_TAG='${IMAGE_TAG}' GO_CONTAINER='${GO_CONTAINER}' GO_PORT='${GO_PORT}' bash -s" << 'EOF'
set -euo pipefail
docker rm -f "${GO_CONTAINER}" >/dev/null 2>&1 || true
docker run -d \
    --name "${GO_CONTAINER}" \
    --restart unless-stopped \
    -p "127.0.0.1:${GO_PORT}:${GO_PORT}" \
    --env-file "${REPO_DIR}/registration_system_go/.env" \
    "${GO_IMAGE}:${IMAGE_TAG}"

for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${GO_PORT}/health" >/dev/null 2>&1; then
        docker ps --filter "name=${GO_CONTAINER}"
        exit 0
    fi
    sleep 2
done

echo "❌ 新容器健康检查失败，输出最近日志："
docker ps -a --filter "name=${GO_CONTAINER}"
docker logs --tail 200 "${GO_CONTAINER}" 2>&1 || true
exit 1
EOF

echo "📤 上传 H5 静态文件并原子替换 ${H5_DIR}"
H5_TARBALL="$(mktemp -t go-h5-dist).tar.gz"
trap 'rm -f "${H5_TARBALL}"' EXIT
tar czf "${H5_TARBALL}" -C "${H5_DIST}" .
scp "${H5_TARBALL}" "${BUILD_HOST}:/tmp/${H5_DIR}-${TIMESTAMP}.tar.gz" >/dev/null
ssh "${BUILD_HOST}" \
    "H5_HTML_ROOT='${H5_HTML_ROOT}' H5_DIR='${H5_DIR}' TIMESTAMP='${TIMESTAMP}' bash -s" << 'EOF'
set -euo pipefail
NEW_DIR="${H5_HTML_ROOT}/${H5_DIR}.new-${TIMESTAMP}"
mkdir -p "${NEW_DIR}"
tar xzf "/tmp/${H5_DIR}-${TIMESTAMP}.tar.gz" -C "${NEW_DIR}"
rm -f "/tmp/${H5_DIR}-${TIMESTAMP}.tar.gz"
cd "${H5_HTML_ROOT}"
if [ -d "${H5_DIR}" ]; then
    mv "${H5_DIR}" "${H5_DIR}.bak-${TIMESTAMP}"
fi
mv "${NEW_DIR}" "${H5_DIR}"
echo "✅ ${H5_DIR} 已替换，备份为 ${H5_DIR}.bak-${TIMESTAMP}"
EOF

echo "🔎 验证线上入口"
ssh "${BUILD_HOST}" "curl -fsS http://127.0.0.1:${GO_PORT}/health && echo"
curl -kfsS "${PUBLIC_ORIGIN}/regist-v3/health" && echo
curl -kfsS "${PUBLIC_ORIGIN}/${H5_DIR}/" | grep -q '"/'"${H5_DIR}"'/' \
    && echo "✅ ${PUBLIC_ORIGIN}/${H5_DIR}/ 资源前缀正确"

echo "🎉 部署完成: ${GO_IMAGE}:${IMAGE_TAG} + ${H5_DIR}@${TIMESTAMP}"
