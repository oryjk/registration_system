# 小程序 / H5 改版入口

本页替代早期方案探索记录中的执行指令。初期蓝色方案、纵向翻卡、默认前 5 个头像、命名迁移尚未执行等描述均已过期，不作为后续开发依据。

- **现行视觉与交互规范：** [统一设计系统](../../registration_system_mini/docs/mini-design-system.md)。当前为轻量赛事 UI，默认薄荷主题，可切换主色；旧 Neo 视觉规范已废止。
- **工程入口：** [mini AGENTS.md](../../registration_system_mini/AGENTS.md)。组件使用职责命名，公共组件在 `src/components/ui/`，token 在 `src/styles/design-tokens.css`。
- **改版批次与历史迁移：** [统一改版实施计划](../superpowers/plans/2026-09-22-mini-ui-unification.md)。它记录迁移过程，不能覆盖现行设计系统，不能根据早期未勾选项重复执行已完成迁移。
- **验收记录：** [改版验收清单](mini-ui-rollout-checklist.md)。自动验证与用户双端验收分别记录，不把编译通过等同于视觉验收通过。

开发分支为 `codex/mini-d-design`，H5 与 mp-weixin 共用实现。界面验收由用户操作，Agent 不调用电脑控制或自动浏览器测试；本地修改不代表上传、推送或生产发布。
