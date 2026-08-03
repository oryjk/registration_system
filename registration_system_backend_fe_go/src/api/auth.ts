import type {
  AdminLoginResult,
  AdminUser,
  CreateAdminPayload,
} from "../types/auth";
import { request } from "./client";

export function loginAdmin(username: string, password: string) {
  return request<AdminLoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentAdmin() {
  return request<AdminUser>("/auth/me");
}

export function listAdmins() {
  return request<AdminUser[]>("/admins");
}

export function createAdmin(payload: CreateAdminPayload) {
  return request<AdminUser>("/admins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
