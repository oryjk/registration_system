import { request } from "./client";
import type { HealthStatus } from "../types/api";

export function getHealth() {
  return request<HealthStatus>("/health", { admin: false });
}
