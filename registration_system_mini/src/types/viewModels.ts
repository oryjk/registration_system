import type { AppMatchUiPhase } from "@/types/match";
import type { NeoTagTone } from "@/types/designSystem";

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
  stageTone: NeoTagTone;
  statusTone: NeoTagTone;
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
  myStatus: string;
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
}

export interface AttendanceSummaryViewModel {
  total: number;
  attended: number;
  leave: number;
  late: number;
  pending: number;
  attendanceRate: string;
}

export interface BillingSummaryViewModel {
  balanceLabel: string;
  totalRechargeLabel: string;
  totalExpenseLabel: string;
  totalPenaltyLabel: string;
  latestRecordCount: number;
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
  id: string;
  title: string;
  content: string;
  kindLabel: string;
  createdAtLabel: string;
  read: boolean;
  relatedPath: string;
}
