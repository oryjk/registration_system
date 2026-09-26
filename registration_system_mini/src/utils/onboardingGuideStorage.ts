const ONBOARDING_GUIDE_DISMISSED_KEY_PREFIX =
  "registration_system_mini_onboarding_guide_dismissed_v2";
const ONBOARDING_INTENT_KEY_PREFIX =
  "registration_system_mini_onboarding_intent_v2";

export type OnboardingIntent = "captain" | "member" | "player";
export type OnboardingUserId = number | null | undefined;

function userScopedKey(prefix: string, userId: OnboardingUserId): string | null {
  if (
    typeof userId !== "number"
    || !Number.isSafeInteger(userId)
    || userId <= 0
  ) {
    return null;
  }
  return `${prefix}:${userId}`;
}

/**
 * 新手引导状态必须按登录用户隔离。
 *
 * v1 曾使用设备级 key，无法判断它属于哪个账号，因此这里刻意不迁移旧值：
 * 否则 A 用户留下的 captain/dismissed 会继续污染后来登录的 B 用户。
 */
export function isOnboardingGuideDismissed(userId: OnboardingUserId): boolean {
  const key = userScopedKey(ONBOARDING_GUIDE_DISMISSED_KEY_PREFIX, userId);
  return key ? uni.getStorageSync(key) === "1" : false;
}

export function markOnboardingGuideDismissed(userId: OnboardingUserId): void {
  const key = userScopedKey(ONBOARDING_GUIDE_DISMISSED_KEY_PREFIX, userId);
  if (!key) return;
  uni.setStorageSync(key, "1");
}

/** 收起不是永久关闭；用户可以随时重新展开首页指引。 */
export function restoreOnboardingGuide(userId: OnboardingUserId): void {
  const key = userScopedKey(ONBOARDING_GUIDE_DISMISSED_KEY_PREFIX, userId);
  if (key) uni.removeStorageSync(key);
}

export function getOnboardingIntent(userId: OnboardingUserId): OnboardingIntent | null {
  const key = userScopedKey(ONBOARDING_INTENT_KEY_PREFIX, userId);
  if (!key) return null;

  const value = uni.getStorageSync(key);
  return value === "captain" || value === "member" || value === "player" ? value : null;
}

export function setOnboardingIntent(
  userId: OnboardingUserId,
  intent: OnboardingIntent,
): void {
  const key = userScopedKey(ONBOARDING_INTENT_KEY_PREFIX, userId);
  if (!key) return;
  uni.setStorageSync(key, intent);
}

/**
 * onboarding intent 只用于「尚未建立球队关系」时理解用户想怎么开始，
 * 一旦用户真实加入/创建过球队就不再把它当作长期身份。
 */
export function clearOnboardingIntent(userId: OnboardingUserId): void {
  const key = userScopedKey(ONBOARDING_INTENT_KEY_PREFIX, userId);
  if (!key) return;
  uni.removeStorageSync(key);
}
