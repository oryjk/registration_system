import { request } from "@/api/http";
import type { HealthStatus } from "@/types/api";

export function getHealth() {
  return request<HealthStatus>({ path: "/health", api: false });
}
