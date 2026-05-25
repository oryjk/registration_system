import type { BackendMiniReviewStatus } from "@/types/backend";
import { request } from "@/utils/request";

const MINI_REVIEW_BASE_URL = "https://match.oryjk.cn/mini-review";

export function getMiniReviewStatus(projectCode: string, version: string) {
  return request<BackendMiniReviewStatus>({
    url: `${MINI_REVIEW_BASE_URL}/api/public/review-status?project_code=${encodeURIComponent(projectCode)}&version=${encodeURIComponent(version)}`,
  });
}
