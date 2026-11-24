import { adminServers, getApiBaseUrl } from "../config/api";

const TOKEN_KEY = "registration-admin-go.token.v1";

let cachedToken: { key: string; value: string | null } | undefined;

function tokenKey() {
  return adminServers.length > 1
    ? `${TOKEN_KEY}:${getApiBaseUrl()}`
    : TOKEN_KEY;
}

export function getAdminToken(): string | null {
  const key = tokenKey();
  if (cachedToken?.key !== key) {
    cachedToken = { key, value: window.localStorage.getItem(key) };
  }
  return cachedToken.value;
}

export function setAdminToken(token: string) {
  const key = tokenKey();
  window.localStorage.setItem(key, token);
  cachedToken = { key, value: token };
}

export function clearAdminToken() {
  const key = tokenKey();
  window.localStorage.removeItem(key);
  cachedToken = { key, value: null };
}
