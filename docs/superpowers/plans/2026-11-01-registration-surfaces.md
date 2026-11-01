# 报名页表面层次 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this small scoped visual task.

**Goal:** 按用户确认的浅底与柔和阴影方案恢复微信报名页卡片边界。

**Architecture:** AppSurface 读取内容区可选圆角/阴影 token；仅报名页 shell 提供覆盖，其他页面和浮层不变。新增页面底色语义 token 覆盖五主题，复用已有尺寸和阴影。

**Tech Stack:** Vue 3 / uni-app / CSS variables。

**Spec:** docs/superpowers/specs/2026-11-01-registration-surfaces-design.md

- [x] 增加主题页面底色 token 与 AppSurface 内容表面覆盖契约；报名页接入，并使无名单的队长入口使用同样表面。
- [x] 类型检查、微信构建、320/375px 与五主题实际组件预览，检查长名称、名单/散人、待支付与位置入口；不为纯视觉调整新增单元测试。
- [x] 更新设计规范、FEATURES 和 CHANGELOG，合并并推送 main；不上传微信或部署。

## 验证

- `bun run type-check` 与 `MINI_REVIEW_SKIP=1 bun run build:mp-weixin` 通过，组件注册、26 路由、3 分包及 API 校验通过。
- 主题/页面主题作用域/详情行动规则现有测试 25 项通过。纯视觉调整未新增单元测试。
- 实际 Vue 组件浏览器预览覆盖五主题 × 球队/散人 × 320/375px，无水平溢出；检查局部卡片与外部默认表面、内嵌/独立队长，以及位置/报名/支付入口事件。微信产物包含 true/false 的 scoped slot 数据；原生支付与微信真机显示待验收。
- 独立只读审查未发现确认的 P1/P2 问题。
