# registration_system_mini — AGENTS

## 项目定位

微信小程序/H5 端，承载普通用户的报名、球队、活动、账单与个人中心相关流程。当前技术栈为 `uni-app + Vue 3 + TypeScript + Vite`。

本目录是唯一的用户端小程序代码库。**当前对接 Go 新后端**（验收环境 `https://oryjk.cn:82/mini-v3/`）；`mini-rust-backend-final` 标记最后一个对接 Rust 后端的基线，Rust 后端已冻结不再更新，仅作只读参考。

注意：Go 后端尚未提供 notifications 模块，`src/stores/notificationCenter.ts` 里的 `NOTIFICATION_SYNC_ENABLED` 暂为 `false`（暂停未读数拉取）；Go 端实现接口后改回 `true` 恢复。

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

验收环境（oryjk.cn:82）的 H5 构建由仓库根目录的 `deploy_out109_go_h5.sh` 一键完成（读取本目录 `.env.test`），不需要手动执行 `build:h5:acceptance`。

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

## 跨端约束（H5 与小程序兼容）

本项目同时面向 H5 和微信小程序，日常开发以 H5 为主，但必须保证小程序可编译可运行。

- **统一使用 `uni.*` API**，不要直接调用 `wx.*`；`uni.*` 是 uni-app 的跨端封装，在 H5 和小程序里各有实现。
  - ✅ `uni.request`、`uni.getStorageSync`、`uni.navigateTo`、`uni.login`
  - ❌ `wx.request`、`wx.getStorageSync`、`wx.navigateTo`
- **禁止使用浏览器 DOM API**：不写 `document.*`、`window.*`、`localStorage`、`sessionStorage`、`querySelector` 等；存储统一用 `uni.getStorageSync` / `uni.setStorageSync`。
- **微信专属能力必须平台隔离**：`open-type="chooseAvatar"`、`open-type="getPhoneNumber"`、`wx.requestPayment` 等仅小程序可用，必须用条件编译 `<!-- #ifdef MP-WEIXIN -->` / `<!-- #ifndef MP-WEIXIN -->` 隔离，并提供 H5 降级路径或合理跳过。
- **CSS 避免小程序不友好的特性**：不用 `:hover` 伪类（用 `hover-class` 替代）；`position: fixed` 注意小程序导航栏差异；百分比高度需确保父容器有明确高度；统一使用 `rpx` 单位，不要混用 `px`、`vw`、`rem`。
- **新增页面或功能后**，定期执行 `bun run build:mp-weixin` 确认小程序可编译，避免 H5 运行正常但小程序编译失败的问题积累。

## 验证建议

- 提交前至少执行 `bun run type-check`
- 若涉及页面流程或路由，补跑 `bun run build:mp-weixin`
- 前端不按 TDD 方式开发；页面、样式、交互、小程序 UI 调整不要求先写测试，优先用类型检查、构建和模拟器/人工验证确认。仅在路由、接口、权限、数据提交、共享逻辑或关键业务状态变化时按风险补测试。

## 不要做的事

- 不要提交真实小程序密钥、AppSecret、生产域名配置。
- 不要在单次任务里顺手重写整套页面风格或路由结构。

<!-- open-wot agent instructions start -->
## Wot UI Agent Instructions

Before generating or modifying wot-ui component code, read the project Skill at `.agents/skills/wot-ui-v2/SKILL.md` and query the configured `wot-ui` MCP server for version-accurate APIs and examples.

<!-- open-wot agent instructions end -->
