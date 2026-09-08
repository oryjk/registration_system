# registration_system_mini

赛事报名与球队管理系统的小程序/H5 端，面向球员、队员和普通用户，当前采用 `uni-app + Vue 3 + TypeScript + Vite`。这是工作区唯一的用户端小程序代码库，不再维护平行的 `registration_system_mini_go/`。

## 后端迁移基线

`mini-rust-backend-final` 标记本项目最后一个完整对接 Rust 后端的基线。该 tag 之后已在本目录内完成向 `registration_system_go/` 的切换，以 Go 路由和 DTO 的实际代码为准；旧 Rust 后端代码目录已从工作区删除（git 历史可查）。

## 当前状态

当前小程序已经从原型骨架推进到真实接口接入和页面结构收敛阶段，已经落下列页面结构：

- 首页
- 约队大厅
- 统计
- 我的
- 比赛详情
- 比赛创建、详情页内编辑
- 球队创建、加入与成员管理
- 散人约队创建
- 我的比赛
- 账单明细
- 通知
- 资料完善

其中首页、约队、统计、我的四个主页面已经按当前产品方向组织信息层级；比赛/约球、球队、账单、通知、微信登录、用户资料、支付与运行配置等主流程已通过 `src/api/` 接入 Go 后端。已删除旧 `activity`/`challenge` API 和旧约队详情；比赛只使用 Go `/matches`，新增调用以 Go 路由为准。`src/mock/` 仅作为历史原型数据留存，当前页面未直接引用，不应作为新增功能的数据来源。

## 产品方案

当前产品方案记录位于：

- `docs/plans/2026-04-15-mini-product-design.md`

该方案与当前页面结构的主方向一致，但它仍是产品规划文档，不代表每个指标和细节都已完整落地。核心方向是：

- 首页优先承载“待处理比赛中心”
- 约队走轻量撮合闭环
- 统计页按“个人优先”设计
- 用户可在“我的”页面切换当前球队，全局刷新首页、约队、统计等内容

## 页面与路由

页面声明位于 `src/pages.json`。

当前底部 tab 为 4 个：

- 首页
- 约队
- 统计
- 我的

非 tab 页面包括：

- 比赛详情：`pages/matches/detail`
- 比赛创建：`pages/matches/create/index`；比赛编辑使用详情页现有功能
- 散人约队创建：`pages/challenges/create-individual/index`
- 球队管理：`pages/teams/manage/index`
- 我的比赛：`pages/user/matches/index`
- 账单明细：`pages/billing/index`
- 通知：`pages/notifications/index`
- 资料完善：`pages/profile/setup/index`

## 目录结构

```text
src/
  api/           # 小程序接口封装
  components/    # 通用组件
  config/        # 环境与接口地址配置
  mock/          # 历史原型数据，新功能不要继续依赖
  pages/         # 页面
  stores/        # 全局状态，如当前球队上下文
  types/         # 类型定义
  utils/         # 请求、登录态存储、工具函数
```

页面局部组件、`*Actions.ts` / `*State.ts` 等拆分约定见 `docs/mini-architecture.md`。

## 本地开发

```bash
cd registration_system_mini
bun install
bun run dev:mp-weixin
```

微信开发者工具导入目录：

- `registration_system_mini/dist/dev/mp-weixin`

如需 H5 调试，也可执行：

```bash
bun run dev:h5
```

## 环境变量与接口地址

环境文件：

- `.env.development`
- `.env.production`

当前约定中，`VITE_API_BASE_URL` 必须包含完整的用户端接口前缀 `/api/v1/app`。

例如：

- 开发环境默认值：`http://127.0.0.1:18080/api/v1/app`
- 生产环境示例值：`https://example.com/api/v1/app`

请求层位于 `src/utils/request.ts`，会直接拼接：

```text
${VITE_API_BASE_URL}${url}
```

请求路径使用 `/matches` 等相对领域路径，不重复添加 `/api`，也不使用管理端 `/api/v1/admin`。统一响应为 `{ code, message, data }`，成功判定 `code === 0`。

## 当前实现重点

- 已有统一请求层和登录态存储入口
- 已有“当前球队”全局上下文切换能力
- 首页、约队、统计、我的页面已按产品方案完成信息架构，并持续按大 SFC 拆分规范收敛
- 当前主链路 API 覆盖比赛/球队申请、球队、用户、钱包/队费、通知/留言、系统配置和支付；旧约队/活动通知仅展示内容，不再生成失效的页面跳转
- 首页运行参数通过后端 `/api/v1/app/system/mini-app-runtime-config` 下发，前端在 `src/config/runtimeConfig.ts` 中提供默认值和兜底逻辑
- 已拆分的重点页面包括 `home`、`activities`、`matches/detail`、`teams/manage`、`teams/index`、`user/index`、`user/matches`
- `matches/detail` 已进一步按页面级组合逻辑和报名展示组件拆分，详情见 `docs/mini-architecture.md`

## 开发建议

- 提交前至少执行 `bun run type-check`
- 涉及路由或页面结构变动时，补跑 `bun run build:mp-weixin`
- 改字段时以后端 Go 的 DTO 和实际 JSON 返回为准，检查 `registration_system_go/`；旧 Rust 后端代码目录已删除，需要核对历史契约时从 git 历史找回
- 前端页面、样式、交互和小程序 UI 调整不要求机械按 TDD 开发；涉及路由、接口、权限、数据提交或共享逻辑时再按风险补充测试

## 微信 CI 上传

使用仓库内 `scripts/mini-ci.mjs`，完整流程见 `AGENTS.md` 的「微信小程序发布」：

```bash
bun run mp:preview -- --desc "预览说明"
bun run mp:release -- --desc "开发版说明"           # robot=1 日常开发版
bun run mp:release -- --robot 2 --desc "体验版说明" # robot=2 体验版专用线
```

前置条件为上传私钥 `private.<appid>.key`（可用 `MINI_CI_PRIVATE_KEY_PATH` 覆盖）及 `.env.ci.local` 的 `MINI_REVIEW_API_KEY`，均不提交。`mp:release` 会构建、向 Go mini-review 登记版本并上传开发版本；正式发布仍需公众平台提审与发布。`mp:preview` 上传已有构建产物。

只验证编译时使用 `MINI_REVIEW_SKIP=1 bun run build:mp-weixin`，跳过远程版本登记，不上传。正常发布的版本号由数据库分配，不能用离线跳过命令替代发布流程。
