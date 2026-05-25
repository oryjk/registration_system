export type AttendanceStatusTone = "join" | "leave" | "late" | "pending";
export type ActivityStageTone = "blue" | "dark" | "muted" | "red";
export type ChallengeStatusTone = "open" | "matched" | "cancelled";
export type MatchStatusBadgeTone = "success" | "warning" | "muted" | "default";

export function attendanceStatusTone(statusLabel: string): AttendanceStatusTone {
  if (statusLabel === "参加") return "join";
  if (statusLabel === "请假") return "leave";
  if (statusLabel === "缺席") return "late";
  return "pending";
}

export function activityStageTone(stageLabel: string): ActivityStageTone {
  if (stageLabel === "进行中") return "blue";
  if (stageLabel === "已结束") return "dark";
  if (stageLabel === "已取消") return "muted";
  return "red";
}

export function matchStatusBadgeTone(statusLabel: string): MatchStatusBadgeTone {
  if (statusLabel === "参加") return "success";
  if (statusLabel === "请假" || statusLabel === "缺席") return "warning";
  if (statusLabel === "待定") return "muted";
  return "default";
}
