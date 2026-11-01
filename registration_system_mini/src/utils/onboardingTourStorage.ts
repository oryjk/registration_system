const KEY_PREFIX = "registration_system_mini_home_tour_v1";
let replayRequested = false;

function recordKey(userId: number | null): string {
  return `${KEY_PREFIX}:${userId ?? "guest"}`;
}

export function hasSeenHomeOnboardingTour(userId: number | null): boolean {
  try {
    return uni.getStorageSync(recordKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markHomeOnboardingTourSeen(userId: number | null): void {
  try {
    uni.setStorageSync(recordKey(userId), "1");
  } catch {
    // 存储不可用时仍允许退出，本次页面实例不会重复弹出。
  }
}

/** switchTab 不支持 query，用一次性请求兼容首页已缓存和首次打开两种情况。 */
export function requestHomeOnboardingTour(): void {
  replayRequested = true;
}

export function consumeHomeOnboardingTourRequest(): boolean {
  const requested = replayRequested;
  replayRequested = false;
  return requested;
}
