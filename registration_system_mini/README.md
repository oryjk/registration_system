# registration_system_mini

赛事报名与球队管理系统的小程序端，面向球员、队员和普通用户，当前采用 `uni-app + Vue 3 + TypeScript + Vite`。

## 当前状态

当前小程序已经从原型骨架推进到真实接口接入和页面结构收敛阶段，已经落下列页面结构：

- 首页
- 约队大厅
- 统计
- 我的
- 比赛详情
- 约队详情
- 比赛创建/编辑
- 球队创建、加入与成员管理
- 散人约队创建
- 我的比赛
- 账单明细
- 通知
- 资料完善

其中首页、约队、统计、我的四个主页面已经按当前产品方向组织信息层级；活动、约队、球队、账单、通知、微信登录/手机号、支付、运行配置等主要流程已通过 `src/api/` 接入后端。`src/mock/` 仅作为历史原型数据留存，当前页面未直接引用，不应作为新增功能的数据来源。

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
- 比赛创建/编辑：`pages/matches/create/index`
- 约队详情：`pages/challenges/detail`
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

当前约定中，`VITE_API_BASE_URL` 直接包含小程序接口前缀 `/api`。

例如：

- 开发环境默认值：`http://127.0.0.1:18080/api`
- 生产环境示例值：`https://example.com/api`

请求层位于 `src/utils/request.ts`，会直接拼接：

```text
${VITE_API_BASE_URL}${url}
```

因此这里不要再额外写 `/api/admin`，也不要把 `/api` 漏掉。

## 当前实现重点

- 已有统一请求层和登录态存储入口
- 已有“当前球队”全局上下文切换能力
- 首页、约队、统计、我的页面已按产品方案完成信息架构，并持续按大 SFC 拆分规范收敛
- 当前 `src/api/` 已覆盖活动、约队、球队、用户、账单、通知、系统配置、支付和微信能力
- 首页运行参数通过后端 `/api/system/mini-app-runtime-config` 下发，前端在 `src/config/runtimeConfig.ts` 中提供默认值和兜底逻辑
- 已拆分的重点页面包括 `home`、`activities`、`matches/detail`、`teams/manage`、`teams/index`、`user/index`、`user/matches`、`challenges/detail`
- `matches/detail` 已进一步按页面级组合逻辑和报名展示组件拆分，详情见 `docs/mini-architecture.md`

## 开发建议

- 提交前至少执行 `bun run type-check`
- 涉及路由或页面结构变动时，补跑 `bun run build:mp-weixin`
- 改字段时以 `registration_system_rs/` 后端 DTO 和实际 JSON 返回为准
- 前端页面、样式、交互和小程序 UI 调整不要求机械按 TDD 开发；涉及路由、接口、权限、数据提交或共享逻辑时再按风险补充测试

## 微信 CI 上传

本项目已经接入本机共享的微信小程序 CI CLI，可以直接在项目内执行：

```bash
bun run mp:preview
bun run mp:upload
```

首次使用前：

1. 复制 `.env.ci.local.example` 为 `.env.ci.local`
2. 填写真实私钥路径 `MINI_PROGRAM_PRIVATE_KEY_PATH`
3. 如需覆盖机器人编号，可修改 `MINI_PROGRAM_CI_ROBOT`

示例：

```bash
bun run mp:preview -- --robot 2 --desc "本地预览"
bun run mp:upload -- --robot 2 --version 1.0.1 --desc "提交体验版"
```

说明：

- 命令会先自动执行 `bun run build:mp-weixin`
- 然后调用微信官方 `miniprogram-ci`
- `preview` 默认在 `dist/build/mp-weixin/preview-qrcode.jpg` 输出预览二维码
- `upload` 如果不传 `--version`，会按当前版本自动 `+1`，例如 `1.0.30 -> 1.0.31`
