# 散人约队最少和最多人数配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 散人约队支持后台和小程序按场次配置最少成行人数与最多报名人数，未配置时沿用默认计算规则。

**Architecture:** 后端在 `challenge` 领域模型中新增 `min_players` / `max_players`，领域层负责默认值和容量语义，应用层负责输入校验，仓储负责持久化和基于最少人数切换成行状态。管理端通过现有约队创建/编辑表单暴露配置；小程序在散人发布页用默认收起的高级设置提交配置，并在列表/详情展示使用后端返回字段。

**Tech Stack:** Rust + Axum + sqlx + PostgreSQL；Vue 3 + TypeScript + DaisyUI；uni-app + Vue 3 + TypeScript。

---

### Task 1: 后端领域与业务规则

**Files:**
- Modify: `registration_system_rs/src/challenge/domain/challenge.rs`
- Modify: `registration_system_rs/src/challenge/application/commands.rs`
- Modify: `registration_system_rs/src/challenge/application/use_cases/create_challenge.rs`
- Modify: `registration_system_rs/src/challenge/application/use_cases/update_challenge.rs`
- Modify: `registration_system_rs/src/challenge/application/use_cases/accept_challenge.rs`
- Modify: `registration_system_rs/tests/challenge_service_business_test.rs`

- [ ] 新增领域 helper：散人默认 `min = players_per_team * 2`、`max = players_per_team * 2 + 4`；球队仍用 `players_per_team`。
- [ ] 创建/更新命令携带可选 `min_players` / `max_players`。
- [ ] 散人配置校验：传入值必须大于 0，且最终 `min <= max`。
- [ ] 报名拦截使用最大报名人数，成行状态使用最少成行人数。

### Task 2: 后端持久化与接口字段

**Files:**
- Create: `registration_system_rs/migrations/20260523000200_challenge_signup_limits.sql`
- Modify: `registration_system_rs/src/challenge/adapters/persistence/models.rs`
- Modify: `registration_system_rs/src/challenge/adapters/persistence/postgres_challenge_repository.rs`
- Modify: `registration_system_rs/src/challenge/ports/challenge_repository.rs`
- Modify: `registration_system_rs/src/challenge/adapters/web/dto.rs`
- Modify: `registration_system_rs/src/challenge/adapters/web/handlers.rs`

- [ ] `rs_challenges` 新增 nullable `min_players` / `max_players`。
- [ ] 所有 challenge 查询、插入、更新、返回 DTO 透传这两个字段。
- [ ] `accept_individual` / `cancel_individual_acceptance` 在 SQL 事务内使用领域 helper 计算成行状态。

### Task 3: 管理端接入

**Files:**
- Modify: `registration_system_backend_fe/src/services/challenge.ts`
- Modify: `registration_system_backend_fe/src/views/challenges/ChallengeEditDialog.vue`
- Modify: `registration_system_backend_fe/src/views/challenges/ChallengeDetail.vue`
- Modify: `registration_system_backend_fe/src/views/challenges/ChallengeList.vue`

- [ ] 类型和 payload 增加 `min_players` / `max_players`。
- [ ] 创建/编辑散人报名时显示“最少成行人数”“最多报名人数”。
- [ ] 列表和详情显示“已报 N / min 成行，最多 max”。

### Task 4: 小程序接入

**Files:**
- Modify: `registration_system_mini/src/types/backend.ts`
- Modify: `registration_system_mini/src/api/challenge.ts`
- Modify: `registration_system_mini/src/pages/challenges/create-individual/index.vue`
- Modify: `registration_system_mini/src/utils/viewModels.ts`
- Modify: `registration_system_mini/src/pages/challenges/detail.vue`
- Modify: `registration_system_mini/src/pages/challenges/components/ChallengeIndividualRegistration.vue`

- [ ] 散人发布页新增默认收起的高级设置。
- [ ] 高级设置展开后可填写最少成行人数和最多报名人数；未填写时不提交字段。
- [ ] 详情页报名按钮、剩余名额和进度展示改用最大报名人数/最少成行人数。
- [ ] 卡片/报名区域展示“达到 X 人开踢，最多 Y 人”。

### Task 5: 验证与文档同步

- [ ] 后端运行散人约队业务测试与 `cargo check --tests`。
- [ ] 管理端运行 `bun run type-check`。
- [ ] 小程序运行 `bun run type-check` 和必要的 `bun run build:mp-weixin`。
- [ ] 同步根目录及三个子项目的 `task_plan.md` / `findings.md` / `progress.md`。
