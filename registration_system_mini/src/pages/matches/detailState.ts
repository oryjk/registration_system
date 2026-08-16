import type { BackendActivity, BackendActivityCheckInRecord, BackendRegistration } from "@/types/backend";
import {
  describeDaysUntil,
  formatCountdown,
  formatMonthDayLabel,
  formatTimeLabel,
  formatWeekdayLabel,
  pad,
  parseDateValue,
} from "@/utils/datetime";

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
