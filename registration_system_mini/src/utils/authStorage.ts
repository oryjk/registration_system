const TOKEN_KEY = "registration_system_mini_token";
const CURRENT_TEAM_KEY = "registration_system_mini_current_team_id";
const CURRENT_IDENTITY_KIND_KEY = "registration_system_mini_current_identity_kind";
const CURRENT_IDENTITY_TEAM_KEY = "registration_system_mini_current_identity_team_id";
const MANUAL_LOGOUT_KEY = "registration_system_mini_manual_logout";

export type StoredCurrentIdentityKind = "team" | "venue";

export interface StoredCurrentIdentitySelection {
  kind: StoredCurrentIdentityKind;
  teamId?: number;
}

export function getAccessToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || "";
}

export function setAccessToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token);
  uni.removeStorageSync(MANUAL_LOGOUT_KEY);
}

export function clearAccessToken(): void {
  uni.removeStorageSync(TOKEN_KEY);
}

export function getCurrentTeamId(): number | null {
  const value = uni.getStorageSync(CURRENT_TEAM_KEY);
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

export function setCurrentTeamId(teamId: number): void {
  uni.setStorageSync(CURRENT_TEAM_KEY, teamId);
}

export function clearCurrentTeamId(): void {
  uni.removeStorageSync(CURRENT_TEAM_KEY);
}

export function getCurrentIdentitySelection(): StoredCurrentIdentitySelection | null {
  const kind = uni.getStorageSync(CURRENT_IDENTITY_KIND_KEY);
  if (kind === "venue") {
    return { kind };
  }

  if (kind === "team") {
    const teamId = Number(uni.getStorageSync(CURRENT_IDENTITY_TEAM_KEY));
    return Number.isFinite(teamId) && teamId > 0 ? { kind, teamId } : null;
  }

  return null;
}

export function setCurrentIdentitySelection(selection: StoredCurrentIdentitySelection): void {
  uni.setStorageSync(CURRENT_IDENTITY_KIND_KEY, selection.kind);
  if (selection.kind === "team" && selection.teamId) {
    uni.setStorageSync(CURRENT_IDENTITY_TEAM_KEY, selection.teamId);
    return;
  }

  uni.removeStorageSync(CURRENT_IDENTITY_TEAM_KEY);
}

export function clearCurrentIdentitySelection(): void {
  uni.removeStorageSync(CURRENT_IDENTITY_KIND_KEY);
  uni.removeStorageSync(CURRENT_IDENTITY_TEAM_KEY);
}

export function hasManualLogout(): boolean {
  return uni.getStorageSync(MANUAL_LOGOUT_KEY) === "1";
}

export function setManualLogout(): void {
  uni.setStorageSync(MANUAL_LOGOUT_KEY, "1");
}

export function clearManualLogout(): void {
  uni.removeStorageSync(MANUAL_LOGOUT_KEY);
}
