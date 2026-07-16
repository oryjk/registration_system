export type TeamStatus = "active" | "frozen";
export type TeamMemberRole = "captain" | "leader" | "vice_captain" | "member";
export type AssignableTeamMemberRole = Exclude<TeamMemberRole, "captain">;
export type TeamMemberStatus = "active" | "inactive";

export interface TeamOption {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface Team extends TeamOption {
  description: string | null;
  captain_id: number | null;
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
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joined_at: string;
}

export interface TeamMemberCandidate {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
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
