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

export function clampTeamRegistrationCount(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.round(value), 5), 11);
}

export function buildRegistrationProgress(joinedCount: number, requiredPlayers: number) {
  const threshold = Math.max(requiredPlayers, 1);
  const overflow = Math.max(joinedCount - threshold, 0);
  const splitPercent = 82;
  const overflowVisualWidth = overflow > 0 ? Math.min(6 + overflow * 5, 100 - splitPercent) : 0;
  const baseWidth = Math.min((joinedCount / threshold) * splitPercent, splitPercent);

  return {
    baseWidth: `${baseWidth}%`,
    extraWidth: `${overflowVisualWidth}%`,
    splitLeft: `${splitPercent}%`,
  };
}

export function buildRemainingPlayersLabel(joinedCount: number, requiredPlayers: number) {
  if (!requiredPlayers) return "人数待定";
  const left = Math.max(requiredPlayers - joinedCount, 0);
  return left > 0 ? `还差 ${left} 人成行` : "已达成行人数";
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
