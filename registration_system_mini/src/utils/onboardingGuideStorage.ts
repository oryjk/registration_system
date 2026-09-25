const ONBOARDING_GUIDE_DISMISSED_KEY = "registration_system_mini_onboarding_guide_dismissed_v1";
const ONBOARDING_INTENT_KEY = "registration_system_mini_onboarding_intent_v1";

export type OnboardingIntent = "captain" | "player";

/** 新手引导是否已被用户主动跳过（「先逛逛」）。跳过后本机不再自动弹出。 */
export function isOnboardingGuideDismissed(): boolean {
  return uni.getStorageSync(ONBOARDING_GUIDE_DISMISSED_KEY) === "1";
}

export function markOnboardingGuideDismissed(): void {
  uni.setStorageSync(ONBOARDING_GUIDE_DISMISSED_KEY, "1");
}

export function getOnboardingIntent(): OnboardingIntent | null {
  const value = uni.getStorageSync(ONBOARDING_INTENT_KEY);
  return value === "captain" || value === "player" ? value : null;
}

export function setOnboardingIntent(intent: OnboardingIntent): void {
  uni.setStorageSync(ONBOARDING_INTENT_KEY, intent);
}
