/**
 * 是否启用了系统级"减少动态效果"。
 * H5 每次调用实时读取 prefers-reduced-motion（不缓存布尔值：用户运行中切换
 * 系统设置后，CSS 媒体查询与 JS 退场时长必须同步生效）；
 * 小程序无可靠等价能力，返回 false，保持短时非循环动效（见设计系统文档动效约束）。
 * 运行时守卫保证非 H5 环境不会触碰 window。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
