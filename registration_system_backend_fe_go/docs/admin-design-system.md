# 管理端设计规范

管理端面向比赛、球队与成员运营。采用紧凑、易扫描的工作界面，参考 [Linear 的界面重设计](https://linear.app/now/how-we-redesigned-the-linear-ui) 的层级与简化原则，沿用 [shadcn/ui 的语义主题 token](https://ui.shadcn.com/docs/theming)。青绿用于主要操作、焦点和选中反馈，状态使用独立语义色。深浅主题共享尺寸与排版。

## 唯一来源与分层

- `src/styles/foundation.css`：全局基础刻度与语义角色、主题和元素 reset。只在这里定义全局数值与颜色。
- `src/styles/tokens.css`：将上述角色桥接到 Tailwind 工具类，不重复定义数值。
- `src/styles/primitives.css` / `form-controls.css`：基础件和复用业务控件外观。
- `page-layout.css`：页面结构与间距；`responsive.css`：响应式覆盖。
- 页面专属变量在页面根类中声明，例如 `.login-page` 的 `--login-panel-width`，不提升到全局。

组件消费语义 token，页面组合组件。不要逐页复制字号、颜色或圆角，也不要用 `font: inherit` 的未分层 reset 覆盖 Tailwind 的字号、字重与行高。Input、Textarea、Button 的共享样式使用稳定的 `ui-input` / `ui-textarea` / `ui-button` 类；Radix Slot 可覆盖 `data-slot`，不能将其作为这些控件的唯一样式依据。

## 排版

| 用途 | Token | 默认值 |
| --- | --- | --- |
| 正文、表格数据 | `--font-size-base` | 14px |
| 标准控件 | `--font-size-control` | 桌面 14px，手机 16px |
| 标签、说明 | `--font-size-label` / `--font-size-sm` | 13px |
| 编号、时间副行、状态徽章 | `--font-size-xs` | 12px |
| 分区与卡片标题 | `--font-size-section` | 16px |
| 弹窗、抽屉标题 | `--font-size-overlay` | 18px |
| 页面标题 | `--font-size-page` | 20px |

字重只用 normal 400、medium 500、semibold 600；说明保持常规字重，标签与操作使用 medium，标题与数据重点使用 semibold。常规行高 1.5，标题使用 1.35。移动控件字号 16px 同时避免 iOS 输入框聚焦时自动放大。

## 尺寸与圆角

| 用途 | Token / 工具类 | 默认值 |
| --- | --- | --- |
| 紧凑行内操作 | `--control-height-sm` / `h-control-sm` | 桌面 32px，手机 44px |
| 搜索、筛选、表单、分页、标准按钮 | `--control-height` / `h-control` | 桌面 36px，手机 44px |
| 登录与重要表单操作 | `--control-height-lg` / `h-control-lg` | 44px |
| 多行输入最小高度 | `--textarea-min-height` | 96px |
| 表头 | `--table-header-height` | 44px |
| 按钮、输入框、选项 | `--radius-control` | 6px |
| 卡片、表格容器 | `--radius-panel` | 8px |
| 弹窗、浮层 | `--radius-overlay` | 12px |
| 复选框 | `--radius-check` | 4px |
| 头像、开关、状态胶囊 | `--radius-full` | 完全圆角 |

不要用 `h-9` 等无角色的数值决定标准控件高度。控件水平内边距 12px、单行垂直内边距 6px；单行 Select 和 Input 与同排按钮对齐。下拉菜单可以展示额外说明，已选值通常只显示标题。多行内容允许自适应，不能因固定高度被裁切。

## 布局与反馈

使用现有 4px 间距刻度及 2px 半档。标准卡片内边距 20px、内容分区间距 16px；表单字段间距 16px，标签与控件间距 8px。紧凑表格操作在桌面保留 32px 档位，手机提升到 44px，禁止用小图标自身作为点击热区。

工作表面采用中性色，普通卡片依靠边框区分层级，不叠加装饰性网格和发光阴影。浮层保留阴影以表示遮挡关系；焦点使用共享 2px ring。输入框、下拉框采用相同 input 边框和 surface-inset 背景。错误、禁用、加载与键盘焦点不能仅依靠位置表达。

## 变更验收

修改 token 或基础件后，检查深浅主题、1440px 桌面、1024px 平板和 390px 手机。覆盖用户列表的搜索/筛选/分页、比赛表单、球队成员抽屉与充值弹窗、登录及设置页。确认长选项、100 条分页、表格内滚动、焦点、弹窗关闭和手机横屏不被裁切。视觉变化以浏览器测量和截图为主，不新增机械的 CSS 字符串测试；行为测试继续保留。
