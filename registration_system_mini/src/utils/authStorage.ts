const TOKEN_KEY = "registration_system_mini_token";
const CURRENT_TEAM_KEY = "registration_system_mini_current_team_id";
const MANUAL_LOGOUT_KEY = "registration_system_mini_manual_logout";

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

export function hasManualLogout(): boolean {
  return uni.getStorageSync(MANUAL_LOGOUT_KEY) === "1";
}

export function setManualLogout(): void {
  uni.setStorageSync(MANUAL_LOGOUT_KEY, "1");
}

export function clearManualLogout(): void {
  uni.removeStorageSync(MANUAL_LOGOUT_KEY);
}
