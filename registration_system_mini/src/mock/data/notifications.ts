import type { BackendNotification } from "@/types/backend";
import { dateOffset } from "./dates";

export const mockNotifications: BackendNotification[] = [
  {
    id: "ntf-001",
    user_id: 37,
    kind: "challenge_matched",
    title: "约队已约成",
    content: "「周末强强对话 8v8」已由洺悦御府接约，请留意比赛时间。",
    related_type: "challenge",
    related_id: "ch-004",
    read_at: null,
    created_at: dateOffset(-1, 9, 0),
  },
  {
    id: "ntf-002",
    user_id: 37,
    kind: "challenge_created",
    title: "新的约队机会",
    content: "青龙联队发布了一条新的约队「周六夜场 8 人制约队」，快去看看吧。",
    related_type: "challenge",
    related_id: "ch-001",
    read_at: null,
    created_at: dateOffset(-2, 14, 0),
  },
  {
    id: "ntf-003",
    user_id: 37,
    kind: "reminder",
    title: "比赛报名提醒",
    content: "「周四友谊赛」即将在 2 天后开始，请确认你的报名状态。",
    related_type: "activity",
    related_id: "act-001",
    read_at: dateOffset(-3, 10, 0),
    created_at: dateOffset(-3, 10, 0),
  },
];
