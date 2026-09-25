import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getHealth,
  getMiniAppSettings,
  updateMiniAppSettings,
  uploadNextMatchSocialImage,
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

// 上传成功后让 mini-app-settings 缓存失效，页面立即拉到带新 URL 的配置。
export function invalidateMiniAppSettings(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.miniAppSettings,
  });
}

export function useUpdateMiniAppSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MiniAppSettingsUpdate) =>
      updateMiniAppSettings(payload),
    onSuccess: () => invalidateMiniAppSettings(queryClient),
  });
}

export function useUploadNextMatchSocialImageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadNextMatchSocialImage(file),
    onSuccess: () => invalidateMiniAppSettings(queryClient),
  });
}
