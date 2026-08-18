import type { BackendUser } from "@/types/backend";

function hasValue(value: string | null | undefined): boolean {
  return !!value?.trim();
}

export function needsProfileCompletion(user: BackendUser | null | undefined): boolean {
  if (!user) {
    return false;
  }

  return !hasValue(user.nickname) || !hasValue(user.avatar_url);
}
