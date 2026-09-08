import type { BackendMiniAppRuntimeConfig } from "@/types/backend";
import { request, requestApi } from "@/utils/request";

interface HealthPayload {
  status: string;
}

export function getSystemHealth() {
  return request<HealthPayload>({
    url: "/health",
  });
}

export function getMiniAppRuntimeConfig() {
  return requestApi<BackendMiniAppRuntimeConfig>({
    url: "/system/mini-app-runtime-config",
  });
}
