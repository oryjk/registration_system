# Home Onboarding Tour Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User has authorized implementation of the recommended design; execute in the current session.

**Goal:** 首次进入首页自动介绍创建、加入和找球踢三个入口，并支持关闭及从帮助重播。

**Architecture:** 独立 composable 管理首次触发/完成/重播状态；独立展示组件承载统一入口和 Wot Tour，首页编排加载与可见性，帮助发出重播请求。

**Tech Stack:** Vue 3、TypeScript、uni-app、Wot UI 2.3.0、Bun。

**Spec:** docs/superpowers/specs/2026-11-01-home-onboarding-tour-design.md

## Global Constraints

- 不新增依赖或修改后端。运行时 Vue 组件直接从 .vue 导入。
- 使用 uni API，主题使用现行 token；Root Portal 显式传入主题。
- 不改变原首页身份偏好与业务导航；审核态不展示创建球队。

## Review Focus

- 加载失败或后台缓存首页不能出现遮罩（状态测试）。
- 关闭/完成与切号分别记忆，不能污染其他账号（状态测试）。
- 分享 scene 跳转不触发自动引导，但帮助重播可用（状态测试）。
- 审核态运行时更新不能残留无权入口或越界索引（浏览器/构建检查）。
- scroll-view 内目标测量、较小屏幕和 Root Portal 主题（浏览器交互/截图与微信构建）。

### Task 1: 首次状态与重播

**Files:** 新增 src/utils/onboardingTourStorage.ts、src/pages/home/useHomeOnboardingTour.ts、src/pages/home/__tests__/useHomeOnboardingTour.test.ts（均位于 registration_system_mini）。

**Interfaces:** useHomeOnboardingTour({ userId, ready, pageVisible, skipAutomatic, errorMessage }) 返回 active、requestReplay、finish、stop、dispose；storage 提供已读记忆及一次性帮助重播请求。

- [x] 为首次/关闭后不重复/账号隔离/隐藏停止/分享避让/加载后重播添加行为测试，先观察失败。
- [x] 实现按账号/游客隔离的本机完成记录及状态 composable，观察测试通过。

### Task 2: 漫游展示与接入

**Files:** 新增 src/pages/home/components/HomeOnboardingTour.vue；修改 src/pages/home/components/HomeEmptyHero.vue、src/pages/home/index.vue、src/pages/user/help/index.vue。

**Interfaces:** HomeOnboardingTour 接收 creationAllowed、themeStyle、scope，发出 finish、error；HomeEmptyHero 通过 compact 提供稳定的统一入口，通过 getQueryScope 暴露节点测量作用域。首页将正常内容与漫游卡按状态切换；帮助调用 requestHomeOnboardingTour 后 switchTab 到首页。

- [x] 用现有 Wot Tour + Root Portal 渲染入口和说明、圆点/前后/跳过/关闭，遵循审核态过滤。
- [x] 首页连接加载、显隐、scene 避让与漫游状态，等待回顶完成再显示遮罩。
- [x] 帮助增加重播入口，复用原业务路径。
- [x] 执行相关行为测试、类型检查、微信构建、H5 构建及浏览器验证。

### Task 3: 交付与项目记忆

**Files:** FEATURES.md、CHANGELOG.md、上述设计/计划。

- [x] 更新当前能力与带原因的变更记录，复核 diff、测试证据与未验证项。

## 验证与审查记录

- 相关回归：`bun test src/pages/home src/pages/__tests__/homePageLoading.test.ts src/utils/__tests__/onboardingGuideStorage.test.ts`，119 项通过。
- `bun run type-check`、`bun run build:h5`、`MINI_REVIEW_SKIP=1 bun run build:mp-weixin` 通过。微信构建的组件注册、26 个页面及 3 个分包检查通过，未登记/上传新版本。
- Playwright：390×844、375×667、320×568 下各步高亮、面板边界、前后切换、完成记忆、关闭与帮助重播通过；审核态两步过滤和深色主题通过，无页面运行时异常。
- 独立审查发现缓存首页刷新失败时仍可能重播；新增回归先观察失败，再通过 errorMessage 阻止启动。修复后相关测试通过。
- 全量源测试逐文件隔离：639 项通过，1 项原有失败，位于 `src/pages/matches/__tests__/detailData.test.ts` 的 `team progress keeps avatars within each group and uses live selected avatars`，预期头像模型缺少新增球队/星数字段；在基线 af1b93d 的临时源码副本中同样失败。与本次引导无关，保留原状。
- 全量单进程测试还存在已有 request 模块 mock 相互覆盖的导出错误；相关行为测试采用独立进程交叉验证。
- 未验证：微信开发者工具/真机运行（当前仅有浏览器和微信编译环境）；未发布到微信。
