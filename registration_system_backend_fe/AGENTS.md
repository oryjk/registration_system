# registration_system_backend_fe — AGENTS

## 项目定位

赛事报名与球队管理系统的管理后台，服务管理员/运营角色。主要覆盖活动、球队、球员、账单、管理员等管理能力。

## 技术栈

- Vue 3 + TypeScript
- Vue Router
- Pinia
- Vite 8
- Tailwind CSS 4 + DaisyUI 5
- Axios
- Vitest + Playwright

## 目录结构

```text
src/
  components/     # 通用组件与布局
  router/         # 路由定义
  services/       # 接口封装
  stores/         # Pinia 状态
  utils/          # 请求封装与工具
  views/          # 页面（activities、admins、billing、players、teams 等）
  __tests__/      # 单测
```

## 常用命令

```bash
cd registration_system_backend_fe
bun install
bun run dev
bun run type-check
bun run lint
bun run build
bun run test:unit
bun run test:e2e
```

## 入口与配置

- 入口文件：`src/main.ts`
- 路由入口：`src/router/index.ts`
- HTTP 封装：`src/utils/request.ts`
- 构建配置：`vite.config.ts`
- 环境变量：`.env`，重点关注 `VITE_API_BASE_URL`

## 协作约定

- 新增页面时，优先同步路由、服务层和必要类型，不要把请求直接写进复杂组件树里。
- 与后端联调时，以 `src/services/` 作为字段与返回结构的唯一前端落点。
- 维持现有 `Tailwind + DaisyUI` 风格，不在单次任务中无关重做视觉体系。
- 列表页优先消费后端分页结构，避免默认全量拉取后再前端过滤。
- **不要只改页面展示而忽略类型、请求层与错误处理**——三者要一并更新。

## 推荐工作顺序

1. 先确认改动位于 `views`、`services`、`stores`、`router` 还是 `utils/request.ts`。
2. 若涉及接口变化，先核对后端，再更新 `services`。
3. 最后回到具体页面或状态管理层收口。

## 联动后端

- 后端目录：`../registration_system_rs/`
- 若接口字段变动，同时检查相关 `views/`、`stores/`、`services/`

## 验证建议

- 默认执行 `bun run type-check`
- 涉及通用请求封装、路由、表单或页面行为时，补跑 `bun run lint`
- 构建或联调前执行 `bun run build`
- 前端不要求每次按 TDD 开发；普通页面、样式和交互调整优先用类型检查、构建和人工/截图验证确认。
- 不要为了普通前端改动机械新增单元测试或静态断言；只有涉及路由、接口调用、权限、表单提交、共享工具函数或关键业务状态变化时，才按风险补充必要测试。
- 前端纯视觉调整（颜色、边框、间距、宽度、字号、圆角、阴影、对齐、遮挡修复等）不要求新增单元测试或静态断言，默认以类型检查、构建和人工/截图验证为准。
