# Claude — 小程序子项目指南

你当前在 `registration_system_mini/` 中工作。

## 必读

- 同目录 [`AGENTS.md`](/Users/carlwang/registration_system/registration_system_mini/AGENTS.md)
- 小程序结构与拆分规范：[`docs/mini-architecture.md`](/Users/carlwang/registration_system/registration_system_mini/docs/mini-architecture.md)

## 工作方式

1. 先确认改动落在 `pages`、`api`、`types` 还是 `utils`
2. 涉及后端字段时，回查后端或已有接口封装，不要猜测
3. 以最小页面改动完成需求，避免把小程序端写成管理后台式的大而全页面
4. 修改大页面前，先按 `docs/mini-architecture.md` 判断是否应抽局部组件、`*Actions.ts` 或 `*State.ts`

## 特别注意

- 小程序端优先保证运行稳定、交互清晰、构建通过。
- 若同时改管理端或后端，要说明三者之间的数据依赖关系。
- 对用户输出使用简体中文。
