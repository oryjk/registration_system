import type {
  MiniReviewSetStatusPayload,
  MiniReviewStatusItem,
  MiniReviewStatusPage,
  MiniReviewStatusQuery,
} from "../types/miniReview";
import { request } from "./client";

function buildQuery(query: MiniReviewStatusQuery) {
  const params = new URLSearchParams();
  if (query.project_code) params.set("project_code", query.project_code);
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function listMiniReviewStatuses(query: MiniReviewStatusQuery) {
  return request<MiniReviewStatusPage>(
    `/mini-review/statuses${buildQuery(query)}`,
  );
}

export function setMiniReviewStatus(
  id: number,
  payload: MiniReviewSetStatusPayload,
) {
  return request<MiniReviewStatusItem>(`/mini-review/statuses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
