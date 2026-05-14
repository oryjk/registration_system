# Claude — 管理后台子项目指南

你当前在 `registration_system_backend_fe/` 中工作。

## 必读

- 同目录 [`AGENTS.md`](/Users/carlwang/registration_system/registration_system_backend_fe/AGENTS.md)

## 推荐工作顺序

1. 先确认改动位于 `views`、`services`、`stores`、`router` 还是 `utils/request.ts`
2. 若涉及接口变化，先核对后端，再更新 `services`
3. 最后回到具体页面或状态管理层收口
4. 复杂任务默认走 `planning-with-files`，并同步更新根目录和管理后台目录下的 `task_plan.md`、`findings.md`、`progress.md`

## 特别注意

- 后端接口大多来自 `/api/admin` 体系，`baseURL` 拼接关系以 `src/utils/request.ts` 和 `vite.config.ts` 为准。
- 不要只改页面展示而忽略类型、请求层与错误处理。
- 当前项目带有 `type-check`、`lint`、`unit`、`e2e` 脚本，按改动范围选择最小充分验证。

## 输出要求

- 对用户使用简体中文
- 说明前后端联动时，明确指出受影响的服务文件与页面文件
