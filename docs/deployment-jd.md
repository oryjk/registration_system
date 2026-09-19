# 报名系统部署到 jd

2026-09-19 更新。服务已从家庭 Windows/WSL 环境迁移到 `ssh jd`。

## 入口与依赖

| 用途 | 当前地址/目录 |
| --- | --- |
| Go API | `https://oryjk.cn:82/regist-v3/` |
| 管理端 | `https://oryjk.cn:82/regist-admin-v3/` |
| 报名 H5 | `https://oryjk.cn:82/mini-v3/` |
| 官网 | `https://oryjk.cn/`、`https://www.oryjk.cn/` |
| 导航页 | `https://match.oryjk.cn/` |
| Compose | `/root/docker_data/registration-go-v3/compose.yaml` |
| 后端环境文件 | 同目录 `backend.env`（0600，不进 git、不打印） |
| MinIO 环境文件 | 同目录 `minio.env`（0600） |
| 本地头像等文件 | 同目录 `uploads/` → 后端 `/app/uploads` |
| MinIO 数据 | 同目录 `minio-data/`，桶 `registration`、`seat-images` |
| H5 / 管理端文件 | `/root/docker_data/nginx/html/mini-v3/`、`regist-admin-v3/` |
| nginx 配置 | `/root/docker_data/nginx/conf/nginx.conf` |

- `registration-system-backend-go-v3` 的端口为 `127.0.0.1:18081`；nginx 经 `registration-v3` 网络访问后端容器。
- `registration-minio` 经该私有网络提供 `http://registration-minio:9000`；仅主机回环地址发布 `19000`。不要重新指回家庭 MinIO。
- `registration-https82` 将 TLS 原样转发至 `nginx-server:443`，云防火墙须放行 TCP82。nginx 的 443 也已配置相同路径；现有客户端仍固定使用 :82，所以日常提供上表中的入口。
- PostgreSQL 仍使用原远端 `registration_system_go` 数据库；本次迁移没有复制数据库或变更表结构。以服务器 `backend.env` 为准，禁止把连接串写到文档。
- `nginx-server` 同时承载官网与 match 的其他业务；日常发布不重建它、不覆盖它的配置，也不重建 MinIO。
- 用户要求 `ssh out109` 保持原来的 `oryjk.cn:2222`。主域名已指向 jd，不能据此连接家庭机器；家庭构建机使用用户维护的 `ssh local109`。
- DDNS-Go 已停止但未删除，自动重启为 `no`。启动旧 DDNS 配置会把主域名改回家庭 IP。`harbor`/`portainer` 暂固定到迁移时的家庭 IP，家庭 IP 变化后需另行处理。

## 日常发布

前提：本地 Python3、Git、Bun，前端依赖已安装；本地 HEAD 是已推送的 `origin/main`，工作区干净。脚本对前后端使用同一个提交；通过 SSH 上传提交快照，jd 不需要连接 GitHub，也不需要 WSL/Clash 代理。

```bash
./deploy_jd_go_h5.sh --check          # 只读检查服务器，未提交工作区也可执行
./deploy_jd_go_h5.sh                  # Go + H5 + 管理端
./deploy_jd_go_h5.sh --skip-go        # 只发布前端
./deploy_jd_go_h5.sh --skip-h5 --skip-admin  # 只发布 Go
./deploy_jd_go_h5.sh --migrate        # 本次有必要的兼容性 schema 迁移时显式执行
```

兼容 `SKIP_GO=1`、`SKIP_H5=1`、`SKIP_ADMIN=1`；`DEPLOY_BRANCH` 默认 main，`DEPLOY_HOST` 默认 jd。目录和端口对应已迁移的 jd 安装，不支持用旧 `BUILD_HOST`、`REPO_DIR`、WSL 路径覆盖。

旧 `deploy_out109_go_h5.sh` 保留为提示并转调新脚本的兼容入口，**不会再部署到 out109**。

H5 在本地运行 `build:h5:acceptance`，沿用 `.env.test` 的产品开关；脚本显式设置 `/mini-v3/` 资源前缀和现有 Go API 地址。管理端执行 `bun run build:jd`；旧 `build:out109` 是构建别名。这里不上传微信小程序，`mp:release` 的微信发布流程仍独立。

Go 源码快照放在 jd 的 `releases/<时间>-<提交>/registration_system_go` 后构建 Docker 镜像。脚本只修改 Compose 中 backend 的 image，保留 env_file、上传目录和私有网络。新后端健康检查成功后 reload nginx，刷新容器 IP；检查失败恢复原 image 并再次验证。

`--migrate` 使用当前提交的 `cmd/dbmigrate` 和 jd 的 `backend.env` 执行前向迁移。应先确认数据库备份及新旧应用兼容性；**镜像回滚不会回滚数据库**。无 schema 改动不必执行。

前端先检查资源前缀，再在同一文件系统暂存及替换目录；旧文件保存在 `html/_backups/<应用>-<发布号>/`。脚本不自动删备份、旧镜像或发布源代码；2核4GB/60GB 实例应定期检查磁盘，按发布记录人工保留需要的回退版本。前后端不是一个跨服务原子事务，失败时以输出检查已完成的步骤。

## 验证及回滚

```bash
ssh jd 'cd /root/docker_data/registration-go-v3 && docker compose ps'
curl -f https://oryjk.cn:82/regist-v3/health
curl -f https://oryjk.cn:82/regist-v3/api/v1/app/system/mini-app-runtime-config
```

打开管理端和 H5，核对静态资源、登录和图片。自动脚本不提交报名或发起支付；涉及这些业务变更时另做授权范围内的验证。

后端激活前备份 `compose.before-<唯一编号>.yaml`。人工回滚应将所选备份内容恢复到 **compose.yaml 原路径**，然后在同目录执行 `docker compose up -d --no-deps backend`、健康检查以及 `docker exec nginx-server nginx -t && docker exec nginx-server nginx -s reload`。不要直接用另一个文件名启动，以免改变 Compose 项目/相对路径语义。前端从 `_backups` 取对应版本恢复，持久化数据不动。

如 nginx-server 被其他运维流程重建，须重新连接 `registration-v3` 网络再 reload。其 nginx.conf 是单文件 bind mount，修改时写入原文件，不能通过 mv 替换 inode。

## 本次迁移的保留项

原家庭服务和数据保留，不作为当前发布目标。新 jd 存储和旧家庭存储不是持续双向同步；后续以 jd 上传数据为准，禁止重新全量覆盖 jd MinIO。服务器上另有 `/root/docker_data/registration-go-v3/README.md` 记录迁移验证与备份位置。
