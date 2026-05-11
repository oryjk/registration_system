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

## 通用约定

- 与用户沟通优先使用**简体中文**。
- 不要臆造接口、字段、表结构；以代码、路由、DTO、SQL 迁移为准。
- 后端遵循**六边形 / 整洁分层**：`domain` / `application` / `ports` / `adapters`。
- 管理端接口通常在 `/api/admin` 前缀下，常见响应为 `ApiResponse<T>`。
- 小步修改，优先做**可验证**且范围清晰的变更，避免无关重构。

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
- TDD 规则：后端业务逻辑、仓储、路由等行为变更需要优先考虑 TDD 或补充后端测试；前端不要求每次按 TDD 开发，页面、样式、交互和小程序 UI 变更通常以类型检查、构建和人工/模拟器验证为主。
- 前端测试策略：不要为了普通前端改动机械新增单元测试或静态断言；只有涉及路由、接口调用、权限、数据提交、共享工具函数或关键业务状态变化时，才按风险补充必要测试。
- 前端纯视觉调整（颜色、边框、间距、宽度、字号、圆角、阴影、对齐、遮挡修复等）不要求新增单元测试或静态断言，默认以类型检查、构建和人工/截图验证为准。

## 不要做的事

- 未经用户明确要求，不要大范围重构或随意调整目录结构。
- 不要编写会直接破坏生产数据的迁移、脚本或清库逻辑。
- 不要在回复或文档里暴露真实密钥、连接串、Token；只使用占位符。
- 仓库内未发现 `RTK.md`，不要继续引用一个不存在的文件作为前置依赖。
