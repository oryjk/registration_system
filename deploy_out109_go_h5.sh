#!/usr/bin/env bash
# Backward-compatible command name; deployment now targets jd, never out109.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
printf '%s\n' '部署已迁移至 jd；请改用 deploy_jd_go_h5.sh。旧命令将调用同一 jd 部署流程。' >&2
exec "${SCRIPT_DIR}/deploy_jd_go_h5.sh" "$@"
