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
import { getMatchPublicationModeLabel } from "@/utils/matchPublicationMode";
import { attendanceStatusTone } from "@/utils/statusTone";
import { avatarTone } from "@/utils/viewModels/common";
import { formatHomeMatchDateBlock } from "./homeMatchDate";

type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

export interface HomeMatchSectionViewModel {
  phase: VisibleHomeMatchPhase;
  title: string;
  items: HomeMatchCardViewModel[];
}

const HOME_MATCH_PHASE_TITLES: Record<VisibleHomeMatchPhase, string> = {
  upcoming: "最近要处理",
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
  const timeValue = phase === "ended"
    ? parseDateValue(match.end_time).getTime()
    : parseDateValue(match.start_time).getTime();

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

function isHomeActionMatch(item: HomeMatchCardSource): item is AppHomeActionMatch {
  return "group" in item;
}

function isMatchSummary(item: HomeMatchCardSource): item is AppMatchSummary {
  return "opponent_state" in item;
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

function toStageTone(phase: VisibleHomeMatchPhase): HomeMatchCardViewModel["stageTone"] {
  switch (phase) {
    case "ongoing":
      return "blue";
    case "ended":
      return "muted";
    default:
      return "lime";
  }
}

function toStatusTone(status: string): HomeMatchCardViewModel["statusTone"] {
  switch (attendanceStatusTone(status)) {
    case "join":
      return "green";
    case "late":
      return "amber";
    case "pending":
      return "blue";
    default:
      return "muted";
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
  if (match.status === "ongoing") return "ongoing";
  if (parseDateValue(match.start_time).getTime() <= nowMs) return "ongoing";
  return "upcoming";
}

type HomeMatchCardSource = AppHomeActionMatch | AppHomeEndedMatch | AppMatchSummary;

export function toHomeMatchCard(
  item: HomeMatchCardSource,
  phase: VisibleHomeMatchPhase,
): HomeMatchCardViewModel {
  const actionMatch = isHomeActionMatch(item) ? item : null;
  const summaryMatch = isMatchSummary(item) ? item : null;
  const attendingCount = actionMatch ? actionMatch.group.attending_count : 0;
  const playersPerTeam = "players_per_team" in item ? item.players_per_team : 0;
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
  const sourceParticipants =
    actionMatch?.group.participants ?? ("participants" in item ? item.participants : undefined);
  const participantAvatars = (sourceParticipants ?? []).map((participant) => ({
    userId: participant.user_id,
    avatarUrl: participant.avatar_url ?? "",
    displayText: (participant.nickname || `U${participant.user_id}`).slice(0, 1),
    tone: avatarTone(participant.user_id),
  }));
  // 已结束的首页比赛也保留头像行：无人报名时由卡片渲染占位符，保持卡片视觉一致。
  const showParticipantAvatars = actionMatch
    ? toShowParticipantAvatars(phase)
    : summaryMatch
      ? false
      : true;
  const canRegister = actionMatch
    ? phase === "upcoming" && actionMatch.group.status === "open"
    : summaryMatch
      ? phase === "upcoming" && summaryMatch.opponent_state === "recruiting" && summaryMatch.publication_mode !== "offline_confirmed"
      : false;
  // 广场/搜索等 summary 来源不含我的报名状态，显示「待定」会误导，置 null 由卡片隐藏。
  const myStatus: string | null = actionMatch ? toMyStatusLabel(actionMatch.group.my_registration_status) : null;
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

  const dateLabel = formatDateLabel(item.start_time);

  return {
    id: item.id,
    detailUrl: actionMatch
      ? `/pages/matches/detail?id=${item.id}&groupId=${actionMatch.group.id}`
      : `/pages/matches/detail?id=${item.id}`,
    title: item.name,
    dateLabel,
    dateSource: item.start_time,
    dateBlock: formatHomeMatchDateBlock({ dateLabel, dateSource: item.start_time }),
    phase,
    dateNote,
    showRegistrationProgress,
    showParticipantAvatars,
    canOpenDetail: true,
    stage,
    stageTone: toStageTone(phase),
    statusTone: myStatus ? toStatusTone(myStatus) : "muted",
    publicationModeLabel: getMatchPublicationModeLabel(item.publication_mode),
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
    participantAvatars,
    remainingPlayersLabel,
    canRegister,
    actionLabel: phase === "upcoming" && canRegister ? "去报名" : "查看比赛",
  };
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
    if (phase !== "excluded") grouped[phase].push(item);
  }

  grouped.upcoming.sort((left, right) => compareDateAsc(left.start_time, right.start_time) || left.id.localeCompare(right.id));
  grouped.ongoing.sort((left, right) => compareDateDesc(left.start_time, right.start_time) || left.id.localeCompare(right.id));
  grouped.ended.sort((left, right) => compareDateDesc(left.end_time, right.end_time) || left.id.localeCompare(right.id));

  return grouped;
}

export function buildHomeMatchSections(
  response: AppMatchHomeResponse,
  now: Date,
  limit = Number.POSITIVE_INFINITY,
): HomeMatchSectionViewModel[] {
  const grouped = groupMatchesByPhase([...response.action_items, ...response.ended_items], now);

  return (['upcoming', 'ongoing', 'ended'] as const).map((phase) => ({
    phase,
    title: HOME_MATCH_PHASE_TITLES[phase],
    items: grouped[phase]
      .slice(0, limit)
      .map((item) => toHomeMatchCard(item as AppHomeActionMatch | AppHomeEndedMatch, phase)),
  }));
}
