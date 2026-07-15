# Findings

- 当前实际依赖为 antd 5.29.3、React 19.2.7、`@ant-design/icons` 6.3.2。
- `@ant-design/pro-components` 2.8.10 的 peer dependencies 支持 antd `^5.11.2` 和 React `>=17`。
- 当前项目是 Vite + React Router + 手写 AppShell，没有使用 Ant Design Pro、Umi Max 或 ProComponents。
- `styles.css` 约 700 行并包含 16 处 `.ant-*` 选择器引用；改造优先使用全局 Token、组件 Token 和公开样式 API。
- 比赛列表使用后端分页；球队和管理员列表当前返回全量数据，不能统一伪装成服务端分页。
- 现有 E2E 已覆盖比赛管理、球队管理和缺少主队时快速创建流程，可作为行为回归门禁。
