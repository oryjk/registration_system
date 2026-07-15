const TOKEN_KEY = "registration-admin-go.token.v1";

let cachedToken: string | null | undefined;

export function getAdminToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = window.localStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export function setAdminToken(token: string) {
  cachedToken = token;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  cachedToken = null;
  window.localStorage.removeItem(TOKEN_KEY);
}
