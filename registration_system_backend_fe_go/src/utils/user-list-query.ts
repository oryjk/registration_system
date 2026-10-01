import type {
  WeChatUserActivity,
  WeChatUserIdentityFilter,
  WeChatUserListQuery,
  WeChatUserSort,
  WeChatUserStatusFilter,
} from "../types/user";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT: WeChatUserSort = "last_active_desc";

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

function parseStatusFilter(value: string | null): WeChatUserStatusFilter {
  switch (value) {
    case "active":
    case "frozen":
      return value;
    default:
      return "all";
  }
}

function parseIdentityFilter(value: string | null): WeChatUserIdentityFilter {
  switch (value) {
    case "match_admin":
    case "normal":
      return value;
    default:
      return "all";
  }
}

function parseSort(value: string | null): WeChatUserSort {
  switch (value) {
    case "last_active_desc":
    case "last_active_asc":
    case "created_desc":
    case "created_asc":
      return value;
    default:
      return DEFAULT_SORT;
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
    status: parseStatusFilter(params.get("status")),
    identity: parseIdentityFilter(params.get("identity")),
    sort: parseSort(params.get("sort")),
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
  if (query.status && query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.identity && query.identity !== "all") {
    params.set("identity", query.identity);
  }
  if (query.sort && query.sort !== DEFAULT_SORT) {
    params.set("sort", query.sort);
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
