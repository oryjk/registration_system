# Go 管理后台视觉改造任务

目标：保留 Vite、React Router、认证和 API 边界，使用 ProComponents 与 Ant Design 5 Token 完成全页面视觉和交互统一。

阶段：

1. [in_progress] 依赖、CLI API 核对和主题基础
2. [pending] 应用框架与登录页
3. [pending] 比赛、球队、管理员列表
4. [pending] 比赛表单、详情、仪表盘与接入状态
5. [pending] 桌面/移动视觉 QA 与清理

约束：

- 直接在当前 `main` 开发，不创建 worktree。
- 保持 antd 5.29.3，不升级 antd 6，不迁移 Umi Max。
- API、DTO、权限和业务 payload 不变。
- 不伪造后端分页、统计或管理端接口。
- 纯视觉改动不机械新增单测；URL 状态和关键业务流程通过 Playwright 验证。

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
