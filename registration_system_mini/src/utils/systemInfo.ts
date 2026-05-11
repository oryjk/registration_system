export interface WindowMetrics {
  windowWidth: number;
  statusBarHeight: number;
}

interface LegacySystemInfo {
  platform?: string;
  windowWidth?: number;
  statusBarHeight?: number;
}

function getLegacySystemInfo(): LegacySystemInfo {
  if (typeof uni !== "undefined" && typeof uni.getSystemInfoSync === "function") {
    return uni.getSystemInfoSync() || {};
  }

  return {};
}

export function getAppPlatform() {
  if (typeof uni !== "undefined" && typeof uni.getAppBaseInfo === "function") {
    return ((uni.getAppBaseInfo() as { platform?: string } | undefined)?.platform || "");
  }

  return getLegacySystemInfo().platform || "";
}

export function getWindowMetrics(): WindowMetrics {
  if (typeof uni !== "undefined" && typeof uni.getWindowInfo === "function") {
    const windowInfo = uni.getWindowInfo() || {};
    return {
      windowWidth: windowInfo.windowWidth || 375,
      statusBarHeight: windowInfo.statusBarHeight || 20,
    };
  }

  const legacyInfo = getLegacySystemInfo();
  return {
    windowWidth: legacyInfo.windowWidth || 375,
    statusBarHeight: legacyInfo.statusBarHeight || 20,
  };
}
