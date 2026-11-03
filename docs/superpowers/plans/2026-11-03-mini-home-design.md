# 微信首页设计稿还原 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. 用户已批准设计图并要求直接实施，不再追加设计审批。

**Goal:** 按用户确认的首页效果图重排微信首页、替换点阵箭头和底栏图标，H5 界面和行为不变。

**Architecture:** 继续使用现有首页编排、比赛 ViewModel、原生 swiper、报名摘要和图片缓存。微信模板和样式采用 MP-WEIXIN 条件编译；共享组件使用默认关闭的首页展示选项，避免扩散到详情与其他页面。

**Tech Stack:** uni-app、Vue 3、TypeScript、原生 image、Lucide SVG/PNG、MinIO。

**Spec:** 用户确认的 `docs/design-assets/mini-home/v2/approved-home.png` 与 `registration_system_mini/docs/mini-design-system.md`。

## Global Constraints

- H5 保持不变；对比修改前后 H5 编译 JS/CSS 内容。
- 不更改请求、报名、支付、球队切换、审核入口、新手引导或比赛轮播规则。
- 真实封面、姓名、皇冠、人数、费用、状态与日期沿用业务数据；设计图示例不写死。
- 结构颜色、间距和字号消费 token；图片不打进小程序主包，细线图标保留 SVG 源及小尺寸 PNG。
- 纯视觉改动不新增静态断言测试，使用已有相关测试、类型检查、双端构建和截图校验。

## Review Focus

- 长标题、场地与费用说明自然换行，不与报名中徽章及按钮重叠。
- 头像展开、皇冠留白、横滑、点击预览继续工作，swiper 随真实高度变化。
- 无图、无人数上限、未成行、待支付和详情加载失败仍保留真实状态。
- 只有首页使用新列表分组和底栏皮肤，其他页面保持现有样式。
- 窄屏与底部安全区保留热区和足够滚动空间。

### Task 1: 首页图标与视觉素材

- [x] 保存已批准设计图，添加日历、细线导航及状态/底栏图标的 SVG 和 PNG。
- [x] 制作设计稿同风格的简洁球场插画，压缩并上传新增 MinIO 对象，校验公开读取。
- [x] 新增首页局部 token 与样式，H5 编译不包含新视觉。

### Task 2: 首页展示组件

- [x] HomeActionMatchCard：微信封面标题/日期、右上状态、信息行图标、纯文字 CTA；H5 原样。
- [x] RegistrationProgressSummary / ExpandableAvatarStack：首页独立展示选项，保留全量头像与展开行为，向下箭头、报名徽章和进度留白。
- [x] HomeMatchList / HomeMatchCard：首页独立 grouped 选项，单卡三行、日历与地点图标、细分隔线；其他使用方不变。
- [x] HomeSectionHeader / HomeTeamSwitcher / HomeActionMatchCarousel：细线箭头与标题留白。
- [x] HomeVenueMapEntry / BottomTabBar：首页插画浅薄荷底、细线底栏与纯色加号，保留入口与未读角标。

### Task 3: 验证与交付

- [x] 运行 `bun run type-check`、相关现有测试、`MINI_REVIEW_SKIP=1 bun run build:mp-weixin` 与 `bun run build:h5`。
- [x] 对比 H5 修改前后编译结果，截图检查标准与窄屏、长内容及展开状态，记录真实验收限制。
- [x] 同步设计系统、FEATURES.md、CHANGELOG.md；检查 diff 后提交，合并 main，同步并推送 origin/main。
- [x] 生成项目 overview，最终报告验证结果与真机验收范围。

## 执行记录

- 基线：`df01197`，工作区干净；已快进同步 origin/main 并建立 `codex/mini-home-design` 分支。
- 基线验证：类型检查、H5 正式构建通过。
- Ruling: 沿用已干净的当前目录及独立分支，不为本次视觉修改额外创建工作树；用户已授权实施和默认合并推送。
- Task 1–2: complete。两张 WebP 共 81,028 字节，10 个 PNG 共 15,256 字节；新增 MinIO 对象均校验 HTTP 200、类型、缓存与 SHA256。
- Task 3 验证：类型检查、143 项相关测试、双端正式构建、微信 27 页面/3 分包与组件注册检查通过；H5 24 个 CSS 分块归一化编译哈希后完全一致。
- 六组浏览器组件检查通过：393px 标准、320px 长文案/24 人、320px 未确认报名、375px 待成行、430px 人数不限、375px 待支付。覆盖头像展开收起与预览事件、比赛和地图导航；未发现页面横向溢出和文案/按钮重叠。
- 独立只读审查无重要或阻断发现。浏览器排版预览不能代替微信原生宿主/真机验收；当前环境没有微信开发者工具，此项留给实际微信端验收。
