import type { AppMatchPublicationMode } from "@/types/match";

export interface MatchPublicationModeOption {
  value: AppMatchPublicationMode;
  label: string;
  description: string;
}

export const MATCH_PUBLICATION_MODE_OPTIONS: readonly MatchPublicationModeOption[] = [
  {
    value: "offline_confirmed",
    label: "线下已约",
    description: "已确定对手，无需线上招募",
  },
  {
    value: "online_team",
    label: "线上约队",
    description: "在线招募一支球队作为对手",
  },
  {
    value: "online_individual",
    label: "散人对手",
    description: "在线招募个人组成对手阵容",
  },
];

const publicationModeLabels = Object.fromEntries(
  MATCH_PUBLICATION_MODE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AppMatchPublicationMode, string>;

export function getMatchPublicationModeLabel(value: string): string {
  return publicationModeLabels[value as AppMatchPublicationMode] || "其他类型";
}
