import type { MatchListQuery, MatchStatus } from "../types/match";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MATCH_STATUSES = new Set<MatchStatus>([
  "registering",
  "ongoing",
  "ended",
  "cancelled",
]);

export interface ParsedMatchListQuery extends MatchListQuery {
  page: number;
  page_size: number;
}

function positiveInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseMatchListQuery(search: string): ParsedMatchListQuery {
  const params = new URLSearchParams(search);
  const query: ParsedMatchListQuery = {
    page: positiveInteger(params.get("page"), DEFAULT_PAGE),
    page_size: positiveInteger(params.get("page_size"), DEFAULT_PAGE_SIZE),
  };
  const normalizedSearch = params.get("search")?.trim();
  const status = params.get("status") as MatchStatus | null;

  if (normalizedSearch) query.search = normalizedSearch;
  if (status && MATCH_STATUSES.has(status)) query.status = status;

  return query;
}

export function serializeMatchListQuery(query: MatchListQuery): string {
  const params = new URLSearchParams();
  const search = query.search?.trim();

  if (search) params.set("search", search);
  if (query.status && MATCH_STATUSES.has(query.status)) {
    params.set("status", query.status);
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
