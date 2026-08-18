import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHealth,
  getMiniAppSettings,
  updateMiniAppSettings,
} from "../../api/system";
import type { HealthStatus } from "../../types/api";
import type { MiniAppSettingsUpdate } from "../../types/system";
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

export function useMiniAppSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.miniAppSettings,
    queryFn: () => getMiniAppSettings(),
    retry: false,
  });
}

export function useUpdateMiniAppSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MiniAppSettingsUpdate) =>
      updateMiniAppSettings(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.miniAppSettings }),
  });
}
