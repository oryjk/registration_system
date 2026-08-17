import type { AppMatchSummary, AppMatchUiPhase } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { parseDateValue } from "@/utils/datetime";
import { resolveMatchPhase, toHomeMatchCard } from "@/pages/home/homeMatchState";

export type UserMatchScope = "future" | "past";

/** 按阶段过滤并复用首页比赛卡视图模型，保证「我的比赛」与首页展示一致。 */
export function buildUserMatchCards(params: {
  matches: AppMatchSummary[];
  scope: UserMatchScope;
  now?: Date;
}): HomeMatchCardViewModel[] {
  const now = params.now ?? new Date();

  return params.matches
    .map((match) => ({ match, phase: resolveMatchPhase(match, now) }))
    .filter(({ phase }) => phase !== "excluded")
    .filter(({ phase }) => (params.scope === "future" ? phase !== "ended" : phase === "ended"))
    .sort((left, right) => {
      const leftTime = parseDateValue(params.scope === "future" ? left.match.start_time : left.match.end_time).getTime();
      const rightTime = parseDateValue(params.scope === "future" ? right.match.start_time : right.match.end_time).getTime();
      return params.scope === "future" ? leftTime - rightTime : rightTime - leftTime;
    })
    .map(({ match, phase }) => toHomeMatchCard(match, phase as Exclude<AppMatchUiPhase, "excluded">));
}
