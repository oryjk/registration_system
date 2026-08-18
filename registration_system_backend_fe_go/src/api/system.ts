import type { HealthStatus } from "../types/api";
import type { MiniAppSettings, MiniAppSettingsUpdate } from "../types/system";
import { request } from "./client";

export function getHealth() {
  return request<HealthStatus>("/health", { auth: "none" });
}

export function getMiniAppSettings() {
  return request<MiniAppSettings>("/system/mini-app-settings");
}

export function updateMiniAppSettings(payload: MiniAppSettingsUpdate) {
  return request<MiniAppSettings>("/system/mini-app-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
