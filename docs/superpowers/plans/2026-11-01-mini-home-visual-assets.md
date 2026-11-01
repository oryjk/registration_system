# 微信首页图片增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按已确认设计增强微信首页并接入 MinIO 素材，H5 保持原状。

**Architecture:** 新素材清单集中配置；微信专用引导组件和条件编译隔离界面；比赛缩略图由纯函数决定优先级和稳定默认图片，复用 MinIO 缓存。

**Tech Stack:** uni-app、Vue 3、TypeScript、Bun、MinIO。

**Spec:** docs/superpowers/specs/2026-11-01-mini-home-visual-assets.md

## Global Constraints

- 仅改变 MP-WEIXIN；H5 保留旧模板、样式、入口行为及封面逻辑。
- 素材先生成、压缩、上传并校验，再修改产品代码。
- 不修改后端、数据库或自定义比赛封面，不将图片打入小程序包。
- 保持审核态、引导 scope 和动作事件约定；时间继续使用现有北京时间格式化结果。

## Review Focus

- 自定义封面优先；空值、空白和旧记录均可回退。
- 同比赛刷新、顺序变化、重复报名组不改变默认图，十张图片均可分配。
- 图片失败有限回退；MinIO 缓存尚未返回的空 src 不记为失败。
- 320px 窄屏、长名称、日期地点及比分不遮挡，入口保留完整标题与点击区域。
- MP 条件编译隔离新模板和资源；审核过滤和新手引导仍能定位。按用户后续要求不额外检查 H5。

### Task 1: 制作并交付远程素材

**Files:** Create: `docs/design-assets/mini-home/v1/`（压缩图片、prompts、catalog、verification、README）。

- [x] 生成 1 张 hero、3 张透明入口插画、1 张透明地图和 10 张比赛默认图。
- [x] 按手机尺寸压缩，记录尺寸、字节数和 SHA256；上传新 MinIO 对象。
- [x] 逐一检查公网响应与字节哈希，记录 15 张素材全部成功。

### Task 2: 微信首页视觉与封面优先级

**Files:** Create: `src/config/homeVisualAssets.ts`、`src/pages/home/homeMatchThumbnail.ts`、`src/pages/home/__tests__/homeMatchThumbnail.test.ts`、`src/pages/home/components/HomeStartEntries.vue`、`src/pages/home/components/HomeMatchThumbnail.vue`；Modify: `src/pages/home/index.vue`、`components/HomeVenueMapEntry.vue`、`components/HomeMatchCard.vue`（均相对 mini）。

**Interfaces:** `resolveHomeMatchThumbnail(match: { id: string; coverImageUrl?: string }, failedUrls?: readonly string[]): string`，返回自定义封面、稳定池图片、原默认封面或空串；组件使用 `useMinioImages`。

- [x] 先编写并运行封面函数测试：自定义优先、空值默认、稳定分配及覆盖十图、失败逐级回退直至空串；确认新增行为未实现时失败。
- [x] 引入已校验的远程素材配置，实现函数并运行测试。
- [x] 新建微信专用入口组件，保留 `getQueryScope`、按钮定位 ID、权限动作和 help 事件，首页用条件编译替换微信 `HomeEmptyHero`。
- [x] 微信地图入口加插画，已结束查看卡加缩略图；失败保留图标/纯色，完整日期地点自动换行，不改变 H5 模板和样式。

### Task 3: 验证与记录

**Files:** Modify: mini design-system、根 `FEATURES.md`、`CHANGELOG.md`。

- [x] 运行本次封面、首页入口/引导和图片缓存相关 Bun 测试、`bun run type-check`。
- [x] 运行 `MINI_REVIEW_SKIP=1 bun run build:mp-weixin` ；检查微信组件注册、路由、分包与 API 配置。用户后续明确无需再检查 H5。
- [x] 用可用的浏览器/模拟器工具复核窄屏布局；无法真机验证时明确说明。
- [x] 完成独立代码审查并修复重要问题，更新设计规范、功能清单和变更原因。
