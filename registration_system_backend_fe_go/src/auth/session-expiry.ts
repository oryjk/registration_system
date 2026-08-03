import { clearAdminToken, getAdminToken } from "./token-storage";

export function expireAdminSession() {
  if (!getAdminToken()) return;

  clearAdminToken();
  window.dispatchEvent(new Event("admin-auth-expired"));
}
