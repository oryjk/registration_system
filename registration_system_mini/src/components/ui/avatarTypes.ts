export type AvatarItem = {
  id: string | number;
  /** Actual registration group's team, never inferred from the user's current team. */
  teamId?: number;
  name: string;
  avatarUrl?: string;
  tone?: string;
  isPaidMember?: boolean;
  teamAttendedCount?: number;
  teamParticipationPoints?: number;
  teamParticipationRank?: number;
  teamAttendanceRank?: number;
};
export type AvatarSize = "xs" | "sm" | "md" | "lg";
