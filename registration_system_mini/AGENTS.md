# registration_system_mini — AGENTS

## 项目定位

微信小程序/H5 端，承载普通用户的报名、球队、活动、账单与个人中心相关流程。当前技术栈为 `uni-app + Vue 3 + TypeScript + Vite`。

本目录是唯一的用户端小程序代码库。`mini-rust-backend-final` 标记最后一个对接 Rust 后端的基线；后续 Go 后端切换直接在本项目内完成，不再创建或恢复 `registration_system_mini_go/`。

## 常用命令

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
bun run build:mp-weixin
bun run dev:h5
bun run build:h5
bun run type-check
```

## 关键目录

```text
src/
  api/           # 按业务域封装接口
  components/    # 通用组件
  config/        # 环境配置
  pages/         # 小程序页面（activities、teams、billing、user 等）
  static/        # 静态资源
  types/         # 类型定义
  utils/         # 请求、缓存、工具方法
```

更详细的小程序结构、页面拆分模式和重构优先级见 [`docs/mini-architecture.md`](docs/mini-architecture.md)。

## 入口与配置

- 入口文件：`src/main.ts`
- 页面声明：`src/pages.json`
- 环境文件：`.env.development`、`.env.production`

## 协作约定

- 页面逻辑、接口封装、通用工具保持分层，不要把所有请求直接散落在页面里。
- **避免把小程序端写成管理后台式的大而全页面**；以最小页面改动完成需求。
- 修改大页面前，先按 [`docs/mini-architecture.md`](docs/mini-architecture.md) 判断是否应抽局部组件、`*Actions.ts` 或 `*State.ts`。
- 新增接口优先放入 `src/api/<domain>.ts`，并补充对应类型。
- 修改报名、球队、活动等核心流程时，确认字段与后端真实 JSON 一致。
- 切换 Go 接口时逐项核对路由、DTO、响应 envelope 和登录态，不要把 Rust 的 `{ success, message, data }` 假设带入 Go 的 `{ code, message, data }` 契约。
- 小程序环境差异较多，避免随意引入仅适用于 Web 的 API。
- 页面 SFC 默认只承担页面编排：生命周期、加载状态、页面级表单状态、导航和组件事件 wiring。
- 后端数据到页面展示模型的转换优先放在 `src/utils/viewModels.ts` 或页面局部 `*State.ts`，不要散落在模板里。
- 页面内 API 编排或提交动作较多时，优先抽到页面局部 `*Data.ts` / `*Actions.ts`，API 原子封装仍放在 `src/api/`。
- 页面专属组件放在 `src/pages/<domain>/components/`；只有稳定跨页面复用的组件才放进 `src/components/`。
- 非声明式页面或组件超过约 `600` 行要主动评估职责边界；超过约 `1000` 行应优先按“页面编排 / 局部组件 / actions / state”小步拆分。
- 拆组件时保持父页面拥有业务状态和异步流程，子组件通过明确 props/emits 接收数据和发出意图，避免子组件私自调用业务 API。
- 前端不要求每次按 TDD 开发；页面、样式、交互和小程序 UI 调整优先用类型检查、构建和模拟器/人工验证确认。
- 不要为了普通前端改动机械新增单元测试或静态断言；只有涉及路由、接口调用、数据提交、权限、关键组件接入、共享工具函数或业务状态变化时，才按风险补充必要测试。
- 前端纯视觉样式调整（颜色、边框、间距、宽度、字号、圆角、阴影等）不需要新增单元测试或静态断言；这类变更以截图/模拟器人工确认效果为准。

## 验证建议

- 提交前至少执行 `bun run type-check`
- 若涉及页面流程或路由，补跑 `bun run build:mp-weixin`
- 前端不按 TDD 方式开发；页面、样式、交互、小程序 UI 调整不要求先写测试，优先用类型检查、构建和模拟器/人工验证确认。仅在路由、接口、权限、数据提交、共享逻辑或关键业务状态变化时按风险补测试。

## 不要做的事

- 不要提交真实小程序密钥、AppSecret、生产域名配置。
- 不要在单次任务里顺手重写整套页面风格或路由结构。
