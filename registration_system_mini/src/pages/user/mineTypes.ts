import type { NeoTagTone } from "@/types/designSystem";

export type MineStatTone = "accent" | "plain";

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
  statusLabel: string;
  statusTone: NeoTagTone;
  actionLabel: string;
}
