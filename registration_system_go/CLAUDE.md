# Go 后端协作指南

修改前先读根目录和当前目录的 `AGENTS.md`、`CLAUDE.md`。

## 推荐定位顺序

1. `internal/bootstrap` 和目标模块 `adapters/http/routes.go`
2. HTTP DTO / handler
3. application use case
4. ports
5. adapters/postgres 与 `db/queries`
6. `db/migrations`

## 边界

- 新功能优先形成小而高内聚的 use case，不建立全局巨型 service。
- Match 是唯一比赛聚合根；报名阵营使用 RegistrationGroup，不复制比赛。
- Rust 后端只读，不在本项目任务中补丁或同步实现。
- 复杂任务同步维护 `task_plan.md`、`findings.md`、`progress.md`。
