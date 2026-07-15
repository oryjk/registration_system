import { request } from "./client";
import type { AdminLoginResult, AdminUser } from "../types/auth";

export function loginAdmin(username: string, password: string) {
  return request<AdminLoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentAdmin() {
  return request<AdminUser>("/auth/me");
}
