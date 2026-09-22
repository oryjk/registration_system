import type { AppMatchUiPhase } from "@/types/match";
import type { AppTagTone } from "@/types/designSystem";

export interface TeamProfileViewModel {
  id: number;
  name: string;
  description: string;
  logoUrl: string;
  status: number;
  memberCount: number;
  myRole: string;
  myRoleLabel: string;
  joinedAt: string;
  isCaptain: boolean;
  canManageTeam: boolean;
  creditScore: number;
  trustLabel: string;
  vipUntil: string;
  isVip: boolean;
}

export type CurrentIdentityKind = "team" | "venue";

export interface CurrentIdentityViewModel {
  kind: CurrentIdentityKind;
  id: string;
  label: string;
  roleLabel: string;
  teamId?: number;
}

export interface HomeMatchCardViewModel {
  id: string;
  /** 首页所属报名组；详情补全必须匹配此组，避免拿到主客队的另一侧状态。 */
  registrationGroupId?: string;
  detailUrl: string;
  title: string;
  dateLabel: string;
  dateSource?: string;
  dateBlock: {
    monthDay: string;
    weekday: string;
    timeLabel: string;
  };
  phase: Exclude<AppMatchUiPhase, "excluded">;
  dateNote: string;
  showRegistrationProgress: boolean;
  showParticipantAvatars: boolean;
  canOpenDetail: boolean;
  stage: string;
  stageTone: AppTagTone;
  statusTone: AppTagTone;
  publicationModeLabel: string;
  signupScopeLabel: string;
  signupScope: "external" | "internal";
  venue: string;
  opponent: string;
  formatLabel: string;
  requiredPlayers: number;
  maxPlayers: number;
  joinedPlayers: number;
  absentPlayers: number;
  latePlayers: number;
  pendingPlayers: number;
  /** 我的报名状态；无我方数据的场景（广场/搜索/历史）为 null，卡片不渲染该标签。 */
  myStatus: string | null;
  highlight: string;
  participantAvatars: Array<{
    userId: number;
    avatarUrl: string;
    displayText: string;
    tone: string;
  }>;
  remainingPlayersLabel: string;
  canRegister: boolean;
  actionLabel?: string;
  /** 展示模式：upcoming 用报名型富卡；ongoing/ended 用紧凑查看型卡（整卡仅查看）。 */
  viewMode: "action" | "compact";
  /** 真实接口录入的比分（如 "3 : 1"）；未录入或非查看阶段为 null。 */
  scoreLabel: string | null;
  /** 比分前缀文案：已结束「最终比分」、进行中「当前比分」；无比分为 null。 */
  scoreNote: string | null;
}

export interface AttendanceSummaryViewModel {
  total: number;
  attended: number;
  leave: number;
  late: number;
  pending: number;
  attendanceRate: string;
}

export interface ChallengeCardViewModel {
  id: string;
  title: string;
  kind: "team" | "individual";
  hostTeamName: string;
  creditScore: number;
  trustLabel: string;
  dateLabel: string;
  monthDayLabel: string;
  dayNumberLabel: string;
  weekdayLabel: string;
  timeRangeLabel: string;
  venue: string;
  formatLabel: string;
  feeLabel: string;
  priceLabel: string;
  statusLabel: string;
  statusTone: "open" | "matched" | "cancelled";
  relationLabel: string;
  note: string;
  teamInitial: string;
  quickTags: string[];
  primaryActionLabel: string;
  canAccept: boolean;
  acceptedCount: number;
  capacity: number;
  minPlayers: number;
  maxPlayers: number;
  currentUserJoined: boolean;
  activityId: string;
}

export interface NotificationItemViewModel {
  id: number;
  title: string;
  content: string;
  kindLabel: string;
  createdAtLabel: string;
  read: boolean;
  relatedPath: string;
}

/** 球队约队详情页的双边报名进度项（主队/客队各一条）。 */
export interface MatchTeamProgressItem {
  id: string;
  label: string;
  attending: number;
  required: number | null;
  max: number | null;
}
