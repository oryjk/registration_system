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

// 散人约球有独立的发布页（无球队概念），不进创建比赛的类型选择，但展示层要认得它的标签。
const EXTRA_PUBLICATION_MODE_LABELS: Partial<Record<AppMatchPublicationMode, string>> = {
  online_pickup: "散人约球",
};

const publicationModeLabels: Record<string, string> = {
  ...Object.fromEntries(MATCH_PUBLICATION_MODE_OPTIONS.map((option) => [option.value, option.label])),
  ...EXTRA_PUBLICATION_MODE_LABELS,
};

export function getMatchPublicationModeLabel(value: string): string {
  return publicationModeLabels[value as AppMatchPublicationMode] || "其他类型";
}
