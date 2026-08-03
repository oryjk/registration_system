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
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  registering: "报名中",
  ongoing: "进行中",
  ended: "已结束",
  cancelled: "已取消",
};

export const matchStatusColors: Record<MatchStatus, string> = {
  registering: "processing",
  ongoing: "success",
  ended: "default",
  cancelled: "error",
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
    unregistered: "default",
    leave: "orange",
    absent: "error",
    cancelled: "default",
  };
