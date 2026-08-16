import type { AppMatchRegistrationGroupSummary, AppMatchSummary } from "@/types/match";
import type { NeoTagTone } from "@/types/designSystem";
import { formatDateLabel, pad, parseDateValue } from "@/utils/datetime";
import { resolveInheritedGuestLimit } from "@/utils/matchCapacity";
import { getMatchPublicationModeLabel } from "@/utils/matchPublicationMode";
import { formatHomeMatchDateBlock } from "@/pages/home/homeMatchDate";
import { resolveRegistrationWindow } from "@/utils/registrationWindow";

export type HallMatchKindFilter = "all" | "team" | "individual" | "mine";
export type HallMatchSizeFilter = 0 | 5 | 8;

/** 按钮动作：报名（主队/客队成员）、接约（对方队长）、凑局（散人）、查看（其他）。 */
export type HallCardActionKind = "register" | "accept" | "join" | "view";

export interface HallViewerContext {
  teamId: number | null;
  canManageTeam: boolean;
}

export interface HallMatchCardViewModel {
  id: string;
  detailUrl: string;
  applyUrl: string;
  title: string;
  dateBlock: { monthDay: string; weekday: string; timeLabel: string };
  kindLabel: string;
  kindTone: NeoTagTone;
  opponentStateLabel: string;
  opponentStateTone: NeoTagTone;
  hostTeamName: string;
  hostTeamId: number;
  formatLabel: string;
  venue: string;
  opponentName: string;
  showProgress: boolean;
  progressLabel: string;
  joinedPlayers: number;
  requiredPlayers: number;
  maxPlayers: number;
  hostJoinedLabel: string;
  guestJoinedLabel: string;
  /** 列表进度条：球队约队有客队时为主/客两条，其余单条。 */
  progressBars: Array<{ key: string; label: string; joined: number; required: number; max: number }>;
  actionKind: HallCardActionKind;
  actionLabel: string;
}

export interface HallCalendarDay {
  key: string;
  badgeLabel: string;
  dayNumber: string;
}

const KIND_LABELS: Record<AppMatchSummary["publication_mode"], string> = {
  online_team: "球队约队",
  online_individual: "散人约局",
  offline_confirmed: "线下已约",
};

const KIND_TONES: Record<AppMatchSummary["publication_mode"], NeoTagTone> = {
  online_team: "blue",
  online_individual: "lime",
  offline_confirmed: "muted",
};

function findGroupSummary(
  match: AppMatchSummary,
  kind: AppMatchRegistrationGroupSummary["kind"],
): AppMatchRegistrationGroupSummary | undefined {
  return match.registration_groups?.find((group) => group.kind === kind);
}

function toOpponentStateLabel(match: AppMatchSummary): { label: string; tone: NeoTagTone } {
  if (match.publication_mode === "online_individual") {
    return match.opponent_state === "confirmed"
      ? { label: "已成局", tone: "green" }
      : { label: "凑人中", tone: "amber" };
  }
  return match.opponent_state === "confirmed"
    ? { label: "对手已确认", tone: "green" }
    : { label: "招对手中", tone: "amber" };
}

const DEFAULT_VIEWER: HallViewerContext = { teamId: null, canManageTeam: false };

function resolveActionKind(match: AppMatchSummary, viewer: HallViewerContext, now: number): HallCardActionKind {
  const registrationWindow = resolveRegistrationWindow({
    now,
    isRegistering: match.status === "registering",
    registrationStartAt: match.registration_start_at,
    registrationEndAt: match.registration_end_at,
  });
  if (registrationWindow.state !== "open") return "view";
  if (match.publication_mode === "online_individual") {
    return match.opponent_state === "confirmed" ? "view" : "join";
  }
  if (match.publication_mode === "online_team") {
    // 主队和已确认客队的成员都视为“与我们球队相关”，直接去详情页报名。
    const isViewerTeamInvolved = viewer.teamId !== null
      && (viewer.teamId === match.host_team_id || viewer.teamId === match.away_team_id);
    if (isViewerTeamInvolved) {
      return "register";
    }
    if (match.opponent_state === "recruiting" && viewer.canManageTeam) {
      return "accept";
    }
    return "view";
  }
  return "view";
}

const ACTION_LABELS: Record<HallCardActionKind, string> = {
  register: "去报名",
  accept: "去接约",
  join: "去凑局",
  view: "查看比赛",
};

export function toHallMatchCard(
  match: AppMatchSummary,
  viewer: HallViewerContext = DEFAULT_VIEWER,
  now = Date.now(),
): HallMatchCardViewModel {
  const dateLabel = formatDateLabel(match.start_time);
  const opponentState = toOpponentStateLabel(match);
  const individualGroup = findGroupSummary(match, "individual_opponent");
  const hostGroup = findGroupSummary(match, "host_team");

  const isIndividual = match.publication_mode === "online_individual";
  const progressGroup = isIndividual ? individualGroup : hostGroup;
  const requiredPlayers = isIndividual
    ? (individualGroup?.min_players ?? match.players_per_team)
    : (hostGroup?.max_players ?? match.players_per_team);
  const maxPlayers = progressGroup?.max_players ?? requiredPlayers;
  const joinedPlayers = progressGroup?.attending_count ?? 0;

  const hostMax = hostGroup?.max_players;
  const hostJoinedLabel =
    !isIndividual && hostGroup && hostMax
      ? `主队 ${hostGroup.attending_count}/${hostMax}`
      : "";

  // 客队进度与主队并列展示；上限未配置时继承主队（主客同制）。
  const guestGroup = findGroupSummary(match, "guest_team");
  const guestMax = resolveInheritedGuestLimit(hostMax, guestGroup?.max_players);
  const guestJoinedLabel =
    !isIndividual && guestGroup && guestMax
      ? `客队 ${guestGroup.attending_count}/${guestMax}`
      : "";

  // 有客队分组时渲染主/客两条进度条（与详情页一致）；否则保持单条进度。
  const progressBars = !isIndividual && guestGroup && guestMax
    ? [
        {
          key: "host",
          label: match.host_team_name || "主队",
          joined: hostGroup?.attending_count ?? 0,
          required: hostMax ?? match.players_per_team,
          max: hostMax ?? match.players_per_team,
        },
        {
          key: "guest",
          label: match.away_team_name || "客队",
          joined: guestGroup.attending_count,
          required: guestMax,
          max: guestMax,
        },
      ]
    : [
        {
          key: "main",
          label: isIndividual ? "凑人进度" : "报名进度",
          joined: joinedPlayers,
          required: requiredPlayers,
          max: maxPlayers,
        },
      ];

  const actionKind = resolveActionKind(match, viewer, now);

  return {
    id: match.id,
    detailUrl: `/pages/matches/detail?id=${match.id}`,
    applyUrl: `/pages/matches/apply-team/index?id=${match.id}`,
    title: match.name,
    dateBlock: formatHomeMatchDateBlock({ dateLabel, dateSource: match.start_time }),
    kindLabel: KIND_LABELS[match.publication_mode] ?? getMatchPublicationModeLabel(match.publication_mode),
    kindTone: KIND_TONES[match.publication_mode] ?? "muted",
    opponentStateLabel: opponentState.label,
    opponentStateTone: opponentState.tone,
    hostTeamName: match.host_team_name,
    hostTeamId: match.host_team_id,
    formatLabel: match.players_per_team > 0 ? `${match.players_per_team} 人制` : "人数待定",
    venue: match.location,
    opponentName: match.away_team_name ?? match.opponent_name ?? "待定",
    showProgress: !!progressGroup,
    progressLabel: isIndividual ? "凑人进度" : "报名进度",
    joinedPlayers,
    requiredPlayers,
    maxPlayers,
    hostJoinedLabel,
    guestJoinedLabel,
    progressBars,
    actionKind,
    actionLabel: ACTION_LABELS[actionKind],
  };
}

export function filterHallMatches(
  cards: HallMatchCardViewModel[],
  source: AppMatchSummary[],
  kind: HallMatchKindFilter,
  size: HallMatchSizeFilter,
): HallMatchCardViewModel[] {
  const sourceById = new Map(source.map((match) => [match.id, match]));
  return cards.filter((card) => {
    const match = sourceById.get(card.id);
    if (!match) return false;
    if (kind === "team" && match.publication_mode !== "online_team") return false;
    if (kind === "individual" && match.publication_mode !== "online_individual") return false;
    if (size && match.players_per_team !== size) return false;
    return true;
  });
}

export function buildHallCalendarDays(now: Date, dayCount = 7): HallCalendarDay[] {
  const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      key,
      badgeLabel: index === 0 ? "今天" : weekdayLabels[date.getDay()] ?? "",
      dayNumber: String(date.getDate()).padStart(2, "0"),
    };
  });
}

export function hallDateKey(isoText: string): string {
  const date = parseDateValue(isoText);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// date_start 语义：所选日期本地零点的时刻（序列化为 UTC 后由后端按 24 小时窗口过滤）。
export function toLocalMidnightDate(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
