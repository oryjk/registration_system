# 小程序代码质量体检发现

## Requirements
- 评估 `registration_system_mini/` 当前代码的健壮性、可维护性、整洁性。
- 本轮先不修改代码。
- 小程序样式布局不需要按 TDD 开发，按现有项目规范处理。

## Research Findings
- 小程序目录已有较清晰分层：`api/`、`types/`、`utils/`、`stores/`、`components/`、`pages/`。
- 仓库存在不少测试文件，覆盖 API、工具、stores、组件和页面静态/集成约束，但 `package.json` 没有显式 `test` 或 `lint` 脚本。
- `package.json` 提供 `type-check`、H5/微信小程序 dev/build 脚本，符合当前小程序端验证策略。
- TypeScript 配置启用了路径别名 `@/*`，但没有看到更严格的 `strict` 覆盖配置，需进一步确认继承配置效果。
- 请求层有统一 `requestApi` / `ApiRequestError`，上传接口也集中处理状态码和 JSON 解析，基础健壮性较好。
- `requestApi` 对业务失败会抛错，但在 `success: false` 场景没有携带 HTTP 状态码；页面通常只能展示 message，难以区分登录失效/业务失败。
- `requestRaw` 对 `auth: true` 只是在有 token 时附加 Authorization，没有在无 token 时前置拒绝；是否合理取决于调用前是否总是经过 `ensureSessionReady`。
- `appSession` 做了 bootstrap promise 复用、手动退出阻断、token 失效后自动清 token 再微信登录，整体 session 设计有一定健壮性。
- 页面层存在大量 `catch + showToast`，错误展示分散，后续容易出现文案和行为不一致。
- 页面文件规模经过一轮拆分后已有改善：`home/index.vue`、`matches/detail.vue`、`teams/manage/index.vue`、`activities/index.vue` 已抽出局部组件或页面局部模块。
- 当前仍需优先关注的大页面包括：`user/index.vue` 约 1140 行、`teams/index.vue` 约 787 行、`challenges/detail.vue` 约 783 行、`matches/detail.vue` 约 778 行、`teams/manage/index.vue` 约 701 行、`user/matches/index.vue` 约 618 行。
- 页面拆分规范已沉淀到 `registration_system_mini/docs/mini-architecture.md`。
- `bun run type-check` 通过。
- `bun run build:mp-weixin` 通过。
- `bun test` 当前运行 109 个测试，109 个通过、0 个失败。

## Resources
- `registration_system_mini/package.json`
- `registration_system_mini/tsconfig.json`
- `registration_system_mini/src/utils/request.ts`
- `registration_system_mini/src/stores/appSession.ts`
- `registration_system_mini/src/api/*.ts`
- `registration_system_mini/src/pages/home/index.vue`
- `registration_system_mini/src/pages/matches/detail.vue`
- `registration_system_mini/src/pages/teams/manage/index.vue`
- `registration_system_mini/src/pages/activities/index.vue`
- `registration_system_mini/docs/mini-architecture.md`
