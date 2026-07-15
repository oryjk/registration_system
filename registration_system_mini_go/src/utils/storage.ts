import type { User } from "@/types/api";

const TOKEN_KEY = "go-mini.access-token";
const USER_KEY = "go-mini.current-user";

export function getAccessToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || "";
}

export function saveSession(token: string, user: User) {
  uni.setStorageSync(TOKEN_KEY, token);
  uni.setStorageSync(USER_KEY, user);
}

export function getStoredUser(): User | null {
  const value = uni.getStorageSync(USER_KEY);
  return value && typeof value === "object" ? (value as User) : null;
}

export function clearStoredSession() {
  uni.removeStorageSync(TOKEN_KEY);
  uni.removeStorageSync(USER_KEY);
}
