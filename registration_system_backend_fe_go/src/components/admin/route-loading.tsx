/**
 * 路由 / 详情加载占位：转圈指示器。
 * 外观由 data-display.css 的 .route-loading 提供，动画复用 primitives 的 spin。
 */
export function RouteLoading() {
  return <div aria-label="加载中" className="route-loading" role="status" />;
}
