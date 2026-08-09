import type {
  AppHomeActionMatch,
  AppHomeEndedMatch,
  AppMatchHomeResponse,
  AppMatchPhaseSource,
  AppMatchSummary,
  AppMatchUiPhase,
} from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { formatDateLabel, parseDateValue } from "@/utils/datetime";

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

export interface HomeMatchSectionViewModel {
  phase: VisibleHomeMatchPhase;
  title: string;
  items: HomeMatchCardViewModel[];
}

const HOME_MATCH_PHASE_TITLES: Record<VisibleHomeMatchPhase, string> = {
  upcoming: "报名中",
  ongoing: "进行中",
  ended: "已结束",
};

function compareDateAsc(left: string, right: string): number {
  return parseDateValue(left).getTime() - parseDateValue(right).getTime();
}

function compareDateDesc(left: string, right: string): number {
  return parseDateValue(right).getTime() - parseDateValue(left).getTime();
}

function phaseRank(phase: VisibleHomeMatchPhase): number {
  switch (phase) {
    case "ongoing":
      return 2;
    case "upcoming":
      return 1;
    case "ended":
      return 0;
  }
}

function matchPreference(match: AppMatchPhaseSource, now: Date) {
  const phase = resolveMatchPhase(match, now);
  const timeValue =
    phase === "ended" ? parseDateValue(match.end_time).getTime() : parseDateValue(match.start_time).getTime();

  return {
    phase,
    rank: phase === "excluded" ? -1 : phaseRank(phase),
    timeValue,
  };
}

function shouldKeepCandidate(current: AppMatchPhaseSource, candidate: AppMatchPhaseSource, now: Date): boolean {
  const currentPreference = matchPreference(current, now);
  const candidatePreference = matchPreference(candidate, now);

  if (candidatePreference.rank !== currentPreference.rank) {
    return candidatePreference.rank > currentPreference.rank;
  }

  if (candidatePreference.timeValue !== currentPreference.timeValue) {
    return candidatePreference.timeValue > currentPreference.timeValue;
  }

  return false;
}

function toSignupScope(kind: AppHomeActionMatch["group"]["kind"] | undefined): "external" | "internal" {
  return kind === "individual_opponent" ? "external" : "internal";
}

function toSignupScopeLabel(kind: AppHomeActionMatch["group"]["kind"] | undefined): string {
  switch (kind) {
    case "individual_opponent":
      return "散人报名";
    case "guest_team":
      return "接约报名";
    case "host_team":
    default:
      return "队内报名";
  }
}

function toSignupScopeLabelFromPublicationMode(mode: AppMatchSummary["publication_mode"]): string {
  return mode === "online_individual" ? "散人报名" : "队内报名";
}

function isHomeActionMatch(item: AppHomeActionMatch | AppHomeEndedMatch | AppMatchSummary): item is AppHomeActionMatch {
  return "group" in item;
}

function isMatchSummary(item: AppHomeActionMatch | AppHomeEndedMatch | AppMatchSummary): item is AppMatchSummary {
  return "publication_mode" in item;
}

function toMyStatusLabel(status: AppHomeActionMatch["group"]["my_registration_status"]): string {
  switch (status) {
    case "attending":
      return "参加";
    case "leave":
      return "请假";
    case "absent":
      return "缺席";
    case "cancelled":
      return "取消";
    default:
      return "待定";
  }
}

function toPhaseStage(phase: VisibleHomeMatchPhase): string {
  switch (phase) {
    case "ongoing":
      return "进行中";
    case "ended":
      return "已结束";
    default:
      return "报名中";
  }
}

function toDateNote(phase: VisibleHomeMatchPhase): string {
  switch (phase) {
    case "ongoing":
      return "报名已结束";
    case "ended":
      return "比赛已结束";
    default:
      return "截止报名";
  }
}

function toActionLabel(item: AppHomeActionMatch, phase: VisibleHomeMatchPhase): string {
  if (phase !== "upcoming") return "查看比赛";
  return item.group.status === "open" ? "去报名" : "查看比赛";
}

function toShowRegistrationProgress(phase: VisibleHomeMatchPhase): boolean {
  return phase !== "ended";
}

function toShowParticipantAvatars(phase: VisibleHomeMatchPhase): boolean {
  return phase !== "ended";
}

export function resolveMatchPhase(match: AppMatchPhaseSource, now: Date): AppMatchUiPhase {
  if (match.status === "cancelled") return "excluded";
  if (match.status === "ended") return "ended";

  const nowMs = now.getTime();
  if (parseDateValue(match.end_time).getTime() <= nowMs) return "ended";
  if (parseDateValue(match.start_time).getTime() <= nowMs) return "ongoing";
  return "upcoming";
}

export function groupMatchesByPhase(items: AppMatchPhaseSource[], now: Date): Record<VisibleHomeMatchPhase, AppMatchPhaseSource[]> {
  const grouped: Record<VisibleHomeMatchPhase, AppMatchPhaseSource[]> = {
    upcoming: [],
    ongoing: [],
    ended: [],
  };

  const dedupedById = new Map<string, AppMatchPhaseSource>();
  for (const item of items) {
    const current = dedupedById.get(item.id);
    if (!current || shouldKeepCandidate(current, item, now)) {
      dedupedById.set(item.id, item);
    }
  }

  for (const item of dedupedById.values()) {
    const phase = resolveMatchPhase(item, now);
    if (phase === "excluded") continue;
    grouped[phase].push(item);
  }

  grouped.upcoming.sort((left, right) => compareDateAsc(left.start_time, right.start_time) || left.id.localeCompare(right.id));
  grouped.ongoing.sort((left, right) => compareDateDesc(left.start_time, right.start_time) || left.id.localeCompare(right.id));
  grouped.ended.sort((left, right) => compareDateDesc(left.end_time, right.end_time) || left.id.localeCompare(right.id));

  return grouped;
}

export function toGoHomeMatchCard(
  item: AppHomeActionMatch | AppHomeEndedMatch | AppMatchSummary,
  phase: VisibleHomeMatchPhase,
): HomeMatchCardViewModel {
  const actionMatch = isHomeActionMatch(item) ? item : null;
  const summaryMatch = isMatchSummary(item) ? item : null;
  const attendingCount = actionMatch ? actionMatch.group.attending_count : 0;
  const playersPerTeam = actionMatch ? actionMatch.players_per_team : summaryMatch ? summaryMatch.players_per_team : 0;
  const requiredPlayers = actionMatch ? (actionMatch.group.min_players ?? playersPerTeam) : playersPerTeam;
  const maxPlayers = actionMatch ? (actionMatch.group.max_players ?? requiredPlayers) : playersPerTeam;
  const remainingPlayers = Math.max(requiredPlayers - attendingCount, 0);
  const signupScope = actionMatch
    ? toSignupScope(actionMatch.group.kind)
    : summaryMatch && summaryMatch.publication_mode === "online_individual"
      ? "external"
      : "internal";
  const signupScopeLabel = actionMatch
    ? toSignupScopeLabel(actionMatch.group.kind)
    : summaryMatch
      ? toSignupScopeLabelFromPublicationMode(summaryMatch.publication_mode)
      : "比赛记录";
  const stage = toPhaseStage(phase);
  const dateNote = toDateNote(phase);
  const showRegistrationProgress = actionMatch ? toShowRegistrationProgress(phase) : false;
  const showParticipantAvatars = actionMatch ? toShowParticipantAvatars(phase) : false;
  const canRegister = actionMatch
    ? phase === "upcoming" && actionMatch.group.status === "open"
    : summaryMatch
      ? phase === "upcoming" && summaryMatch.opponent_state === "recruiting" && summaryMatch.publication_mode !== "offline_confirmed"
      : false;
  const myStatus = actionMatch ? toMyStatusLabel(actionMatch.group.my_registration_status) : "待定";
  let highlight: string;
  let remainingPlayersLabel: string;
  if (actionMatch) {
    highlight =
      phase === "upcoming"
        ? remainingPlayers > 0
          ? `当前 ${attendingCount} 人参加，还差 ${remainingPlayers} 人成行`
          : "已达成行人数，仍可继续报名"
        : phase === "ongoing"
          ? "比赛进行中"
          : "比赛已结束";
    remainingPlayersLabel =
      phase === "upcoming"
        ? remainingPlayers > 0
          ? `还差 ${remainingPlayers} 人成行`
          : "已达成行"
        : phase === "ongoing"
          ? "报名已结束"
          : "比赛已结束";
  } else if (summaryMatch) {
    highlight = summaryMatch.description?.trim() || dateNote;
    remainingPlayersLabel = dateNote;
  } else {
    highlight = dateNote;
    remainingPlayersLabel = dateNote;
  }

  return {
    id: item.id,
    detailUrl: `/pages/matches/detail?id=${item.id}`,
    title: item.name,
    dateLabel: formatDateLabel(item.start_time),
    phase,
    dateNote,
    showRegistrationProgress,
    showParticipantAvatars,
    canOpenDetail: true,
    stage,
    signupScope,
    signupScopeLabel,
    venue: item.location,
    opponent: item.opponent_name ?? "待定",
    formatLabel: playersPerTeam > 0 ? `${playersPerTeam} 人制` : "人数待定",
    requiredPlayers,
    maxPlayers,
    joinedPlayers: attendingCount,
    absentPlayers: 0,
    latePlayers: 0,
    pendingPlayers: 0,
    myStatus,
    highlight,
    participantAvatars: [],
    remainingPlayersLabel,
    canRegister,
    actionLabel: phase === "upcoming" && canRegister ? "去报名" : "查看比赛",
  };
}

export function buildHomeMatchSections(
  response: AppMatchHomeResponse,
  now: Date,
  limit = Number.POSITIVE_INFINITY,
): HomeMatchSectionViewModel[] {
  const grouped = groupMatchesByPhase([...response.action_items, ...response.ended_items], now);

  return (["upcoming", "ongoing", "ended"] as const).map((phase) => ({
    phase,
    title: HOME_MATCH_PHASE_TITLES[phase],
    items: grouped[phase].slice(0, limit).map((item) => toGoHomeMatchCard(item as AppHomeActionMatch | AppHomeEndedMatch, phase)),
  }));
}
