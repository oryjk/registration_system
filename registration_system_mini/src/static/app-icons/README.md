# 共享细线图标

`AppIcon.vue` 使用 72px 透明 PNG：`default` 为正文深海军蓝 `#1b2d45`，`muted` 为灰蓝 `#65758b`。底栏专用 `active` / `inactive` 分别为薄荷和中性灰，不属于 AppIcon 的 tone。

SVG 是单份可编辑源，笔画与首页确认稿一致（1.65）。足球沿用首页本地线稿，其余源自已安装的 lucide-react 0.561.0；许可见 `../icons/lucide/LICENSE`。统计沿用首页无坐标轴柱形。

在 mini 目录使用现有管理端开发依赖生成：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome bun scripts/generate-app-icons.mjs
```

受控名称及颜色源在 `scripts/app-icon-config.mjs`，生成器同时更新 `components/ui/appIconNames.ts`。无需新增运行时依赖。
