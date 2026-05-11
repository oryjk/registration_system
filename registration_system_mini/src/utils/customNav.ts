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

    const verticalGap = Math.max(menuButton.top - statusBarHeight, fallbackGap);

    return {
      headerTop: Math.round(menuButton.top),
      pageTopPadding: Math.round(menuButton.bottom + 16),
      headerMinHeight: Math.round(menuButton.height),
      capsuleReserveRight: Math.round(windowWidth - menuButton.left + 12),
    };
  } catch (_error) {
    return {
      headerTop: statusBarHeight + fallbackGap,
      pageTopPadding: statusBarHeight + 44,
      headerMinHeight: 32,
      capsuleReserveRight: fallbackCapsuleWidth,
    };
  }
}
