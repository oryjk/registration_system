# 工作区说明（给 AI / Agent）

本仓库是一个**赛事报名与球队管理**工作区，当前包含三个彼此协作的子项目：

| 目录 | 说明 | 技术栈 |
| --- | --- | --- |
| `registration_system_mini/` | 微信小程序端，面向球员/队员/普通用户 | `uni-app + Vue 3 + TypeScript + Vite` |
| `registration_system_backend_fe/` | 管理后台，面向运营/管理员 | `Vue 3 + TypeScript + Vite + Tailwind 4 + DaisyUI 5` |
| `registration_system_rs/` | 后台服务端，提供管理端与业务 API | `Rust + Axum + PostgreSQL + sqlx` |

## 文档规范

- 工作区与子项目协作文档统一使用大写命名：`AGENTS.md`、`CLAUDE.md`。
- 修改任一子项目前，先阅读：
  1. 当前目录的 `AGENTS.md`
  2. 当前目录的 `CLAUDE.md`
  3. 目标子项目目录下的 `AGENTS.md`
  4. 目标子项目目录下的 `CLAUDE.md`
- 复杂任务默认采用 `planning-with-files` 工作方式，持续维护以下三份工作文档：
  - `task_plan.md`：记录目标、阶段、状态和下一步。
  - `findings.md`：记录关键发现、约束、决策和风险。
  - `progress.md`：记录执行日志、已完成项和验证结果。
- 若任务主要发生在某个子项目内，也要同步维护该子项目目录下对应的：
  - `<subproject>/task_plan.md`
  - `<subproject>/findings.md`
  - `<subproject>/progress.md`
- 对代码、迁移、接口、页面或文档做了实质改动后，最终回复前必须检查这些工作文档是否已同步到当前进度。

## 通用约定

- 与用户沟通优先使用**简体中文**。
- 不要臆造接口、字段、表结构；以代码、路由、DTO、SQL 迁移为准。
- 后端遵循**六边形 / 整洁分层**：`domain` / `application` / `ports` / `adapters`。
- 管理端接口通常在 `/api/admin` 前缀下，常见响应为 `ApiResponse<T>`。
- 小步修改，优先做**可验证**且范围清晰的变更，避免无关重构。

## AI 编程与代码可维护性

- 代码整洁度、模块边界和文件规模会直接影响后续 AI/Agent 修改质量；现有代码会被 AI 当作模式学习和上下文依据。
- 不要因为“AI 能写代码”而放松工程约束；长期维护的真实系统要优先保持职责清晰、命名一致、接口可信、验证可执行。
- 避免在同一个大文件里继续堆叠状态、接口调用、权限判断、表单校验、业务规则和响应组装。
- 不是按行数机械拆文件，但非声明式文件超过约 `600` 行要警惕，超过约 `1000` 行应优先评估是否拆分；`2000` 行以上通常对 AI 长期维护不友好。
- 非声明式文件通常指包含业务流程、状态变化、条件分支、接口调用或副作用的页面、service、handler、repository 等文件。
- 配置、路由表、类型定义、静态映射等声明式大文件可以接受，但必须保持分区清晰、命名稳定、修改点容易定位。
- 拆分优先按职责和变化原因，而不是为了缩短文件：常一起改的代码可以放一起，不常一起改的代码应拆开。
- 优先形成“小而高内聚”的文件：每个文件有清楚职责和可预测修改点；不要为了行数过度拆分，也不要在大文件里混放多个变化原因。
- 前端页面优先保持为展示与交互编排层；可复用状态、接口适配、表单规则、业务判断应视情况抽到 composable、service、utils、子组件或类型文件。
- 后端 handler 只做协议适配、鉴权入口、DTO 转换和响应组装；业务规则放在 `domain` / `application`，持久化细节放在 `adapters`。
- 修改大文件时采用“顺手小步拆分”：只抽离当前任务相关且边界清楚的一小块，避免借机大范围重构。
- 新增代码前先搜索是否已有同类函数、DTO、组件或 use case，避免 AI 生成重复实现。

## 子项目入口

- 小程序入口：`registration_system_mini/src/main.ts`、`src/pages.json`
- 管理端入口：`registration_system_backend_fe/src/main.ts`、`src/router/index.ts`
- 后端入口：`registration_system_rs/src/main.rs`、`src/lib.rs`、`src/bootstrap/`

## 联动规则

- 改后端接口时，同时检查：
  - `registration_system_backend_fe/src/services/`
  - `registration_system_mini/src/api/`
- 改管理端或小程序页面时，确认接口字段与后端 DTO / JSON 实际返回一致。
- 涉及认证、活动、球队、球员、账单等核心领域时，优先沿用既有命名与模块边界，不要把业务规则塞进页面层或 handler。

## 质量要求

- 后端提交前建议执行：`cargo clippy`、`cargo test`
- 管理端提交前建议执行：`bun run type-check`、`bun run lint`、必要时 `bun run build`
- 小程序提交前建议执行：`bun run type-check`、必要时 `bun run build:mp-weixin`
- 如因环境、依赖、耗时或任务范围原因未运行相关验证命令，必须在最终回复中说明未验证项和原因。
- TDD 规则：后端业务逻辑、仓储、路由等行为变更需要优先考虑 TDD 或补充后端测试；前端不要求每次按 TDD 开发，页面、样式、交互和小程序 UI 变更通常以类型检查、构建和人工/模拟器验证为主。
- 前端测试策略：不要为了普通前端改动机械新增单元测试或静态断言；只有涉及路由、接口调用、权限、数据提交、共享工具函数或关键业务状态变化时，才按风险补充必要测试。
- 前端纯视觉调整（颜色、边框、间距、宽度、字号、圆角、阴影、对齐、遮挡修复等）不要求新增单元测试或静态断言，默认以类型检查、构建和人工/截图验证为准。

## 不要做的事

- 未经用户明确要求，不要大范围重构或随意调整目录结构。
- 不要编写会直接破坏生产数据的迁移、脚本或清库逻辑。
- 不要在回复或文档里暴露真实密钥、连接串、Token；只使用占位符。
- 仓库内未发现 `RTK.md`，不要继续引用一个不存在的文件作为前置依赖。
