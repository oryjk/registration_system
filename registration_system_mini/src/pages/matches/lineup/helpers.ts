import type { AppMatchDetailResponse, AppMatchGroupDetail, AppMatchParticipant, AppMatchSummary } from "@/types/match";
import type {
  CurrentUserLineupRole,
  LineupCandidate,
  MatchLineupPlayer,
  MatchLineupSlot,
  PitchSlotView,
} from "@/types/lineup";
import { activeVenueSides } from "../venueSideState";
import { getDefaultFormation, getFormation, normalizePlayersPerTeam, type FormationSlot } from "./formations";

/** 位移小于此值（rpx）视为点击。 */
export const TAP_THRESHOLD_RPX = 10;
/** 松手点与另一圆点中心距离小于直径 * 此比例视为互换。 */
export const SWAP_DISTANCE_RATIO = 0.6;
/** 自由拖拽坐标安全范围。 */
export const COORD_MIN = 0.06;
export const COORD_MAX = 0.94;

const UUID_DASHED_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;

export function clampCoord(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Number(Math.min(COORD_MAX, Math.max(COORD_MIN, value)).toFixed(4));
}

/** 将 32 位无横杠 UUID 还原为标准带横杠 UUID；已是标准 UUID 则规范为小写。 */
export function restoreUuidFromScene(raw: string): string {
  const cleaned = raw.trim();
  if (UUID_DASHED_PATTERN.test(cleaned)) return cleaned.toLowerCase();
  if (UUID_COMPACT_PATTERN.test(cleaned)) {
    const hex = cleaned.toLowerCase();
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "";
}

/** 解析页面入参：优先 matchId / id，兼容小程序码 scene（32 位无横杠 UUID）。 */
export function parseLineupMatchId(options: Record<string, unknown> | undefined): string {
  if (!options) return "";
  for (const key of ["matchId", "id", "scene"] as const) {
    const raw = options[key];
    if (raw === undefined || raw === null) continue;
    let decoded = String(raw).trim();
    try {
      decoded = decodeURIComponent(decoded).trim();
    } catch {
      // 保留原始文本继续尝试解析
    }
    const uuid = restoreUuidFromScene(decoded);
    if (uuid) return uuid;
  }
  return "";
}

/**
 * 与 src/pages/matches/detail.vue 中 canEditMatch 口径完全一致：
 * - status !== 'ended' && status !== 'cancelled' 且非游客态；
 * - online_pickup / venue_hosted：created_by_user_id === currentUserId；
 * - 其余球队比赛：host_team_id 匹配当前球队且当前用户在该队有管理权（canManageTeam）。
 */
export function canEditMatchLineup(params: {
  match: Pick<AppMatchSummary, "status" | "publication_mode" | "created_by_user_id" | "host_team_id"> | null;
  isGuestMode: boolean;
  currentUserId: number | null | undefined;
  currentTeam: { id: number; canManageTeam?: boolean } | null | undefined;
}): boolean {
  const source = params.match;
  if (!source || params.isGuestMode || source.status === "ended" || source.status === "cancelled") {
    return false;
  }
  if (source.publication_mode === "online_pickup" || source.publication_mode === "venue_hosted") {
    return !!params.currentUserId && source.created_by_user_id === params.currentUserId;
  }
  return (
    !!source.host_team_id
    && params.currentTeam?.id === source.host_team_id
    && !!params.currentTeam?.canManageTeam
  );
}

/** 从比赛详情中提取本场已报名参加（attending）的成员列表，按报名先后升序去重。 */
export function collectAttendingParticipants(
  detail: AppMatchDetailResponse,
  currentTeamId?: number | null,
): LineupCandidate[] {
  const match = detail.match;
  const groups: AppMatchGroupDetail[] =
    match.publication_mode === "venue_hosted" ? activeVenueSides(detail.groups) : detail.groups;

  let targetGroups: AppMatchGroupDetail[] = [];
  if (match.publication_mode === "online_pickup" || match.publication_mode === "venue_hosted") {
    targetGroups = groups;
  } else {
    const hostGroup =
      groups.find((g) => g.kind === "host_team" && (!match.host_team_id || g.team_id === match.host_team_id))
      ?? groups.find((g) => g.kind === "host_team")
      ?? (currentTeamId ? groups.find((g) => g.team_id === currentTeamId) : undefined)
      ?? groups[0];
    if (hostGroup) targetGroups = [hostGroup];
  }

  const rawParticipants: AppMatchParticipant[] = [];
  for (const group of targetGroups) {
    for (const participant of group.participants ?? []) {
      if (participant.status === "attending" && participant.user_id > 0) {
        rawParticipants.push(participant);
      }
    }
  }

  rawParticipants.sort((a, b) => {
    const ta = a.registered_at ? Date.parse(a.registered_at) : Number.MAX_SAFE_INTEGER;
    const tb = b.registered_at ? Date.parse(b.registered_at) : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.user_id - b.user_id;
  });

  const seen = new Set<number>();
  const result: LineupCandidate[] = [];
  for (const item of rawParticipants) {
    if (seen.has(item.user_id)) continue;
    seen.add(item.user_id);
    result.push({
      user_id: item.user_id,
      nickname: item.nickname?.trim() || `队员${item.user_id}`,
      avatar_url: item.avatar_url ?? null,
      source: "attending",
    });
  }
  return result;
}

export function createDefaultSlots(
  playersPerTeam: number | null | undefined,
  formation?: string,
): MatchLineupSlot[] {
  return getFormation(playersPerTeam, formation).map((item) => ({
    slot: item.slot,
    player_id: null,
    x: item.x,
    y: item.y,
    sub_player_ids: [],
  }));
}

/**
 * 首次进入编辑（后端尚无已保存阵型）：
 * 按顺序把本场已报名参加的人员填入首发槽位，人数不足则剩余槽位保留为默认占位（player_id: null）。
 */
export function buildInitialLineupFromAttending(
  playersPerTeam: number | null | undefined,
  formation: string | undefined,
  attendingUserIds: number[],
): MatchLineupSlot[] {
  const uniqueIds = Array.from(new Set(attendingUserIds.filter((id) => Number.isInteger(id) && id > 0)));
  return createDefaultSlots(playersPerTeam, formation).map((slot, index) => ({
    ...slot,
    player_id: uniqueIds[index] ?? null,
    sub_player_ids: [],
  }));
}

/** 规范化后端返回的槽位数组，确保长度、槽位索引、坐标及全局去重合法。 */
export function normalizeLoadedSlots(
  savedSlots: MatchLineupSlot[] | null | undefined,
  playersPerTeam: number | null | undefined,
  formation: string | undefined,
): MatchLineupSlot[] {
  const size = normalizePlayersPerTeam(playersPerTeam);
  const defaults = getFormation(size, formation ?? getDefaultFormation(size));
  const bySlot = new Map<number, MatchLineupSlot>();
  for (const item of savedSlots ?? []) {
    if (Number.isInteger(item.slot) && item.slot >= 0 && item.slot < size) {
      bySlot.set(item.slot, item);
    }
  }
  const used = new Set<number>();
  const normalized: MatchLineupSlot[] = defaults.map((def) => {
    const saved = bySlot.get(def.slot);
    let starterId: number | null =
      saved?.player_id && Number.isInteger(saved.player_id) && saved.player_id > 0 ? saved.player_id : null;
    if (starterId !== null && used.has(starterId)) {
      starterId = null;
    }
    if (starterId !== null) used.add(starterId);
    return {
      slot: def.slot,
      player_id: starterId,
      x: saved && Number.isFinite(saved.x) ? clampCoord(saved.x) : def.x,
      y: saved && Number.isFinite(saved.y) ? clampCoord(saved.y) : def.y,
      sub_player_ids: [],
    };
  });

  // 第二轮填充替补，保证替补不与任何主力或其他替补重复
  return normalized.map((entry) => {
    const saved = bySlot.get(entry.slot);
    const subs: number[] = [];
    for (const subId of saved?.sub_player_ids ?? []) {
      if (Number.isInteger(subId) && subId > 0 && !used.has(subId)) {
        used.add(subId);
        subs.push(subId);
      }
    }
    return { ...entry, sub_player_ids: subs };
  });
}

/**
 * 为指定槽位指定主力（playerId 为 null 表示清除为默认占位）：
 * - 若该队员已是另一位置的主力：两位置主力互换；
 * - 若该队员是某位置的替补：自动从原替补位迁出并设为本位主力；
 * - 保证整套阵型无重复 user_id。
 */
export function assignStarter(
  slots: MatchLineupSlot[],
  slotIndex: number,
  playerId: number | null,
): MatchLineupSlot[] {
  const target = slots.find((item) => item.slot === slotIndex);
  if (!target) return slots;
  if (playerId === null) {
    return slots.map((item) => (item.slot === slotIndex ? { ...item, player_id: null } : item));
  }
  if (target.player_id === playerId) return slots;

  const starterOrigin = slots.find((item) => item.player_id === playerId);
  return slots.map((item) => {
    const filteredSubs = item.sub_player_ids.filter((id) => id !== playerId);
    if (item.slot === slotIndex) {
      return { ...item, player_id: playerId, sub_player_ids: filteredSubs };
    }
    if (starterOrigin && item.slot === starterOrigin.slot) {
      return { ...item, player_id: target.player_id, sub_player_ids: filteredSubs };
    }
    return filteredSubs.length === item.sub_player_ids.length
      ? item
      : { ...item, sub_player_ids: filteredSubs };
  });
}

/**
 * 勾选/取消指定槽位的替补队员：
 * - 已在该槽位替补列表中 -> 取消；
 * - 未在该槽位替补列表中 -> 若他原本是其他位置替补或某位置主力，自动迁出原身份再加入本位替补。
 */
export function toggleSubPlayer(
  slots: MatchLineupSlot[],
  slotIndex: number,
  playerId: number,
): MatchLineupSlot[] {
  const target = slots.find((item) => item.slot === slotIndex);
  if (!target || !Number.isInteger(playerId) || playerId <= 0) return slots;

  if (target.sub_player_ids.includes(playerId)) {
    return slots.map((item) =>
      item.slot === slotIndex
        ? { ...item, sub_player_ids: item.sub_player_ids.filter((id) => id !== playerId) }
        : item,
    );
  }

  return slots.map((item) => {
    const nextStarter = item.player_id === playerId ? null : item.player_id;
    const filteredSubs = item.sub_player_ids.filter((id) => id !== playerId);
    if (item.slot === slotIndex) {
      return {
        ...item,
        player_id: nextStarter,
        sub_player_ids: [...filteredSubs, playerId],
      };
    }
    return {
      ...item,
      player_id: nextStarter,
      sub_player_ids: filteredSubs,
    };
  });
}

export function removeSubPlayer(
  slots: MatchLineupSlot[],
  slotIndex: number,
  playerId: number,
): MatchLineupSlot[] {
  return slots.map((item) =>
    item.slot === slotIndex
      ? { ...item, sub_player_ids: item.sub_player_ids.filter((id) => id !== playerId) }
      : item,
  );
}

/** 切换同人制下的阵型：保留各槽位主力与替补，所有坐标重置为新阵型默认站位。 */
export function switchFormation(
  slots: MatchLineupSlot[],
  playersPerTeam: number | null | undefined,
  nextFormation: string,
): MatchLineupSlot[] {
  const defaults = getFormation(playersPerTeam, nextFormation);
  const bySlot = new Map(slots.map((item) => [item.slot, item]));
  return defaults.map((def) => {
    const existing = bySlot.get(def.slot);
    return {
      slot: def.slot,
      player_id: existing?.player_id ?? null,
      x: def.x,
      y: def.y,
      sub_player_ids: existing ? [...existing.sub_player_ids] : [],
    };
  });
}

/** 重置站位：恢复当前阵型默认坐标，主力与替补关系保持不变。 */
export function resetPositions(
  slots: MatchLineupSlot[],
  playersPerTeam: number | null | undefined,
  formation: string,
): MatchLineupSlot[] {
  const defaults = new Map(getFormation(playersPerTeam, formation).map((item) => [item.slot, item]));
  return slots.map((item) => {
    const def = defaults.get(item.slot);
    return {
      ...item,
      x: def ? def.x : item.x,
      y: def ? def.y : item.y,
    };
  });
}

export type DragOutcome =
  | { kind: "tap" }
  | { kind: "swap"; withSlot: number }
  | { kind: "move"; x: number; y: number };

/**
 * 球场拖拽释放判定（所有像素坐标均已换算为相对球场左上角的圆点中心 rpx）：
 * - 位移 < 10rpx -> 点击；
 * - 落点离另一位置中心 < 圆点直径 * 0.6 -> 互换最近者；
 * - 否则自由微调（钳制在 0.06..0.94）。
 */
export function resolveDragRelease(input: {
  slot: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  areaWidthRpx: number;
  areaHeightRpx: number;
  dotDiameterRpx: number;
  slots: Pick<MatchLineupSlot, "slot" | "x" | "y">[];
}): DragOutcome {
  const { slot, fromX, fromY, toX, toY, areaWidthRpx, areaHeightRpx, dotDiameterRpx, slots } = input;
  if (Math.hypot(toX - fromX, toY - fromY) < TAP_THRESHOLD_RPX) {
    return { kind: "tap" };
  }

  const reach = dotDiameterRpx * SWAP_DISTANCE_RATIO;
  let nearest: { slot: number; distance: number } | null = null;
  for (const other of slots) {
    if (other.slot === slot) continue;
    const distance = Math.hypot(toX - other.x * areaWidthRpx, toY - other.y * areaHeightRpx);
    if (distance < reach && (!nearest || distance < nearest.distance)) {
      nearest = { slot: other.slot, distance };
    }
  }
  if (nearest) return { kind: "swap", withSlot: nearest.slot };

  return {
    kind: "move",
    x: clampCoord(areaWidthRpx > 0 ? toX / areaWidthRpx : 0.5),
    y: clampCoord(areaHeightRpx > 0 ? toY / areaHeightRpx : 0.5),
  };
}

/** 互换仅交换两个位置的主力球员并保持各自位置坐标与位置替补；移动只改坐标。 */
export function applyDragOutcome(
  slots: MatchLineupSlot[],
  slot: number,
  outcome: DragOutcome,
): MatchLineupSlot[] {
  if (outcome.kind === "tap") return slots;
  if (outcome.kind === "move") {
    return slots.map((item) => (item.slot === slot ? { ...item, x: outcome.x, y: outcome.y } : item));
  }
  const source = slots.find((item) => item.slot === slot);
  const target = slots.find((item) => item.slot === outcome.withSlot);
  if (!source || !target) return slots;
  return slots.map((item) => {
    if (item.slot === source.slot) return { ...item, player_id: target.player_id };
    if (item.slot === target.slot) return { ...item, player_id: source.player_id };
    return item;
  });
}

export function buildPitchSlots(
  slots: MatchLineupSlot[],
  formationSlots: FormationSlot[],
  playersById: Record<number, MatchLineupPlayer>,
): PitchSlotView[] {
  const bySlot = new Map(slots.map((item) => [item.slot, item]));
  return formationSlots.map((def) => {
    const slot = bySlot.get(def.slot);
    const starter =
      slot?.player_id !== null && slot?.player_id !== undefined
        ? (playersById[slot.player_id] ?? {
            user_id: slot.player_id,
            nickname: `队员${slot.player_id}`,
            avatar_url: null,
          })
        : null;
    const subs = (slot?.sub_player_ids ?? []).map(
      (id) =>
        playersById[id] ?? {
          user_id: id,
          nickname: `队员${id}`,
          avatar_url: null,
        },
    );
    return {
      slot: def.slot,
      position: def.position,
      label: def.label,
      x: slot ? slot.x : def.x,
      y: slot ? slot.y : def.y,
      starter,
      subs,
    };
  });
}

/** 过滤出尚未被安排为主力或替补的本场已报名队员。 */
export function getUnassignedAttending(
  slots: MatchLineupSlot[],
  attending: LineupCandidate[],
): LineupCandidate[] {
  const assigned = new Set<number>();
  for (const item of slots) {
    if (item.player_id !== null) assigned.add(item.player_id);
    for (const subId of item.sub_player_ids) assigned.add(subId);
  }
  return attending.filter((player) => !assigned.has(player.user_id));
}

/** 查找当前登录用户在阵型中的身份（主力或某位置替补），用于显著个人提示条。 */
export function findCurrentUserRole(
  pitchSlots: PitchSlotView[],
  currentUserId: number | null | undefined,
): CurrentUserLineupRole | null {
  if (!currentUserId) return null;
  for (const entry of pitchSlots) {
    if (entry.starter?.user_id === currentUserId) {
      return {
        kind: "starter",
        slot: entry.slot,
        label: entry.label,
        subs: entry.subs,
      };
    }
  }
  for (const entry of pitchSlots) {
    if (entry.subs.some((sub) => sub.user_id === currentUserId)) {
      return {
        kind: "sub",
        slot: entry.slot,
        label: entry.label,
        starter: entry.starter,
      };
    }
  }
  return null;
}

/** 查找任意球员当前在阵型中的位置说明（供选人弹层提示）。 */
export function describePlayerAssignment(
  pitchSlots: PitchSlotView[],
  userId: number,
  excludeSlot?: number,
): string {
  for (const entry of pitchSlots) {
    if (entry.starter?.user_id === userId) {
      return entry.slot === excludeSlot ? "当前主力" : `${entry.label}主力`;
    }
    if (entry.subs.some((sub) => sub.user_id === userId)) {
      return entry.slot === excludeSlot ? "本位替补" : `${entry.label}替补`;
    }
  }
  return "";
}

/** 球场圆点下方的替补短文案：1 人展示 `替: 张三`，多人展示 `替×N`。 */
export function formatSubBadgeText(subs: MatchLineupPlayer[]): string {
  if (!subs.length) return "";
  if (subs.length === 1) {
    const chars = Array.from(subs[0].nickname.trim() || "替补");
    const clipped = chars.length > 4 ? `${chars.slice(0, 3).join("")}…` : chars.join("");
    return `替:${clipped}`;
  }
  return `替×${subs.length}`;
}

export function avatarInitial(nickname: string | null | undefined): string {
  const trimmed = (nickname ?? "").trim();
  return trimmed ? Array.from(trimmed)[0]! : "球";
}
