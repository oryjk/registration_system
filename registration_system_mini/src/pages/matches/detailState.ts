import type { BackendActivity, BackendActivityCheckInRecord, BackendRegistration, BackendTeamMember, BackendUser } from "@/types/backend";
import {
  describeDaysUntil,
  formatCountdown,
  formatMonthDayLabel,
  formatTimeLabel,
  formatWeekdayLabel,
  pad,
  parseDateValue,
} from "@/utils/datetime";
import { resolveUserDisplayName } from "@/utils/viewModels";

export { describeDaysUntil, formatCountdown, pad, parseDateValue };
export { resolveRegistrationWindow } from "@/utils/registrationWindow";

export const formatMonthDay = formatMonthDayLabel;
export const formatClock = formatTimeLabel;
export const formatWeekday = formatWeekdayLabel;

export function isActiveTeamRegistrationActivity(activity: BackendActivity) {
  return !!activity.source_activity_id && activity.status !== 3;
}

export function avatarColor(userId: number) {
  const palette = ["#111111", "#1b55ff", "#0f766e", "#8b5cf6", "#ea580c", "#16a34a", "#be123c"];
  return palette[userId % palette.length];
}

export function byUserIdAsc(left: { user_id: number }, right: { user_id: number }) {
  return left.user_id - right.user_id;
}

function registrationTimestamp(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = parseDateValue(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export function byRegistrationTimeAsc(
  left: { user_id: number; operation_time?: string | null },
  right: { user_id: number; operation_time?: string | null },
) {
  const timeDiff = registrationTimestamp(left.operation_time) - registrationTimestamp(right.operation_time);
  return timeDiff || byUserIdAsc(left, right);
}

export interface TeamMemberRegistrationCard {
  userId: number;
  name: string;
  avatarUrl: string;
  tone: string;
  jerseyNumber: string;
  isCurrentUser: boolean;
}

export function buildTeamMemberRegistrationGroups({
  members,
  registrations,
  usersById,
  currentUserId,
}: {
  members: BackendTeamMember[];
  registrations: BackendRegistration[];
  usersById: Record<number, BackendUser>;
  currentUserId?: number;
}): {
  joined: TeamMemberRegistrationCard[];
  leave: TeamMemberRegistrationCard[];
  pending: TeamMemberRegistrationCard[];
} {
  const registrationByUserId = new Map(registrations.map((item) => [item.user_id, item]));
  const byMemberRegistrationTimeAsc = (left: BackendTeamMember, right: BackendTeamMember) =>
    byRegistrationTimeAsc(
      { user_id: left.user_id, operation_time: registrationByUserId.get(left.user_id)?.operation_time },
      { user_id: right.user_id, operation_time: registrationByUserId.get(right.user_id)?.operation_time },
    );

  const toCard = (member: BackendTeamMember): TeamMemberRegistrationCard => {
    const user = usersById[member.user_id];
    // 新比赛接口的 usersById 只含报名参与者，未报名队员的昵称/头像回退到球队成员自带资料。
    const name = user
      ? resolveUserDisplayName(user)
      : member.real_name || member.nickname || `用户 ${member.user_id}`;
    return {
      userId: member.user_id,
      name,
      avatarUrl: user?.avatar_url || member.avatar_url || "",
      tone: avatarColor(member.user_id),
      jerseyNumber: member.jersey_number ?? "",
      isCurrentUser: member.user_id === currentUserId,
    };
  };

  const withStand = (stand: number) => members
    .filter((member) => registrationByUserId.get(member.user_id)?.stand === stand)
    .sort(byMemberRegistrationTimeAsc)
    .map(toCard);

  return {
    joined: withStand(1),
    leave: withStand(2),
    pending: members
      .filter((member) => {
        const stand = registrationByUserId.get(member.user_id)?.stand ?? 0;
        return stand !== 1 && stand !== 2;
      })
      .sort(byUserIdAsc)
      .map(toCard),
  };
}

export function clampTeamRegistrationCount(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.round(value), 5), 11);
}

export function buildRegistrationProgress(joinedCount: number, requiredPlayers: number, maxPlayers?: number) {
  const target = Math.max(Number.isFinite(requiredPlayers) ? requiredPlayers : 0, 0);
  const max = Math.max(
    Number.isFinite(maxPlayers) ? maxPlayers ?? target : target,
    target,
    1,
  );
  const value = Math.max(Number.isFinite(joinedCount) ? joinedCount : 0, 0);
  const baseWidth = Math.min((Math.min(value, target) / max) * 100, 100);
  const extraWidth = Math.min((Math.max(value - target, 0) / max) * 100, 100);

  return {
    baseWidth: `${baseWidth}%`,
    extraWidth: `${extraWidth}%`,
    splitLeft: `${Math.min((target / max) * 100, 100)}%`,
  };
}

export function buildRemainingPlayersLabel(joinedCount: number, requiredPlayers: number) {
  if (!requiredPlayers) return "人数待定";
  const left = Math.max(requiredPlayers - joinedCount, 0);
  return left > 0 ? `还差 ${left} 人成行` : "已达成行人数";
}

export function resolveRegistrationCapacityState({
  joinedCount,
  teamCapacityLimit,
  currentStatus,
}: {
  joinedCount: number;
  teamCapacityLimit?: number | null;
  currentStatus: string;
}) {
  const capacity = typeof teamCapacityLimit === "number" && Number.isFinite(teamCapacityLimit) && teamCapacityLimit > 0
    ? teamCapacityLimit
    : null;
  const isAlreadyJoined = currentStatus === "参加";
  const isFull = capacity !== null && joinedCount >= capacity && !isAlreadyJoined;

  return {
    capacity,
    isFull,
    label: capacity === null ? "" : `报名上限 ${capacity} 人`,
  };
}

export function applyIndividualRegistrationPatch(
  registrations: BackendRegistration[],
  userId: number,
  stand: number,
  registrationCount: number,
  operationTime = new Date().toISOString(),
) {
  const existing = registrations.find((item) => item.user_id === userId);
  if (existing) {
    return registrations.map((item) =>
      item.user_id === userId
        ? {
            ...item,
            stand,
            registration_count: registrationCount,
            operation_time: operationTime,
          }
        : item,
    );
  }

  return [
    ...registrations,
    {
      user_id: userId,
      stand,
      registration_count: registrationCount,
      paid: 0,
      operation_time: operationTime,
    },
  ];
}

export function applyCheckInPatch(
  registrations: BackendRegistration[],
  record: BackendActivityCheckInRecord,
) {
  return registrations.map((item) =>
    item.user_id === record.user_id
      ? {
          ...item,
          checked_in_at: record.checked_in_at,
          checkin_distance_meters: record.distance_meters,
        }
      : item,
  );
}
