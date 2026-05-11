export type RegistrationState = "参加" | "请假" | "迟到" | "待定";

export interface TeamProfile {
  id: string;
  name: string;
  role: string;
  credit: number;
  trustLabel: string;
  city: string;
  members: number;
}

export interface MatchSummary {
  id: string;
  teamId: string;
  title: string;
  stage: string;
  dateLabel: string;
  countdown: string;
  venue: string;
  opponent: string;
  format: number;
  requiredPlayers: number;
  maxPlayers: number;
  joinedPlayers: number;
  absentPlayers: number;
  latePlayers: number;
  pendingPlayers: number;
  myStatus: RegistrationState;
  fee: number;
  highlight: string;
}

export interface RegistrationMember {
  id: string;
  name: string;
  nickname: string;
  status: RegistrationState;
  avatarColor: string;
}

export interface MatchPerformance {
  matchId: string;
  matchTitle: string;
  dateLabel: string;
  opponent: string;
  attendance: "出勤" | "缺席" | "迟到";
  goals: number;
  assists: number;
}

export interface TeamRankingItem {
  name: string;
  metric: string;
  value: string;
}

export interface ChallengeSummary {
  id: string;
  title: string;
  hostTeam: string;
  credit: number;
  trustLabel: string;
  dateLabel: string;
  venue: string;
  format: number;
  feeLabel: string;
  ratingSummary: string;
  status: "可接约" | "已约成" | "仅候补";
  availableForTeams: string[];
  note: string;
}

export interface BillingRecord {
  id: string;
  title: string;
  dateLabel: string;
  amount: string;
  status: "已扣款" | "待确认" | "待支付";
}

export interface CurrentUserProfile {
  name: string;
  nickname: string;
  createdTeamsCount: number;
  maxTeamsAllowed: number;
}

export const currentUserProfile: CurrentUserProfile = {
  name: "黄鑫",
  nickname: "@黄鑫",
  createdTeamsCount: 1,
  maxTeamsAllowed: 2,
};

export const teamProfiles: TeamProfile[] = [
  {
    id: "team-ly",
    name: "东安洛悦联队",
    role: "领队",
    credit: 94,
    trustLabel: "稳定赴约",
    city: "成都高新",
    members: 23,
  },
  {
    id: "team-fc",
    name: "河西周四 FC",
    role: "普通队员",
    credit: 88,
    trustLabel: "评价稳定",
    city: "成都武侯",
    members: 18,
  },
  {
    id: "team-yk",
    name: "野克星期二",
    role: "队长",
    credit: 81,
    trustLabel: "活跃新队",
    city: "成都锦江",
    members: 16,
  },
];

export const matchSummaries: MatchSummary[] = [
  {
    id: "match-0416",
    teamId: "team-ly",
    title: "周四友谊赛",
    stage: "即将截止报名",
    dateLabel: "04/16 周四 20:00",
    countdown: "距截止 2 小时",
    venue: "驿马河二期 1 号场",
    opponent: "待定",
    format: 8,
    requiredPlayers: 8,
    maxPlayers: 15,
    joinedPlayers: 7,
    absentPlayers: 3,
    latePlayers: 1,
    pendingPlayers: 4,
    myStatus: "参加",
    fee: 28,
    highlight: "今天 18:00 截止报名，还差 1 人达标",
  },
  {
    id: "match-0421",
    teamId: "team-ly",
    title: "城北联赛第 3 轮",
    stage: "报名中",
    dateLabel: "04/21 周二 21:30",
    countdown: "距开赛 5 天",
    venue: "银杏体育公园",
    opponent: "三圣联",
    format: 7,
    requiredPlayers: 7,
    maxPlayers: 13,
    joinedPlayers: 10,
    absentPlayers: 2,
    latePlayers: 0,
    pendingPlayers: 1,
    myStatus: "待定",
    fee: 35,
    highlight: "名单基本成型，可以继续补轮换",
  },
  {
    id: "match-0420-fc",
    teamId: "team-fc",
    title: "河西夜场约战",
    stage: "待你确认",
    dateLabel: "04/20 周一 20:30",
    countdown: "距开赛 4 天",
    venue: "府河绿道足球场",
    opponent: "柏林二队",
    format: 6,
    requiredPlayers: 6,
    maxPlayers: 11,
    joinedPlayers: 5,
    absentPlayers: 1,
    latePlayers: 0,
    pendingPlayers: 2,
    myStatus: "待定",
    fee: 22,
    highlight: "本队还差 1 人达标",
  },
  {
    id: "match-0422-yk",
    teamId: "team-yk",
    title: "周二练习赛",
    stage: "报名中",
    dateLabel: "04/22 周三 19:45",
    countdown: "距开赛 6 天",
    venue: "东湖公园 5 号场",
    opponent: "半糖联队",
    format: 5,
    requiredPlayers: 5,
    maxPlayers: 9,
    joinedPlayers: 6,
    absentPlayers: 1,
    latePlayers: 0,
    pendingPlayers: 2,
    myStatus: "参加",
    fee: 20,
    highlight: "已达标，可以继续补替补",
  },
];

export const matchMembers: Record<string, RegistrationMember[]> = {
  "match-0416": [
    { id: "1", name: "曾俊", nickname: "@曾俊", status: "参加", avatarColor: "#111827" },
    { id: "2", name: "王洪", nickname: "@阿洪", status: "参加", avatarColor: "#0f766e" },
    { id: "3", name: "桂强", nickname: "@东安利马", status: "参加", avatarColor: "#7c3aed" },
    { id: "4", name: "吕红贵", nickname: "@叶知秋", status: "参加", avatarColor: "#ea580c" },
    { id: "5", name: "唐斯慧", nickname: "@阿慧", status: "参加", avatarColor: "#2563eb" },
    { id: "6", name: "陈平严", nickname: "@界牌辅十八号", status: "参加", avatarColor: "#16a34a" },
    { id: "7", name: "孙剑峰", nickname: "@贝壳", status: "参加", avatarColor: "#1d4ed8" },
    { id: "8", name: "蒋景洪", nickname: "@会说话的哑巴", status: "请假", avatarColor: "#ef4444" },
    { id: "9", name: "寻勇", nickname: "@寻勇", status: "请假", avatarColor: "#f59e0b" },
    { id: "10", name: "赵川江", nickname: "@小赵", status: "请假", avatarColor: "#b45309" },
    { id: "11", name: "薛田正", nickname: "@薛田正", status: "迟到", avatarColor: "#be123c" },
    { id: "12", name: "张可以", nickname: "@张可以", status: "待定", avatarColor: "#475569" },
    { id: "13", name: "吴家昕", nickname: "@A昕然", status: "待定", avatarColor: "#334155" },
    { id: "14", name: "李桂斌", nickname: "@小李", status: "待定", avatarColor: "#0f172a" },
    { id: "15", name: "蒋飞", nickname: "@阿飞", status: "待定", avatarColor: "#7f1d1d" },
  ],
  "match-0421": [
    { id: "21", name: "曾俊", nickname: "@曾俊", status: "参加", avatarColor: "#111827" },
    { id: "22", name: "王洪", nickname: "@阿洪", status: "参加", avatarColor: "#0f766e" },
    { id: "23", name: "桂强", nickname: "@东安利马", status: "参加", avatarColor: "#7c3aed" },
    { id: "24", name: "吕红贵", nickname: "@叶知秋", status: "参加", avatarColor: "#ea580c" },
    { id: "25", name: "唐斯慧", nickname: "@阿慧", status: "参加", avatarColor: "#2563eb" },
    { id: "26", name: "陈平严", nickname: "@界牌辅十八号", status: "参加", avatarColor: "#16a34a" },
    { id: "27", name: "孙剑峰", nickname: "@贝壳", status: "参加", avatarColor: "#1d4ed8" },
    { id: "28", name: "蒋景洪", nickname: "@会说话的哑巴", status: "参加", avatarColor: "#ef4444" },
    { id: "29", name: "寻勇", nickname: "@寻勇", status: "参加", avatarColor: "#f59e0b" },
    { id: "30", name: "赵川江", nickname: "@小赵", status: "参加", avatarColor: "#b45309" },
    { id: "31", name: "薛田正", nickname: "@薛田正", status: "请假", avatarColor: "#be123c" },
    { id: "32", name: "张可以", nickname: "@张可以", status: "请假", avatarColor: "#475569" },
    { id: "33", name: "吴家昕", nickname: "@A昕然", status: "待定", avatarColor: "#334155" },
  ],
  "match-0420-fc": [
    { id: "41", name: "阿宽", nickname: "@阿宽", status: "参加", avatarColor: "#1d4ed8" },
    { id: "42", name: "老洪", nickname: "@老洪", status: "参加", avatarColor: "#0f766e" },
    { id: "43", name: "老周", nickname: "@老周", status: "参加", avatarColor: "#7c3aed" },
    { id: "44", name: "小杨", nickname: "@小杨", status: "参加", avatarColor: "#ea580c" },
    { id: "45", name: "阿亮", nickname: "@阿亮", status: "参加", avatarColor: "#2563eb" },
    { id: "46", name: "国胜", nickname: "@国胜", status: "请假", avatarColor: "#ef4444" },
    { id: "47", name: "齐哥", nickname: "@齐哥", status: "待定", avatarColor: "#475569" },
    { id: "48", name: "小唐", nickname: "@小唐", status: "待定", avatarColor: "#334155" },
  ],
  "match-0422-yk": [
    { id: "51", name: "阿强", nickname: "@阿强", status: "参加", avatarColor: "#111827" },
    { id: "52", name: "大海", nickname: "@大海", status: "参加", avatarColor: "#0f766e" },
    { id: "53", name: "小顾", nickname: "@小顾", status: "参加", avatarColor: "#7c3aed" },
    { id: "54", name: "小马", nickname: "@小马", status: "参加", avatarColor: "#ea580c" },
    { id: "55", name: "周哥", nickname: "@周哥", status: "参加", avatarColor: "#2563eb" },
    { id: "56", name: "阿力", nickname: "@阿力", status: "参加", avatarColor: "#16a34a" },
    { id: "57", name: "亮哥", nickname: "@亮哥", status: "请假", avatarColor: "#ef4444" },
    { id: "58", name: "老冯", nickname: "@老冯", status: "待定", avatarColor: "#475569" },
    { id: "59", name: "阿登", nickname: "@阿登", status: "待定", avatarColor: "#334155" },
  ],
};

export const performanceByTeam: Record<string, MatchPerformance[]> = {
  "team-ly": [
    { matchId: "m1", matchTitle: "周四友谊赛", dateLabel: "04/09", opponent: "骡马河二期", attendance: "出勤", goals: 2, assists: 1 },
    { matchId: "m2", matchTitle: "城北联赛第 2 轮", dateLabel: "04/03", opponent: "九眼桥联", attendance: "迟到", goals: 1, assists: 0 },
    { matchId: "m3", matchTitle: "周四友谊赛", dateLabel: "03/26", opponent: "老车站联", attendance: "出勤", goals: 0, assists: 2 },
    { matchId: "m4", matchTitle: "春季练习赛", dateLabel: "03/19", opponent: "青龙场 FC", attendance: "出勤", goals: 1, assists: 1 },
  ],
  "team-fc": [
    { matchId: "m5", matchTitle: "河西夜场", dateLabel: "04/02", opponent: "柏林二队", attendance: "出勤", goals: 1, assists: 0 },
    { matchId: "m6", matchTitle: "周末约战", dateLabel: "03/29", opponent: "北门猎豹", attendance: "缺席", goals: 0, assists: 0 },
  ],
  "team-yk": [
    { matchId: "m7", matchTitle: "周二练习赛", dateLabel: "04/01", opponent: "半糖联队", attendance: "出勤", goals: 3, assists: 1 },
    { matchId: "m8", matchTitle: "夜训", dateLabel: "03/25", opponent: "双楠老友", attendance: "出勤", goals: 1, assists: 1 },
  ],
};

export const rankingByTeam: Record<string, TeamRankingItem[]> = {
  "team-ly": [
    { name: "曾俊", metric: "射手榜", value: "9 球" },
    { name: "桂强", metric: "助攻榜", value: "6 次" },
    { name: "孙剑峰", metric: "出勤榜", value: "92%" },
    { name: "蒋景洪", metric: "迟到榜", value: "3 次" },
  ],
  "team-fc": [
    { name: "阿宽", metric: "射手榜", value: "5 球" },
    { name: "老洪", metric: "助攻榜", value: "4 次" },
    { name: "齐哥", metric: "出勤榜", value: "84%" },
    { name: "小唐", metric: "迟到榜", value: "2 次" },
  ],
  "team-yk": [
    { name: "阿强", metric: "射手榜", value: "7 球" },
    { name: "大海", metric: "助攻榜", value: "5 次" },
    { name: "小马", metric: "出勤榜", value: "88%" },
    { name: "老冯", metric: "迟到榜", value: "2 次" },
  ],
};

export const challengeSummaries: ChallengeSummary[] = [
  {
    id: "challenge-1",
    title: "周六夜场 8 人制约队",
    hostTeam: "骡马河联队",
    credit: 93,
    trustLabel: "连续 12 场准时",
    dateLabel: "04/18 周六 20:30",
    venue: "驿马河二期 1 号场",
    format: 8,
    feeLabel: "预计 28 元/人",
    ratingSummary: "场地固定，爽约记录低",
    status: "可接约",
    availableForTeams: ["team-ly", "team-fc"],
    note: "想约一场强度中高的友谊赛，赛后可一起吃夜宵。",
  },
  {
    id: "challenge-2",
    title: "工作日晚场 6 人制",
    hostTeam: "柏林二队",
    credit: 86,
    trustLabel: "评价稳定",
    dateLabel: "04/20 周一 20:30",
    venue: "府河绿道足球场",
    format: 6,
    feeLabel: "预计 22 元/人",
    ratingSummary: "踢法积极，沟通顺畅",
    status: "可接约",
    availableForTeams: ["team-fc", "team-yk"],
    note: "偏比赛节奏，希望对手能准时到齐。",
  },
  {
    id: "challenge-3",
    title: "周二练习赛 5 人制",
    hostTeam: "半糖联队",
    credit: 79,
    trustLabel: "新队观察中",
    dateLabel: "04/22 周三 19:45",
    venue: "东湖公园 5 号场",
    format: 5,
    feeLabel: "预计 20 元/人",
    ratingSummary: "新队，评价还不多",
    status: "仅候补",
    availableForTeams: ["team-ly", "team-yk"],
    note: "想找一个稳定出勤的队一起踢练习赛。",
  },
];

export const billingByTeam: Record<string, BillingRecord[]> = {
  "team-ly": [
    { id: "b1", title: "04/09 周四友谊赛场地费", dateLabel: "04/10 09:12", amount: "-¥28", status: "已扣款" },
    { id: "b2", title: "04/16 周四友谊赛场地费", dateLabel: "04/15 14:20", amount: "¥28", status: "待确认" },
    { id: "b3", title: "春季联赛报名分摊", dateLabel: "04/02 12:30", amount: "-¥35", status: "已扣款" },
  ],
  "team-fc": [
    { id: "b4", title: "河西夜场场地费", dateLabel: "04/02 09:20", amount: "-¥22", status: "已扣款" },
    { id: "b5", title: "工作日晚场约队订金", dateLabel: "04/14 20:00", amount: "¥30", status: "待支付" },
  ],
  "team-yk": [
    { id: "b6", title: "周二练习赛场地费", dateLabel: "04/01 21:45", amount: "-¥20", status: "已扣款" },
  ],
};

export function getMatchById(matchId: string) {
  return matchSummaries.find((item) => item.id === matchId);
}

export function getChallengeById(challengeId: string) {
  return challengeSummaries.find((item) => item.id === challengeId);
}
