import type { HealthStatus } from "../types/api";
import { request } from "./client";

export function getHealth() {
  return request<HealthStatus>("/health", { auth: "none" });
}
