import type { BackendActivity, BackendActivityCheckInRecord, BackendRegistration } from "@/types/backend";

export function isActiveTeamRegistrationActivity(activity: BackendActivity) {
  return !!activity.source_activity_id && activity.status !== 3;
}

export function parseDateValue(value: string) {
  return new Date(value.replace(" ", "T"));
}

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatMonthDay(value: string) {
  const date = parseDateValue(value);
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function formatClock(value: string) {
  const date = parseDateValue(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatWeekday(value: string) {
  const date = parseDateValue(value);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()] ?? "周日";
}

export function formatCountdown(distance: number) {
  if (distance <= 0) return "已截止";
  const seconds = Math.floor(distance / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;
  return `${pad(hours)} : ${pad(minutes)} : ${pad(remainSeconds)}`;
}

export function describeDaysUntil(target: number, current: number) {
  if (!target) return "时间待定";
  const diff = target - current;
  if (diff <= 0) return "即将开赛";
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 1) return "1天内开赛";
  return `${days}天后开赛`;
}

export function avatarColor(userId: number) {
  const palette = ["#111111", "#1b55ff", "#0f766e", "#8b5cf6", "#ea580c", "#16a34a", "#be123c"];
  return palette[userId % palette.length];
}

export function clampTeamRegistrationCount(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.round(value), 5), 11);
}

export function buildRegistrationProgress(joinedCount: number, requiredPlayers: number, maxPlayers: number) {
  const denominator = Math.max(maxPlayers || requiredPlayers, 1);
  return {
    baseWidth: `${Math.min((Math.min(joinedCount, requiredPlayers) / denominator) * 100, 100)}%`,
    extraWidth: `${Math.min((Math.max(joinedCount - requiredPlayers, 0) / denominator) * 100, 100)}%`,
    splitLeft: `${Math.min((requiredPlayers / denominator) * 100, 100)}%`,
  };
}

export function buildRemainingPlayersLabel(joinedCount: number, requiredPlayers: number) {
  if (!requiredPlayers) return "人数待定";
  const left = Math.max(requiredPlayers - joinedCount, 0);
  return left > 0 ? `还差 ${left} 人成行` : "人数已齐";
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
