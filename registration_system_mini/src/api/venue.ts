import { requestApi } from "@/utils/request";
import type { BackendVenueSuggestion } from "./match";

/** 全部已保存坐标的历史球场，独立于最多 20 条的常用场地建议。 */
export function getVenueMap() {
  return requestApi<BackendVenueSuggestion[]>({ url: "/venues/map", auth: true });
}
