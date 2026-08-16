#!/usr/bin/env zsh

# 部署 Go 后端（Docker）+ 小程序 H5 + 管理后台前端到 out109 验收环境。
#
# - Go: 在 out109 的 git checkout 上构建镜像 registration-system-backend-go-v3，
#   先跑 goose 前向迁移（cmd/dbmigrate，只链接仓库内依赖），再替换 127.0.0.1:18081
#   上的容器（显式 -e HTTP_ADDR=:18081，Docker Desktop 桥接网络下必须绑 0.0.0.0）。
# - H5: 本地用 --mode test 构建（读取 registration_system_mini/.env.test），
#   打包上传到 nginx volume 目录，备份旧 mini-v3 后原子替换（备份保留最近 5 份）。
# - 管理后台: 本地用 bun run build:out109 构建（/regist-admin-v3/ 前缀，
#   API 指向 https://oryjk.cn:82/regist-v3），上传替换同名目录，
#   并幂等补充 nginx location 配置（备份 + nginx -t + reload）。
# - nginx 的 /regist-v3/ 与 /mini-v3/ 配置已存在，仅 /regist-admin-v3/ 由本脚本维护。
#
# 前置条件：
# - 本地 main 已推送到 origin（脚本会校验，不一致则退出）
# - registration_system_mini/.env.test 存在，内容形如：
#     VITE_PUBLIC_BASE=/mini-v3/
#     VITE_API_BASE_URL=https://oryjk.cn:82/regist-v3/api/v1/app
#     VITE_ENABLE_H5_TEST_LOGIN=true
# - out109 的 ${REPO_DIR}/registration_system_go/.env.credentials-v3（数据库凭据）
#   与 .env.acceptance-v3（验收开关）存在且包含必需键（只校验键，不打印值）
#
# 可选环境变量：
# - SKIP_GO=1 / SKIP_H5=1 / SKIP_ADMIN=1 跳过对应部分

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
GO_CREDENTIALS_FILE="${GO_CREDENTIALS_FILE:-.env.credentials-v3}"
GO_ACCEPTANCE_FILE="${GO_ACCEPTANCE_FILE:-.env.acceptance-v3}"
GOLANG_IMAGE="${GOLANG_IMAGE:-golang:1.26.5-bookworm}"
GO_MOD_CACHE_VOLUME="${GO_MOD_CACHE_VOLUME:-registration-go-mod-cache}"

H5_HTML_ROOT="${H5_HTML_ROOT:-/mnt/e/docker_data/nginx/html}"
H5_DIR="${H5_DIR:-mini-v3}"
ADMIN_DIR="${ADMIN_DIR:-regist-admin-v3}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://oryjk.cn:82}"
NGINX_CONTAINER="${NGINX_CONTAINER:-nginx}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/mnt/e/docker_data/nginx/config/default.conf}"
BACKUP_KEEP="${BACKUP_KEEP:-5}"

MINI_DIR="${SCRIPT_DIR}/registration_system_mini"
H5_DIST="${MINI_DIR}/dist/build/h5"
ADMIN_FE_DIR="${SCRIPT_DIR}/registration_system_backend_fe_go"
ADMIN_DIST="${ADMIN_FE_DIR}/dist"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

SKIP_GO="${SKIP_GO:-}"
SKIP_H5="${SKIP_H5:-}"
SKIP_ADMIN="${SKIP_ADMIN:-}"

# 上传本地静态目录到 nginx volume，备份旧目录后原子替换，并只保留最近 ${BACKUP_KEEP} 份备份。
# 用法: upload_static <本地目录> <远端目录名>
upload_static() {
    local local_dir="$1"
    local remote_name="$2"
    local tarball
    tarball="$(mktemp -t out109-static).tar.gz"
    tar czf "${tarball}" -C "${local_dir}" .
    scp "${tarball}" "${BUILD_HOST}:/tmp/${remote_name}-${TIMESTAMP}.tar.gz" >/dev/null
    rm -f "${tarball}"
    ssh "${BUILD_HOST}" \
        "H5_HTML_ROOT='${H5_HTML_ROOT}' STATIC_DIR='${remote_name}' TIMESTAMP='${TIMESTAMP}' BACKUP_KEEP='${BACKUP_KEEP}' bash -s" << 'EOF'
set -euo pipefail
NEW_DIR="${H5_HTML_ROOT}/${STATIC_DIR}.new-${TIMESTAMP}"
mkdir -p "${NEW_DIR}"
tar xzf "/tmp/${STATIC_DIR}-${TIMESTAMP}.tar.gz" -C "${NEW_DIR}"
rm -f "/tmp/${STATIC_DIR}-${TIMESTAMP}.tar.gz"
cd "${H5_HTML_ROOT}"
if [ -d "${STATIC_DIR}" ]; then
    mv "${STATIC_DIR}" "${STATIC_DIR}.bak-${TIMESTAMP}"
fi
mv "${NEW_DIR}" "${STATIC_DIR}"
# 只保留最近 N 份备份，避免无限累积
ls -1dt "${STATIC_DIR}.bak-"* 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -rf
echo "✅ ${STATIC_DIR} 已替换，备份保留最近 ${BACKUP_KEEP} 份"
EOF
}

echo "🚀 部署 Go + H5 + 管理后台到 ${BUILD_HOST}（分支 ${BRANCH}）"
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

if [ -z "${SKIP_H5}" ]; then
    if [ ! -f "${MINI_DIR}/.env.test" ]; then
        echo "❌ 未找到 ${MINI_DIR}/.env.test，需要包含："
        echo "   VITE_PUBLIC_BASE=/${H5_DIR}/"
        echo "   VITE_API_BASE_URL=${PUBLIC_ORIGIN}/regist-v3/api/v1/app"
        echo "   VITE_ENABLE_H5_TEST_LOGIN=true"
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
fi

if [ -z "${SKIP_ADMIN}" ]; then
    echo "🏗️  本地构建管理后台（build:out109）"
    (cd "${ADMIN_FE_DIR}" && bun run build:out109)
    if [ ! -f "${ADMIN_DIST}/index.html" ]; then
        echo "❌ 管理后台构建产物缺失: ${ADMIN_DIST}/index.html"
        exit 1
    fi
    if ! grep -q '"/'"${ADMIN_DIR}"'/' "${ADMIN_DIST}/index.html"; then
        echo "❌ 管理后台产物资源未携带 /${ADMIN_DIR}/ 前缀，请检查 build:out109 配置"
        exit 1
    fi
    echo "✅ 管理后台构建完成，资源前缀 /${ADMIN_DIR}/ 校验通过"
fi

if [ -z "${SKIP_GO}" ]; then
    echo "📥 更新 ${BUILD_HOST} 上的代码仓库"
    ssh "${BUILD_HOST}" \
        "REPO_DIR='${REPO_DIR}' BRANCH='${BRANCH}' EXPECTED='${LOCAL_HEAD}' bash -s" << 'EOF'
set -euo pipefail

# out109 直连 GitHub 不通，需走宿主机代理；端口会变（Clash 7890/7897），自动探测。
GATEWAY="$(ip route show default | awk '{print $3}')"
PROXY_PORT=""
for port in 7890 7897; do
    if timeout 3 bash -c "echo > /dev/tcp/${GATEWAY}/${port}" 2>/dev/null; then
        PROXY_PORT="${port}"
        break
    fi
done
if [ -z "${PROXY_PORT}" ]; then
    echo "❌ 未找到可用的宿主机代理端口（7890/7897），无法访问 GitHub"
    exit 1
fi
export http_proxy="http://${GATEWAY}:${PROXY_PORT}"
export https_proxy="http://${GATEWAY}:${PROXY_PORT}"
export no_proxy="localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12"
echo "🌐 远端代理: ${GATEWAY}:${PROXY_PORT}"

if [ ! -d "${REPO_DIR}/.git" ]; then
    git clone https://github.com/oryjk/registration_system.git "${REPO_DIR}"
fi
cd "${REPO_DIR}"
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ 远端工作区有未提交改动，请先手动处理（部署要求干净 checkout）"
    git status --short | head -10
    exit 1
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
    ssh "${BUILD_HOST}" \
        "REPO_DIR='${REPO_DIR}' CRED='${GO_CREDENTIALS_FILE}' ACC='${GO_ACCEPTANCE_FILE}' bash -s" << 'EOF'
set -euo pipefail
check_keys() {
    local file="$1"; shift
    if [ ! -f "${file}" ]; then
        echo "❌ 远端缺少 ${file}（模式 0600）"
        exit 1
    fi
    local missing=""
    for key in "$@"; do
        if ! grep -q "^${key}=" "${file}"; then
            missing="${missing} ${key}"
        fi
    done
    if [ -n "${missing}" ]; then
        echo "❌ ${file} 缺少必需键:${missing}"
        exit 1
    fi
}
cd "${REPO_DIR}/registration_system_go"
check_keys "${CRED}" HTTP_ADDR DATABASE_URL JWT_SECRET WECHAT_APP_ID WECHAT_APP_SECRET
check_keys "${ACC}" HTTP_ADDR APP_ENV ENABLE_H5_TEST_LOGIN H5_TEST_DEFAULT_USER_ID WECHAT_PAY_USE_MOCK
echo "✅ 远端环境文件键齐全（${CRED} + ${ACC}）"
EOF

    echo "🗄️  执行数据库前向迁移（cmd/dbmigrate，仅 up）"
    ssh "${BUILD_HOST}" \
        "REPO_DIR='${REPO_DIR}' CRED='${GO_CREDENTIALS_FILE}' GOLANG_IMAGE='${GOLANG_IMAGE}' GO_MOD_CACHE_VOLUME='${GO_MOD_CACHE_VOLUME}' bash -s" << 'EOF'
set -euo pipefail
# 注意不能用 `go run goose@version`：CLI 入口的驱动依赖不在 go.sum，会直接报错。
docker run --rm --network host \
    --env-file "${REPO_DIR}/registration_system_go/${CRED}" \
    -e GOPROXY=https://goproxy.cn,direct \
    -e GOSUMDB=sum.golang.google.cn \
    -v "${REPO_DIR}/registration_system_go:/src:ro" \
    -v "${GO_MOD_CACHE_VOLUME}:/go/pkg/mod" \
    -w /src \
    "${GOLANG_IMAGE}" \
    go run ./cmd/dbmigrate
EOF

    echo "📦 在 ${BUILD_HOST} 构建 Go 镜像"
    ssh "${BUILD_HOST}" \
        "REPO_DIR='${REPO_DIR}' GO_IMAGE='${GO_IMAGE}' IMAGE_TAG='${IMAGE_TAG}' bash -s" << 'EOF'
set -euo pipefail
cd "${REPO_DIR}/registration_system_go"
# 不用 --pull：out109 直连 docker registry 不通，本地已有基础镜像缓存；
# Go 模块下载走 Dockerfile 内置的 GOPROXY=goproxy.cn，无需代理。
docker build \
    -t "${GO_IMAGE}:${IMAGE_TAG}" \
    -t "${GO_IMAGE}:current" \
    .
EOF

    echo "🔄 替换 Go 容器（127.0.0.1:${GO_PORT}，失败自动回滚旧镜像）"
    ssh "${BUILD_HOST}" \
        "REPO_DIR='${REPO_DIR}' GO_IMAGE='${GO_IMAGE}' IMAGE_TAG='${IMAGE_TAG}' GO_CONTAINER='${GO_CONTAINER}' GO_PORT='${GO_PORT}' CRED='${GO_CREDENTIALS_FILE}' ACC='${GO_ACCEPTANCE_FILE}' bash -s" << 'EOF'
set -euo pipefail

run_container() {
    docker run -d \
        --name "${GO_CONTAINER}" \
        --restart unless-stopped \
        -p "127.0.0.1:${GO_PORT}:${GO_PORT}" \
        --env-file "${REPO_DIR}/registration_system_go/${CRED}" \
        --env-file "${REPO_DIR}/registration_system_go/${ACC}" \
        -e "HTTP_ADDR=:${GO_PORT}" \
        "$1"
}

OLD_IMAGE="$(docker inspect "${GO_CONTAINER}" --format '{{.Config.Image}}' 2>/dev/null || true)"
docker rm -f "${GO_CONTAINER}" >/dev/null 2>&1 || true
sleep 1

# Docker Desktop 下端口由 docker-proxy 发布；此时若仍被监听，说明有宿主机残留进程
# （例如遗留的 go run ./cmd/api）占着端口，直接报错而非让健康检查超时。
if ss -tln 2>/dev/null | grep -q ":${GO_PORT} "; then
    echo "❌ 端口 ${GO_PORT} 仍被宿主机进程占用（可能是遗留的 go run 进程），请先清理："
    ss -tlnp 2>/dev/null | grep ":${GO_PORT} " || true
    exit 1
fi

run_container "${GO_IMAGE}:${IMAGE_TAG}"

for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${GO_PORT}/health" >/dev/null 2>&1; then
        docker ps --filter "name=${GO_CONTAINER}"
        exit 0
    fi
    sleep 2
done

echo "❌ 新容器健康检查失败，输出最近日志："
docker logs --tail 100 "${GO_CONTAINER}" 2>&1 || true
docker rm -f "${GO_CONTAINER}" >/dev/null 2>&1 || true

if [ -n "${OLD_IMAGE}" ]; then
    echo "↩️  回滚到旧镜像 ${OLD_IMAGE}"
    run_container "${OLD_IMAGE}"
    sleep 3
    if curl -fsS "http://127.0.0.1:${GO_PORT}/health" >/dev/null 2>&1; then
        echo "✅ 已回滚到旧版本"
    else
        echo "⚠️  回滚后健康检查仍未通过，请人工检查"
    fi
fi
exit 1
EOF
fi

if [ -z "${SKIP_H5}" ]; then
    echo "📤 上传 H5 静态文件并原子替换 ${H5_DIR}"
    upload_static "${H5_DIST}" "${H5_DIR}"
fi

if [ -z "${SKIP_ADMIN}" ]; then
    echo "📤 上传管理后台静态文件并原子替换 ${ADMIN_DIR}"
    upload_static "${ADMIN_DIST}" "${ADMIN_DIR}"

    echo "🌐 确保 nginx /${ADMIN_DIR}/ 配置存在"
    ssh "${BUILD_HOST}" \
        "NGINX_CONTAINER='${NGINX_CONTAINER}' NGINX_CONFIG_PATH='${NGINX_CONFIG_PATH}' ADMIN_DIR='${ADMIN_DIR}' TIMESTAMP='${TIMESTAMP}' python3 -" << 'PYEOF'
import os
import subprocess
from pathlib import Path

config_path = Path(os.environ["NGINX_CONFIG_PATH"])
admin_dir = os.environ["ADMIN_DIR"]
timestamp = os.environ["TIMESTAMP"]

text = config_path.read_text()

anchor = """    location /regist-admin/ {
        alias /usr/share/nginx/html/regist-admin/;
        try_files $uri $uri/ /regist-admin/index.html;
        index index.html;
    }
"""
block = f"""
    location = /{admin_dir} {{
        return 301 https://$host:82/{admin_dir}/;
    }}

    # /{admin_dir} Go 版管理后台前端 (registration_system_backend_fe_go)
    location /{admin_dir}/ {{
        alias /usr/share/nginx/html/{admin_dir}/;
        try_files $uri $uri/ /{admin_dir}/index.html;
        index index.html;
    }}
"""

if f"location /{admin_dir}/" not in text:
    if anchor not in text:
        raise SystemExit("nginx config anchor /regist-admin/ not found")
    backup_path = config_path.with_name(config_path.name + f".bak-{timestamp}")
    backup_path.write_text(text)
    config_path.write_text(text.replace(anchor, anchor + block, 1))
    print(f"✅ nginx 已追加 /{admin_dir}/ 配置，备份 {backup_path.name}")
else:
    print(f"ℹ️  nginx 已存在 /{admin_dir}/ 配置，跳过")

subprocess.run(["docker", "exec", os.environ["NGINX_CONTAINER"], "nginx", "-t"], check=True)
subprocess.run(["docker", "exec", os.environ["NGINX_CONTAINER"], "nginx", "-s", "reload"], check=True)
PYEOF
fi

echo "🔎 验证线上入口"
if [ -z "${SKIP_GO}" ]; then
    ssh "${BUILD_HOST}" "curl -fsS http://127.0.0.1:${GO_PORT}/health && echo"
    curl -kfsS "${PUBLIC_ORIGIN}/regist-v3/health" && echo
fi
if [ -z "${SKIP_H5}" ]; then
    curl -kfsS "${PUBLIC_ORIGIN}/${H5_DIR}/" | grep -q '"/'"${H5_DIR}"'/' \
        && echo "✅ ${PUBLIC_ORIGIN}/${H5_DIR}/ 资源前缀正确"
fi
if [ -z "${SKIP_ADMIN}" ]; then
    curl -kfsS "${PUBLIC_ORIGIN}/${ADMIN_DIR}/" | grep -q '"/'"${ADMIN_DIR}"'/' \
        && echo "✅ ${PUBLIC_ORIGIN}/${ADMIN_DIR}/ 资源前缀正确"
fi

echo "🎉 部署完成: ${GO_IMAGE}:${IMAGE_TAG} + ${H5_DIR} + ${ADMIN_DIR} @${TIMESTAMP}"
