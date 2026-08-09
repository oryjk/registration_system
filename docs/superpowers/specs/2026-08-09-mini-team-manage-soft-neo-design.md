# Mini Team Manage Soft Neo Design

## Goal

将小程序/H5 的球队管理完整工作台统一为当前已确认的 Soft Neo-Brutalism 视觉语言，同时保持球队资料、创建/加入、队员管理和出勤统计的现有业务行为不变。

## Scope

- 球队管理页工作台外壳、球队 Hero 与模式切换。
- 球队资料、创建球队、加入球队三个表单面板。
- 队员搜索、角色与会员设置、成员分组和成员操作。
- 比赛出勤汇总、比赛列表、成员编辑弹层和成员出勤详情弹层。

## Visual System

- 页面背景使用现有 `--neo-color-page`，内容最大宽度 `900rpx` 并居中。
- Hero 使用深色 `NeoSurface`，`2rpx` 硬边框、小圆角和荧光绿实体偏移阴影。
- 工作模式使用 `NeoSegmentedControl`，面板标题使用 `NeoSectionHeader`，主要操作使用 `NeoButton`。
- 业务区域使用白色、浅蓝、浅黄、浅绿和珊瑚色的实体色块；禁止新增渐变、柔光阴影和大胶囊圆角。
- 输入框、textarea、picker、搜索结果和设置行统一使用硬边框、小圆角、明确的文本层级和稳定尺寸。
- Wot UI 的 picker/popup 保留行为，只覆盖为同一套视觉 token。

## Behavior Constraints

- 不修改 API、权限、球队上下文、上传、搜索、成员状态和出勤统计逻辑。
- 保留现有 props/emits 契约与页面路由。
- 仅使用 `uni.*`，不使用 DOM API；样式使用 `rpx`，交互态使用 `hover-class`。
- H5 与微信小程序都必须能够构建。

## Acceptance

- 从“我的”进入球队管理后，所有主模式和弹层视觉一致。
- 模式切换、搜索、成员编辑和出勤详情仍可操作。
- 手机和桌面视口无横向溢出、文字遮挡或控件错位。
- `bun run type-check`、`bun run build:h5`、`bun run build:mp-weixin` 和 `git diff --check` 通过。
