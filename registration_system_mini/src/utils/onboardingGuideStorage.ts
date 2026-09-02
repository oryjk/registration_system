const ONBOARDING_GUIDE_DISMISSED_KEY = "registration_system_mini_onboarding_guide_dismissed_v1";

/** 新手引导是否已被用户主动跳过（「先逛逛」）。跳过后本机不再自动弹出。 */
export function isOnboardingGuideDismissed(): boolean {
  return uni.getStorageSync(ONBOARDING_GUIDE_DISMISSED_KEY) === "1";
}

export function markOnboardingGuideDismissed(): void {
  uni.setStorageSync(ONBOARDING_GUIDE_DISMISSED_KEY, "1");
}
