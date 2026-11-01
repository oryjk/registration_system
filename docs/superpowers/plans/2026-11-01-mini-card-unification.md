# 小程序卡片统一 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; independent page domains use superpowers:dispatching-parallel-agents after the shared contract is established.

**Goal:** 将用户验收的报名页浅底、圆角与柔和阴影统一到其余微信页面。

**Architecture:** 根执行者拥有 shared card token、AppSurface、card/list/page 样式与全部页面背景接入，以及首页。三个独立域负责 native 外层容器与列表接入，不改共享代码和业务脚本。默认卡面与内层平面 token 分开，避免阴影嵌套。

**Tech Stack:** uni-app / Vue 3 / TypeScript / CSS variables / Bun。

**Spec:** docs/superpowers/specs/2026-11-01-mini-card-unification-design.md

## Global constraints

只改 MP-WEIXIN 展示；H5 原样。组件使用原生 wrapper 或自身契约控制，不跨样式隔离；不改 API、权限、状态、支付、分享、导航、海报画布和原生地图。数据/业务色不机械替换。

- [x] 共享卡面/page/list 契约与所有本地页面背景，首页卡片及报名页重复覆盖收口。
- [x] 球队与统计、个人服务、比赛/大厅等三个模块接入原生外层卡面；内部保持平面。
- [x] 类型检查、微信构建/组件/分包/API 验证，现有测试与薄荷蓝/窄屏代表性组件预览，独立审查。
- [x] 固定微信薄荷蓝，排除主题存储/picker/setter，验证实际编译产物并保留 H5 主题行为。
- [x] 更新现行规范、FEATURES/CHANGELOG，合并推送 main 并核对工作区及远端。

## 验证记录

- `bun run type-check` 通过；`MINI_REVIEW_SKIP=1 bun run build:mp-weixin` 通过，组件注册/26 路由/3 分包及 API 校验通过。
- 105 个现有及主题回归测试文件按文件隔离执行，715 项通过，避免仓库既有全局 mock 串扰。新主题测试先在旧产物观察到 2 项失败，再在新 MP 产物通过；H5 原主题 store/存储测试保持通过。
- 53 个变更 SFC 解析通过，官方 H5 条件编译后的 CSS AST 语义一致。所有新增 UI token 引用都有定义；新增数字尺寸仅来自旧 H5 声明重排，无新增微信硬编码尺度。
- 实际 Vue 组件预览覆盖首页/个人中心/加入/统计/大厅/创建/消息，320/375px 与长文案无水平溢出；加入密码、编辑、账单、日历弹层和消息点击通过。早期五主题样式检查通过，最终微信仅薄荷蓝。
- 独立审查卡面和新增主题限制均无确认的重要问题；未进行微信真机、原生支付及服务部署/上传。
