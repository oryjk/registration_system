export type AvatarItem = {
  id: string | number;
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
