#!/usr/bin/env zsh

set -euo pipefail

if [ -z "${ZSH_VERSION:-}" ]; then
    exec zsh "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${SCRIPT_DIR}/registration_system_rs/.env}"

BRANCH="${DEPLOY_BRANCH:-main}"
BUILD_HOST="${BUILD_HOST:-out109}"
BUILD_DIR="${BUILD_DIR:-/home/wangrui/projects/registration_system_repo}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/wangrui/projects/registration_system}"

HARBOR_REGISTRY="${HARBOR_REGISTRY:-harbor.oryjk.cn:82}"
HARBOR_PROJECT="${HARBOR_PROJECT:-registration-system}"
HARBOR_USERNAME="${HARBOR_USERNAME:-admin}"
HARBOR_PASSWORD="${HARBOR_PASSWORD:-}"

IMAGE_NAME="${IMAGE_NAME:-registration-system-backend-rs}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_REF="${HARBOR_REGISTRY}/${HARBOR_PROJECT}/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_REF="${HARBOR_REGISTRY}/${HARBOR_PROJECT}/${IMAGE_NAME}:latest"

CONTAINER_NAME="${CONTAINER_NAME:-registration-system-backend-rs}"
HOST_PORT="${HOST_PORT:-18080}"
APP_PORT="${APP_PORT:-18080}"
LOG_DIR="${LOG_DIR:-${DEPLOY_DIR}/registration_system_rs/logs}"
UPLOAD_DIR="${UPLOAD_DIR:-${DEPLOY_DIR}/registration_system_rs/uploads}"
NGINX_CONTAINER="${NGINX_CONTAINER:-nginx}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/mnt/e/docker_data/nginx/config/default.conf}"
NGINX_BACKUP_SUFFIX="$(date +%Y%m%d%H%M%S)"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-${DEPLOY_DIR}/registration_system_rs/.env}"

BUILD_DOCKER_CONFIG="${BUILD_DOCKER_CONFIG:-/tmp/registration-system-rs-docker-auth-build-${IMAGE_TAG}}"
DEPLOY_DOCKER_CONFIG="${DEPLOY_DOCKER_CONFIG:-/tmp/registration-system-rs-docker-auth-deploy-${IMAGE_TAG}}"

cleanup() {
    ssh "${BUILD_HOST}" "rm -rf '${BUILD_DOCKER_CONFIG}' '${DEPLOY_DOCKER_CONFIG}'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ -z "${HARBOR_PASSWORD}" ]; then
    if [ -t 0 ]; then
        read -r -s -p "请输入 Harbor 密码: " HARBOR_PASSWORD
        echo
    else
        echo "❌ 请通过 HARBOR_PASSWORD 环境变量传入 Harbor 密码"
        exit 1
    fi
fi

echo "🚀 部署 registration_system_rs 到 ${BUILD_HOST}"
echo "image: ${IMAGE_REF}"
echo "branch: ${BRANCH}"

git fetch origin "${BRANCH}"
LOCAL_HEAD="$(git rev-parse "${BRANCH}")"
REMOTE_HEAD="$(git rev-parse "origin/${BRANCH}")"

if [ "${LOCAL_HEAD}" != "${REMOTE_HEAD}" ]; then
    echo "❌ ${BRANCH} 分支尚未推送到 origin"
    echo "local : ${LOCAL_HEAD}"
    echo "remote: ${REMOTE_HEAD}"
    exit 1
fi

if [ ! -f "${DEPLOY_ENV_FILE}" ]; then
    echo "❌ 未找到部署环境文件: ${DEPLOY_ENV_FILE}"
    exit 1
fi

echo "📄 同步后端 .env 到 ${BUILD_HOST}:${REMOTE_ENV_FILE}"
ssh "${BUILD_HOST}" "mkdir -p '${LOG_DIR}' '${UPLOAD_DIR}'"
scp "${DEPLOY_ENV_FILE}" "${BUILD_HOST}:${REMOTE_ENV_FILE}" >/dev/null

echo "🔐 登录 Harbor on ${BUILD_HOST}"
printf '%s' "${HARBOR_PASSWORD}" \
    | ssh "${BUILD_HOST}" "mkdir -p '${BUILD_DOCKER_CONFIG}' && DOCKER_CONFIG='${BUILD_DOCKER_CONFIG}' docker login ${HARBOR_REGISTRY} -u '${HARBOR_USERNAME}' --password-stdin"

echo "📦 在 ${BUILD_HOST} 拉代码、构建镜像并推送 Harbor"
ssh "${BUILD_HOST}" \
    "BUILD_DIR='${BUILD_DIR}' BRANCH='${BRANCH}' IMAGE_REF='${IMAGE_REF}' LATEST_REF='${LATEST_REF}' DOCKER_CONFIG='${BUILD_DOCKER_CONFIG}' zsh -c 'source ~/.zshrc 2>/dev/null; proxy_on 2>/dev/null; zsh -s'" << 'EOF'
set -euo pipefail
export DOCKER_CONFIG

if [ ! -d "${BUILD_DIR}/.git" ]; then
    git clone https://github.com/oryjk/registration_system.git "${BUILD_DIR}"
fi

cd "${BUILD_DIR}"

if ! git diff --quiet || ! git diff --cached --quiet; then
    git stash push -m "deploy-registration-rs-$(date +%Y%m%d%H%M%S)"
fi

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

build_http_proxy="${http_proxy/172.17.64.1/host.docker.internal}"
build_https_proxy="${https_proxy/172.17.64.1/host.docker.internal}"
build_all_proxy="${all_proxy/172.17.64.1/host.docker.internal}"

docker build --pull \
    --build-arg http_proxy="${build_http_proxy}" \
    --build-arg https_proxy="${build_https_proxy}" \
    --build-arg all_proxy="${build_all_proxy}" \
    -t "${IMAGE_REF}" \
    -t "${LATEST_REF}" \
    "${BUILD_DIR}/registration_system_rs"

docker push "${IMAGE_REF}"
docker push "${LATEST_REF}"
EOF

echo "🔐 登录 Harbor on ${BUILD_HOST} for deploy"
printf '%s' "${HARBOR_PASSWORD}" \
    | ssh "${BUILD_HOST}" "mkdir -p '${DEPLOY_DOCKER_CONFIG}' && DOCKER_CONFIG='${DEPLOY_DOCKER_CONFIG}' docker login ${HARBOR_REGISTRY} -u '${HARBOR_USERNAME}' --password-stdin"

echo "📥 拉取镜像并启动新容器"
ssh "${BUILD_HOST}" \
    "DEPLOY_DIR='${DEPLOY_DIR}' IMAGE_REF='${IMAGE_REF}' CONTAINER_NAME='${CONTAINER_NAME}' HOST_PORT='${HOST_PORT}' APP_PORT='${APP_PORT}' REMOTE_ENV_FILE='${REMOTE_ENV_FILE}' DOCKER_CONFIG='${DEPLOY_DOCKER_CONFIG}' LOG_DIR='${LOG_DIR}' UPLOAD_DIR='${UPLOAD_DIR}' bash -s" << 'EOF'
set -euo pipefail
export DOCKER_CONFIG

mkdir -p "${LOG_DIR}" "${UPLOAD_DIR}"
chmod 777 "${LOG_DIR}" "${UPLOAD_DIR}" 2>/dev/null || true

docker pull "${IMAGE_REF}"
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "${HOST_PORT}:${APP_PORT}" \
    --workdir /app \
    --env-file "${REMOTE_ENV_FILE}" \
    -e APP_HOST=0.0.0.0 \
    -e APP_PORT="${APP_PORT}" \
    -v "${LOG_DIR}:/app/logs" \
    -v "${UPLOAD_DIR}:/app/uploads" \
    "${IMAGE_REF}"

for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${HOST_PORT}/health" >/dev/null 2>&1; then
        docker ps --filter "name=${CONTAINER_NAME}"
        exit 0
    fi
    sleep 2
done

echo "❌ 新容器健康检查失败，输出最近日志："
docker ps --filter "name=${CONTAINER_NAME}"
docker logs --tail 200 "${CONTAINER_NAME}" 2>&1 || true
exit 1
EOF

echo "🌐 更新 Nginx /regist-v2/ 路由"
ssh "${BUILD_HOST}" \
    "NGINX_CONTAINER='${NGINX_CONTAINER}' NGINX_CONFIG_PATH='${NGINX_CONFIG_PATH}' NGINX_BACKUP_SUFFIX='${NGINX_BACKUP_SUFFIX}' python3 - <<'EOF'
from pathlib import Path
import subprocess

config_path = Path('${NGINX_CONFIG_PATH}')
text = config_path.read_text()
needle = \"\"\"    location /regist/ {\n        proxy_pass http://host.docker.internal:8000/apid/;\n        # proxy_pass http://192.168.1.70:5678/api;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_buffer_size 128k;\n        proxy_buffers 4 256k;\n        proxy_busy_buffers_size 256k;\n\n    }\n\"\"\"
insert = needle + \"\"\"\n    location /regist-v2/ {\n        proxy_pass http://host.docker.internal:18080/;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_buffer_size 128k;\n        proxy_buffers 4 256k;\n        proxy_busy_buffers_size 256k;\n\n    }\n\"\"\"

if \"location /regist-v2/\" not in text:
    if needle not in text:
        raise SystemExit('nginx config anchor not found')
    backup_path = config_path.with_name(config_path.name + f'.bak-{\"${NGINX_BACKUP_SUFFIX}\"}')
    backup_path.write_text(text)
    config_path.write_text(text.replace(needle, insert, 1))

subprocess.run(['docker', 'exec', '${NGINX_CONTAINER}', 'nginx', '-t'], check=True)
subprocess.run(['docker', 'exec', '${NGINX_CONTAINER}', 'nginx', '-s', 'reload'], check=True)
EOF"

echo "🔎 验证线上入口"
ssh "${BUILD_HOST}" "curl -fsS http://127.0.0.1:${HOST_PORT}/health && echo && curl -kfsS https://oryjk.cn:82/regist-v2/health"

echo "🎉 部署完成: ${IMAGE_REF}"
