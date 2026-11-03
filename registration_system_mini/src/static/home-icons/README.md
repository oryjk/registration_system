# 首页细线图标

72px 透明 PNG 用于微信原生 image，SVG 为可编辑源稿。笔画统一 1.65，灰蓝为次要导航，薄荷为首页选中态，绿色为报名成功。

除足球为本地绘制的圆形/五边形线稿，其余基于已安装的 lucide-react 0.561.0（ISC），许可见 `../icons/lucide/LICENSE`。不会修改或替换其他页面的既有图标。

在管理端已安装开发依赖并具备 Chromium 的环境，从 mini 目录运行：

```sh
bun scripts/generate-home-icons.mjs
# 已安装的 Chromium 与 Playwright 默认版本不同，可显式选择：
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome bun scripts/generate-home-icons.mjs
```
