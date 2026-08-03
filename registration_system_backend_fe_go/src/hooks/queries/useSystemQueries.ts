import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../../api/system";
import type { HealthStatus } from "../../types/api";
import { queryKeys } from "./keys";

export interface HealthSnapshot {
  checkedAt: Date;
  latency: number;
  status: HealthStatus;
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const startedAt = performance.now();
  const status = await getHealth();

  return {
    checkedAt: new Date(),
    latency: Math.round(performance.now() - startedAt),
    status,
  };
}

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    retry: false,
  });
}
