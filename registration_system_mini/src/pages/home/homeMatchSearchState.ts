import type { AppMatchListResponse, AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { resolveMatchPhase, toHomeMatchCard } from "./homeMatchState";

export const HOME_MATCH_SEARCH_PAGE_SIZE = 5;

export interface HomeMatchSearchPageMergeResult {
  matches: AppMatchSummary[];
  total: number;
  page: number;
  hasMore: boolean;
}

export type HomeMatchSearchLoadMoreIntent = "ignore" | "load";

export interface HomeMatchSearchLoadMoreContext {
  hasActiveSearch: boolean;
  isGuestMode: boolean;
  isLoading: boolean;
  hasMore: boolean;
}

export interface HomeMatchSearchAutoLoadContext {
  intersectionRatio: number;
  hasMore: boolean;
  isLoading: boolean;
  hasError: boolean;
}

export function resolveHomeMatchSearchLoadMoreIntent(
  context: HomeMatchSearchLoadMoreContext,
): HomeMatchSearchLoadMoreIntent {
  if (!context.hasActiveSearch || context.isGuestMode) return "ignore";
  // 加载期间的触底/哨兵信号是对同一目标页的重复意图，直接忽略；
  // 当前页完成后由哨兵重新按视窗可见性判断是否再加载。
  if (context.isLoading) return "ignore";
  return context.hasMore ? "load" : "ignore";
}

export function shouldAutoLoadHomeMatchSearchPage(
  context: HomeMatchSearchAutoLoadContext,
): boolean {
  return context.intersectionRatio > 0
    && context.hasMore
    && !context.isLoading
    && !context.hasError;
}

export function mergeHomeMatchSearchPage(
  currentMatches: AppMatchSummary[],
  response: AppMatchListResponse,
): HomeMatchSearchPageMergeResult {
  const matchesById = new Map(currentMatches.map((match) => [match.id, match]));
  for (const match of response.items) {
    matchesById.set(match.id, match);
  }

  const total = Math.max(response.total, 0);
  const page = Math.max(response.page, 1);
  const pageSize = Math.max(response.page_size, 1);

  return {
    matches: [...matchesById.values()],
    total,
    page,
    hasMore: response.items.length > 0 && page * pageSize < total,
  };
}

export function toHomeMatchSearchCard(
  match: AppMatchSummary,
  now = new Date(),
): HomeMatchCardViewModel {
  const resolvedPhase = resolveMatchPhase(match, now);
  const phase: Exclude<AppMatchUiPhase, "excluded"> = resolvedPhase === "excluded" ? "ended" : resolvedPhase;
  const card = toHomeMatchCard(match, phase);

  if (match.status !== "cancelled") return card;

  return {
    ...card,
    stage: "已取消",
    stageTone: "red",
    dateNote: "比赛已取消",
    canRegister: false,
    actionLabel: "查看比赛",
  };
}
