# 加入球队列表 Implementation Plan

> Use superpowers:executing-plans and dispatching-parallel-agents for the independent backend pagination and mini frontend.

**Goal:** 微信加入页默认完整球队目录、输入即时筛选、醒目建队按钮，上传开发版。
**Architecture:** Go搜索接口可选offset，默认旧行为；小程序独立目录状态管理逐页读取与过滤。业务加入流程继续复用现有composable；H5条件隔离。
**Tech Stack:** Go/Gin/sqlc/PostgreSQL、Vue3/uni-app/Bun。
**Spec:** docs/superpowers/specs/2026-11-01-team-directory-design.md

- [x] 后端分页兼容与相关TDD/集成测试，gofmt/vet/build。
- [x] 微信目录加载/筛选/刷新/竞态和新建队CTA，保留H5与加入业务。
- [x] 前端测试、类型检查、MP构建、实际组件交互，独立审查。
- [ ] 文档/记忆、main提交推送、Go接口发布检查与部署。
- [ ] mp:release版本登记；必要时提交版本文件再push main，重跑release上传并报告版本。

## 验证与审查记录

- 后端TDD red/green：HTTP/application 122 项 race 测试通过，新增分页与既有悅/悦 DB 用例通过（独立 schema）；gofmt、go vet、API build 通过。
- 前端目录 helper 7 项（含 >50、即时筛选/清空、并发、刷新、错误/同步错误重试、旧请求失效、旧服务器保护）red/green；onboarding 集成验证进入即加载、选择失效和创建导航。
- 实际组件 320/375px 验证 51 队、输入过滤与恢复、密码输入/加入与创建事件、secondary 海军蓝白字、审核隐藏；创建CTA位于首屏。独立审查指出位置问题后已通过 slot 复用修复。

- 最终类型检查、微信构建/组件/26路由/3分包/API校验通过；106个测试文件按文件隔离，722项通过。新CTA的MP slot与注册产物已核对，H5原入口保留。发布按后续 main/clean/已push 门禁执行。
