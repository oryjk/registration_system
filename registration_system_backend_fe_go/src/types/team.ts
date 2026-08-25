export type TeamStatus = "active" | "frozen" | "dissolved";
export type TeamMemberRole = "captain" | "leader" | "vice_captain" | "member";
export type AssignableTeamMemberRole = Exclude<TeamMemberRole, "captain">;
export type TeamMemberStatus = "active" | "inactive";

export interface TeamOption {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface TeamCaptain {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
}

export interface Team extends TeamOption {
  description: string | null;
  captain_id: number | null;
  captain: TeamCaptain | null;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
}

export interface SaveTeamPayload {
  name: string;
  description: string | null;
  status?: TeamStatus;
}

export interface TeamMember {
  id: number;
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  phone_number: string | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joined_at: string;
  /** 该成员在此球队的队费余额（分），负数表示欠款。 */
  balance_cents: number;
}

export interface TeamMemberCandidate {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  phone_number: string | null;
}

export interface TeamMemberManagement {
  team: Team;
  members: TeamMember[];
}

export interface AddTeamMemberPayload {
  user_id: number;
  role: AssignableTeamMemberRole;
}

export interface UpdateTeamMemberPayload {
  role: AssignableTeamMemberRole;
  status: TeamMemberStatus;
}

export interface UpdatePlayerProfilePayload {
  real_name: string | null;
  phone_number: string | null;
}

export interface PlayerProfile extends UpdatePlayerProfilePayload {
  id: number;
  nickname: string;
  avatar_url: string | null;
  status: "active" | "frozen";
}
