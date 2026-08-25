import { listMatches } from "@/api/match";
import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { resolveMatchPhase, toHomeMatchCard } from "./homeMatchState";

/** 「广场」tab：每页拉取的比赛数。 */
export const OTHER_MATCHES_PAGE_SIZE = 10;

/** 把「广场」列表数据转换成首页比赛卡视图模型（过滤已结束与已取消）。 */
export function buildOtherMatchCards(matches: AppMatchSummary[], now = new Date()): HomeMatchCardViewModel[] {
  return matches
    .map((match) => ({ match, phase: resolveMatchPhase(match, now) }))
    .filter(({ phase }) => phase !== "excluded" && phase !== "ended")
    .sort((left, right) => left.match.start_time.localeCompare(right.match.start_time) || left.match.id.localeCompare(right.match.id))
    .map(({ match, phase }) => toHomeMatchCard(match, phase as Exclude<AppMatchUiPhase, "excluded">));
}

export function fetchOtherMatchesPage(page: number) {
  return listMatches({
    scope: "others",
    endsAfter: new Date(),
    hostTeamOnly: true,
    page,
    pageSize: OTHER_MATCHES_PAGE_SIZE,
  });
}
