import type { BackendMiniReviewStatus } from "@/types/backend";
import { requestApi } from "@/utils/request";

// 审核状态走 Go 后端公开接口（无需登录），与业务 API 同域（VITE_API_BASE_URL）。
export function getMiniReviewStatus(projectCode: string, version: string) {
  const query = `project_code=${encodeURIComponent(projectCode)}&version=${encodeURIComponent(version)}`;
  return requestApi<BackendMiniReviewStatus>({
    url: `/mini-review/review-status?${query}`,
  });
}

// 白名单用户切换指定版本的审核状态（后端 env MINI_REVIEW_CONTROL_USER_IDS 校验）。
export function putMiniReviewReviewStatus(projectCode: string, version: string, isReviewing: boolean) {
  return requestApi<BackendMiniReviewStatus>({
    url: "/mini-review/review-status",
    method: "PUT",
    data: { project_code: projectCode, version, is_reviewing: isReviewing },
    auth: true,
  });
}
