import { getWindowMetrics } from "@/utils/systemInfo";

interface CustomNavMetrics {
  headerTop: number;
  pageTopPadding: number;
  headerMinHeight: number;
  capsuleReserveRight: number;
}

export function getCustomNavMetrics(): CustomNavMetrics {
  const { windowWidth, statusBarHeight } = getWindowMetrics();
  const fallbackGap = 8;
  const fallbackCapsuleWidth = 96;

  try {
    const menuButton = uni.getMenuButtonBoundingClientRect();
    if (!menuButton || !menuButton.height) {
      throw new Error("menu button metrics unavailable");
    }

    return {
      headerTop: Math.round(menuButton.top),
      // header 底边 = menuButton.bottom + 14rpx 内边距 + 1px 描边 ≈ menuButton.bottom + 8；
      // 这里与底边对齐，页面再加自己的 +8 间距，避免默认就垫出一大段空隙。
      pageTopPadding: Math.round(menuButton.bottom + 8),
      headerMinHeight: Math.round(menuButton.height),
      capsuleReserveRight: Math.round(windowWidth - menuButton.left + 12),
    };
  } catch (_error) {
    // 回退路径同样与 header 实际高度（statusBar + 8 间距 + 32 内容 + 8 底部）对齐。
    return {
      headerTop: statusBarHeight + fallbackGap,
      pageTopPadding: statusBarHeight + 48,
      headerMinHeight: 32,
      capsuleReserveRight: fallbackCapsuleWidth,
    };
  }
}
