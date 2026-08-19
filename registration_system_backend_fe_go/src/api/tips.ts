import type { TipListPage, TipListQuery } from "../types/tip";
import { request } from "./client";

/** 管理端"打赏与建议"列表：只返回已支付（建议已生效）的打赏，按提交时间倒序。 */
export function listTips(query: TipListQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.page_size),
  });
  return request<TipListPage>(`/payments/tips?${params.toString()}`);
}
