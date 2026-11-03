# 微信细线方向图标

原稿：`src/static/icons/navigation-chevron.svg`。透明背景，首页同款 1.65px 单个细线 chevron，填充路径使用 `currentColor`，可独立导出使用。旧点阵 SVG 仅保留作历史素材，不再是运行时字体源。

微信端使用同一 SVG 派生的内嵌 WOFF，在 `App.vue` 中通过 `MP-WEIXIN` 条件编译引入；无需外网加载字体。H5 不引入字体及覆盖规则。

- Wot 2.3.0 的 `arrow-*`、`left/right/up/down`、`caret-*`、`double-*` 方向字形由 `arrow-font.css` 集中覆盖，沿用原尺寸、颜色与组件事件。历史双箭头码点兼容保留，但展示为同方向单个 chevron。
- 文本方向箭头添加 `ui-arrow-text`，支持 `→ ← ↑ ↓ › ‹ ⌃ ⌄ » «`；中文与其他字符继续使用原系统字体。
- CSS 尖角在微信分支使用相同文本字形，原 H5 结构和样式保留。编辑、播放、分享等其他图标不属于方向箭头。
- 新增方向箭头优先使用已有 Wot 图标名，或在文本箭头上添加 `ui-arrow-text`。不重新绘制 CSS 尖角。

修改 SVG 后生成字体（Python 3，工具依赖 `fonttools>=4.60,<5`，仅素材维护时需要）：

```sh
uv run --with 'fonttools>=4.60,<5' python scripts/build-arrow-font.py
```

生成器固定字体时间戳，相同输入会产生相同 CSS；提交 SVG、脚本与生成 CSS。更新 Wot 版本时核对 `wd-icon/iconfont.scss` 中的方向字形码点。
