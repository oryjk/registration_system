import type { BackendMiniReviewStatus } from "@/types/backend";
import { requestApi } from "@/utils/request";

// 审核状态走 Go 后端公开接口（无需登录），与业务 API 同域（VITE_API_BASE_URL）。
export function getMiniReviewStatus(projectCode: string, version: string) {
  const query = `project_code=${encodeURIComponent(projectCode)}&version=${encodeURIComponent(version)}`;
  return requestApi<BackendMiniReviewStatus>({
    url: `/mini-review/review-status?${query}`,
  });
}
