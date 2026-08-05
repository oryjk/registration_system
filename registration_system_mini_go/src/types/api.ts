export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type UserStatus = "active" | "frozen";

export interface User {
  id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  phone_number: string | null;
  status: UserStatus;
}

export interface WechatLoginResult {
  token: string;
  user: User;
}

export type TeamRole = "captain" | "leader" | "vice_captain" | "member";

export interface TeamMembership {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  role: TeamRole;
  joined_at: string;
}

export interface HealthStatus {
  status: "ok";
}

export type MatchStatus = "registering" | "ongoing" | "ended" | "cancelled";
export type RegistrationGroupKind = "host_team" | "guest_team" | "individual_opponent";
export type RegistrationGroupStatus = "open" | "closed" | "cancelled";
export type MatchRegistrationStatus = "unknown" | "attending" | "leave" | "absent" | "cancelled";

export interface HomeRegistrationGroup {
  id: string;
  kind: RegistrationGroupKind;
  status: RegistrationGroupStatus;
  min_players: number | null;
  max_players: number | null;
  attending_count: number;
  my_registration_status: MatchRegistrationStatus | null;
}

export interface HomeActionMatch {
  id: string;
  name: string;
  status: MatchStatus;
  host_team_name: string;
  opponent_name: string;
  players_per_team: number;
  start_time: string;
  end_time: string;
  location: string;
  group: HomeRegistrationGroup;
}

export interface HomeEndedMatch {
  id: string;
  name: string;
  status: "ended";
  host_team_name: string;
  opponent_name: string;
  start_time: string;
  end_time: string;
  location: string;
}

export interface HomeMatchesResponse {
  action_items: HomeActionMatch[];
  ended_items: HomeEndedMatch[];
  ended_has_more: boolean;
}
