# Mini Team Manage Soft Neo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将球队管理完整工作台改造为已确认的 Soft Neo-Brutalism 风格，并保持现有业务流程和跨端兼容性。

**Architecture:** 页面继续负责业务状态与异步编排，现有子组件继续通过 props/emits 工作。视觉层复用 `src/components/neo` 基础组件和 `neo-tokens.css`，Wot UI 仅保留 picker/popup 等交互能力并通过样式覆盖融入 Neo 系统。

**Tech Stack:** uni-app、Vue 3、TypeScript、Vite、Wot UI 2.3.0、scoped CSS/rpx

## Global Constraints

- 不修改 API、权限、球队上下文、上传、搜索、成员状态和出勤统计逻辑。
- 不使用浏览器 DOM API；跨端能力统一使用 `uni.*`。
- CSS 使用 `rpx`，不用 `:hover`，按钮交互使用 `hover-class`。
- 保留现有 props/emits 契约和页面路由。
- 不提交或清理工作区中的既有用户改动。

---

### Task 1: 工作台外壳与模式切换

**Files:**
- Modify: `registration_system_mini/src/pages/teams/manage/index.vue`

**Interfaces:**
- Consumes: `NeoSurface`、`NeoSegmentedControl`、`TeamManageMode`
- Produces: 深色球队 Hero、可用模式选项和统一页面容器

- [ ] **Step 1:** 将 `activeMode` 映射为 `NeoSegmentOption[]`，保留 `resolveVisibleMode` 和现有模式条件。
- [ ] **Step 2:** 用 `NeoSurface variant="dark"` 重构 Hero，用 `NeoSegmentedControl` 替换自制模式按钮。
- [ ] **Step 3:** 将页面背景、间距、最大宽度、加载态和版本信息统一为 Neo token。
- [ ] **Step 4:** 运行 `bun run type-check` 验证模板与类型。

### Task 2: 球队资料、创建和加入面板

**Files:**
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamProfilePanel.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamCreatePanel.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamJoinPanel.vue`

**Interfaces:**
- Consumes: 既有表单 props/emits、`NeoSurface`、`NeoSectionHeader`、`NeoButton`
- Produces: 统一的资料编辑、创建和搜索加入表单

- [ ] **Step 1:** 使用 Neo 面板与分区标题替换旧 `form-card` 外观。
- [ ] **Step 2:** 统一 input、textarea、picker、Logo 上传和结果选择样式。
- [ ] **Step 3:** 使用 `NeoButton` 承载主要命令并保持禁用/加载状态。
- [ ] **Step 4:** 运行 `bun run type-check` 验证组件契约。

### Task 3: 队员、出勤和弹层

**Files:**
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamMemberManager.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/MemberCandidateSearch.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamMemberSection.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/TeamActivityAttendancePanel.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/MemberEditPopup.vue`
- Modify: `registration_system_mini/src/pages/teams/manage/components/MemberAttendancePopup.vue`

**Interfaces:**
- Consumes: 既有成员/出勤 props/emits、Wot picker/popup、Neo 视觉组件
- Produces: 统一的成员管理列表、出勤视图和编辑/详情弹层

- [ ] **Step 1:** 重构候选搜索、角色设置和添加队员区域的视觉结构。
- [ ] **Step 2:** 将成员分组、头像、状态与操作按钮统一为硬边框彩色块。
- [ ] **Step 3:** 将活动出勤汇总和记录列表统一为 Neo 信息层级。
- [ ] **Step 4:** 覆盖编辑和出勤弹层的容器、字段、按钮与折叠区样式。
- [ ] **Step 5:** 运行 `bun run type-check` 验证组件契约。

### Task 4: 跨端构建与视觉验收

**Files:**
- Verify only: `registration_system_mini/`

**Interfaces:**
- Consumes: 完整球队管理工作台
- Produces: H5/微信小程序构建证据与手机/桌面截图

- [ ] **Step 1:** 运行 `bun run type-check`。
- [ ] **Step 2:** 运行 `bun run build:h5`。
- [ ] **Step 3:** 运行 `bun run build:mp-weixin`。
- [ ] **Step 4:** 在仓库根目录运行 `git diff --check`。
- [ ] **Step 5:** 在 H5 验证球队资料、队员管理、比赛出勤及两个弹层。
- [ ] **Step 6:** 在手机与桌面视口截图并与已接受的“我的/编辑资料”视觉基线对照。
