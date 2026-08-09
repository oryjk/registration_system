export type MineStatTone = "lime" | "blue" | "amber" | "coral";

export interface MineStatItem {
  key: "matches" | "teams" | "hours" | "joinedDays";
  label: string;
  value: string;
  unit?: string;
  tone: MineStatTone;
}

export interface MineMatchSummary {
  id: string;
  title: string;
  dateLabel: string;
  venue: string;
  myStatus: string;
}
