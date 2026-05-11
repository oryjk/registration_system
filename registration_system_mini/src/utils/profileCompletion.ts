import type { BackendUser } from "@/types/backend";

export const PROFILE_SETUP_PAGE_PATH = "/pages/profile/setup/index";

function hasValue(value: string | null | undefined): boolean {
  return !!value?.trim();
}

export function needsProfileCompletion(user: BackendUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return !hasValue(user.nickname) || !hasValue(user.avatar_url);
}

export function isProfileSetupPage(route: string | null | undefined): boolean {
  return route === PROFILE_SETUP_PAGE_PATH || route === "pages/profile/setup/index";
}
