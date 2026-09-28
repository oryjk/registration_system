import type { WeChatUserActivity, WeChatUserListQuery } from "../types/user";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface ParsedUserListQuery extends WeChatUserListQuery {
  page: number;
  page_size: number;
}

function parseActivity(value: string | null): WeChatUserActivity {
  switch (value) {
    case "active_7d":
    case "inactive_30d":
    case "never":
      return value;
    default:
      return "all";
  }
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseUserListQuery(search: string): ParsedUserListQuery {
  const params = new URLSearchParams(search);
  const query: ParsedUserListQuery = {
    page: positiveInteger(params.get("page"), DEFAULT_PAGE),
    page_size: positiveInteger(params.get("page_size"), DEFAULT_PAGE_SIZE),
    match_admin_only: params.get("match_admin_only") === "true",
    activity: parseActivity(params.get("activity")),
  };
  const normalizedSearch = params.get("search")?.trim();
  if (normalizedSearch) query.search = normalizedSearch;

  return query;
}

export function serializeUserListQuery(query: WeChatUserListQuery): string {
  const params = new URLSearchParams();
  const search = query.search?.trim();

  if (search) params.set("search", search);
  if (query.match_admin_only) params.set("match_admin_only", "true");
  if (query.activity && query.activity !== "all") {
    params.set("activity", query.activity);
  }
  if (query.page && query.page !== DEFAULT_PAGE) {
    params.set("page", String(query.page));
  }
  if (query.page_size && query.page_size !== DEFAULT_PAGE_SIZE) {
    params.set("page_size", String(query.page_size));
  }

  const value = params.toString();
  return value ? `?${value}` : "";
}
