# 微信页面视觉统一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Independent page domains may use superpowers:dispatching-parallel-agents after the shared contract is defined.

**Goal:** 全部微信页面统一首页轻量视觉，集中 token 和复用组件。

**Architecture:** 根执行者拥有共享 token、UI 基础组件和首页 token 收口；三个独立模块负责球队/统计、用户服务、约队/比赛/球场。仅改展示层和条件 CSS，不改业务脚本。各模块通过已有 AppSurface/SectionHeader/AppButton、共享 list-surfaces.css 和 AppPageIntro 使用同一套契约。

**Tech Stack:** uni-app、Vue 3、TypeScript、CSS variables、Bun。

**Spec:** docs/superpowers/specs/2026-11-01-mini-ui-unification.md

## Global Constraints

- 仅改变微信端；新样式限定 MP-WEIXIN，H5 原有样式及行为保留。
- 复用组件，新增结构颜色、间距、字号、圆角和尺寸均引用共享 token；不机械替换业务球衣色、主题色卡或海报画布设计值。
- 不改 API、业务状态、权限、输入绑定、导航事件、原生地图和海报导出。
- 所有布局由本组件原生 wrapper 或显式组件契约控制；共享组件放主包，普通分包之间不互相导入。

## Review Focus

- 去边框后仍能区分表单、选择项、危险动作和空态。
- 320px 下的长名称/地点/金额/比分与按钮没有溢出或遮挡。
- 审核态、身份切换、未读状态、主次操作、支付及图片回退不被展示修改影响。
- 五套主题切换后浅底、文字、语义色和图片白字保持可读。
- 小程序宿主节点、scoped 隔离、组件注册和跨分包依赖有效。

### Task 1: 共享视觉契约

- [x] 在 design-tokens.css 增加共享 spacing/type/size 与 panel/list/input/intro token；原 token 不删除。
- [x] AppSurface、SectionHeader、AppButton、form-controls.css 增加微信专用轻量样式，输入边界及弹窗浮层独立保留。
- [x] 新建 AppPageIntro.vue 与 list-surfaces.css，供各模块复用；首页新样式也收口到同一 token。

### Task 2: 各页面模块统一

- [x] 球队与统计：原生 wrapper/既有组件复用，去重复框，日历和列表轻量化，创建/加入复用 AppPageIntro。
- [x] 用户服务：个人中心、账单、消息、资料、帮助、设置与荣誉外围统一分区/列表，保留业务色与海报内部。
- [x] 约队与比赛：大厅列表、详情分区、发布表单、接约与球场入口统一，输入/选中/报名状态保持清晰。

### Task 3: 集成验证与交付

- [x] 运行 type-check、现有前端完整测试、MINI_REVIEW_SKIP=1 微信构建与组件/分包/API 校验；定位并修复本次引入的问题。
- [x] 代表性组件在 320/375px、长文案、输入/审核态与五主题下预览；静态检查新增微信样式引用有效 token。
- [x] 独立审查共享组件和关键状态接入，更新设计规范、FEATURES、CHANGELOG。
- [x] 提交后合并到 main、普通 push origin/main，核对远端提交；不自动上传微信开发版。

## 验证记录

- 类型检查、微信生产构建及组件注册/26 路由/3 分包/API 校验通过。
- 现有测试按文件隔离执行：104 个文件、713 项通过。直接全量 Bun 运行在原基线同样存在全局 mock 串扰；隔离执行避免模块污染。另修正原有 detailData 测试中过时的完整头像对象断言，保留本组球员与球队归属验证。
- 实际 Vue 组件在浏览器中预览 320/375px、长文案、五套主题和审核态；编辑、钱包、加入、日历弹层与消息点击事件通过。此预览不替代微信真机/原生支付验收。
- 独立审查未发现确认的 P1/P2 回归；发现的图标尺寸偏差已修复。H5 编译产物不含新增微信列表样式。
