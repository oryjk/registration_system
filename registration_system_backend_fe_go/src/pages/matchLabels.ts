import type {
  MatchRegistrationStatus,
  MatchStatus,
  OpponentState,
  PublicationMode,
} from "../types/match";

export const publicationModeLabels: Record<PublicationMode, string> = {
  offline_confirmed: "线下已约",
  online_team: "线上约队",
  online_individual: "散人对手",
  online_pickup: "散人约球",
};

export const publicationModeDescriptions: Record<PublicationMode, string> = {
  offline_confirmed: "已线下确定对手，无需线上招募",
  online_team: "在线招募一支球队作为对手",
  online_individual: "在线招募个人组成对手阵容",
  online_pickup: "所有参与者都是散人，无球队概念",
};

export function getPublicationModeLabel(value: string): string {
  return publicationModeLabels[value as PublicationMode] || "其他类型";
}

export const matchStatusLabels: Record<MatchStatus, string> = {
  registering: "报名中",
  ongoing: "进行中",
  ended: "已结束",
  cancelled: "已取消",
};

/** 状态徽章的语义色（对应 Badge variant，见 components/ui/badge.tsx） */
export const matchStatusColors: Record<MatchStatus, string> = {
  registering: "info",
  ongoing: "success",
  ended: "secondary",
  cancelled: "destructive",
};

export const opponentStateLabels: Record<OpponentState, string> = {
  no_recruitment: "无需招募",
  recruiting: "招募中",
  confirmed: "已确认",
};

export const registrationStatusLabels: Record<MatchRegistrationStatus, string> =
  {
    attending: "参赛",
    unknown: "未表态",
    unregistered: "未报名",
    leave: "请假",
    absent: "缺席",
    cancelled: "已取消",
  };

export const registrationStatusColors: Record<MatchRegistrationStatus, string> =
  {
    attending: "success",
    unknown: "warning",
    unregistered: "secondary",
    leave: "warning",
    absent: "destructive",
    cancelled: "secondary",
  };
