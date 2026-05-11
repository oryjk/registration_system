import type { BackendMapPreviewSettings, BackendMiniAppRuntimeConfig } from "@/types/backend";
import { request, requestApi } from "@/utils/request";

interface HealthPayload {
  status: string;
}

export function getSystemHealth() {
  return request<HealthPayload>({
    url: "/health",
  });
}

export function getMapPreviewSettings() {
  return requestApi<BackendMapPreviewSettings>({
    url: "/system/map-preview-settings",
    auth: true,
  });
}

export function getAdminMapPreviewSettings() {
  return requestApi<BackendMapPreviewSettings>({
    url: "/admin/system/map-preview-settings",
    auth: true,
  });
}

export function getMiniAppRuntimeConfig() {
  return requestApi<BackendMiniAppRuntimeConfig>({
    url: "/system/mini-app-runtime-config",
  });
}
