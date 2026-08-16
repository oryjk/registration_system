#!/usr/bin/env bash
# 一键迁移 Rust 旧库数据到 Go 新库（可反复执行）。
#
# 前置条件（二选一）：
#   - 本机安装了 Go 1.26+（脚本直接 go run）
#   - 本机有 Docker（脚本用 golang:1.26.5-bookworm 镜像运行）
# 本机需要能同时连通旧库和新库。
#
# 环境变量（必填）：
#   LEGACY_PG_URL  旧库连接串，例如
#     postgres://football_app:<密码>@211.154.18.252:15432/registration_system?sslmode=disable
#   TARGET_PG_URL  新库连接串（库名必须写全），例如
#     postgres://football_app:<密码>@211.154.18.252:15432/registration_system_go?sslmode=disable
#
# 可选参数（默认值适用于当前洺悦御府场景）：
#   LEGACY_TEAM_ID=1            旧库球队 ID
#   HOST_TEAM_ID=11             新库主队 ID
#   HOST_TEAM_NAME=洺悦御府     新库主队名称
#   CAPTAIN_LEGACY_USER_ID=4    旧库队长用户 ID（新库原样保留该 ID）
#   ADMIN_USERNAME=admin        初始化的后台超级管理员账号
#   ADMIN_PASSWORD=admin123     初始化密码（验收默认值，正式环境务必覆盖）
#
# 行为：清空并重建目标库 → 建表 → 种子主队/队长 → 初始化后台超级管理员 →
#   全量导入 → 数量校验。
# 任何一步失败或校验不一致都会非零退出。迁移期间目标服务会短暂连不上库，属预期。
#
# 用法：
#   LEGACY_PG_URL=... TARGET_PG_URL=... ./scripts/migrate-legacy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

: "${LEGACY_PG_URL:?需要设置 LEGACY_PG_URL}"
: "${TARGET_PG_URL:?需要设置 TARGET_PG_URL}"

LEGACY_TEAM_ID="${LEGACY_TEAM_ID:-1}"
HOST_TEAM_ID="${HOST_TEAM_ID:-11}"
HOST_TEAM_NAME="${HOST_TEAM_NAME:-洺悦御府}"
CAPTAIN_LEGACY_USER_ID="${CAPTAIN_LEGACY_USER_ID:-4}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

ARGS=(
  -legacy-team-id "$LEGACY_TEAM_ID"
  -host-team-id "$HOST_TEAM_ID"
  -host-team-name "$HOST_TEAM_NAME"
  -captain-legacy-user-id "$CAPTAIN_LEGACY_USER_ID"
  -admin-username "$ADMIN_USERNAME"
  -admin-password "$ADMIN_PASSWORD"
)

if command -v go >/dev/null 2>&1; then
  exec env LEGACY_PG_URL="$LEGACY_PG_URL" TARGET_PG_URL="$TARGET_PG_URL" \
    go run ./cmd/migratelegacydb "${ARGS[@]}"
fi

if command -v docker >/dev/null 2>&1; then
  exec docker run --rm --network host \
    -v "$PWD":/src -w /src \
    -e GOPROXY="${GOPROXY:-https://goproxy.cn,direct}" \
    -e LEGACY_PG_URL="$LEGACY_PG_URL" \
    -e TARGET_PG_URL="$TARGET_PG_URL" \
    golang:1.26.5-bookworm go run ./cmd/migratelegacydb "${ARGS[@]}"
fi

echo "需要本机安装 Go 或 Docker 之一" >&2
exit 1
