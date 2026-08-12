export type AppMatchStatus = "registering" | "ongoing" | "ended" | "cancelled";
export type AppMatchUiPhase = "upcoming" | "ongoing" | "ended" | "excluded";
export type AppMatchRegistrationStatus = "unknown" | "attending" | "leave" | "absent" | "cancelled";
export type AppMatchPublicationMode = "offline_confirmed" | "online_team" | "online_individual";

export interface AppMatchPhaseSource {
  id: string;
  status: AppMatchStatus;
  start_time: string;
  end_time: string;
}

export interface AppHomeMatchGroup {
  id: string;
  kind: "host_team" | "guest_team" | "individual_opponent";
  status: "open" | "closed" | "cancelled";
  min_players: number | null;
  max_players: number | null;
  attending_count: number;
  my_registration_status: "unknown" | "attending" | "leave" | "absent" | "cancelled" | null;
}

export interface AppHomeActionMatch extends AppMatchPhaseSource {
  name: string;
  publication_mode: AppMatchPublicationMode;
  host_team_name: string;
  opponent_name: string;
  players_per_team: number;
  location: string;
  group: AppHomeMatchGroup;
}

export interface AppHomeEndedMatch extends AppMatchPhaseSource {
  name: string;
  publication_mode: AppMatchPublicationMode;
  host_team_name: string;
  opponent_name: string;
  location: string;
}

export interface AppMatchSummary extends AppMatchPhaseSource {
  name: string;
  publication_mode: AppMatchPublicationMode;
  opponent_state: "no_recruitment" | "recruiting" | "confirmed";
  host_team_id: number;
  host_team_name: string;
  away_team_id: number | null;
  away_team_name: string | null;
  opponent_name: string | null;
  players_per_team: number;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppMatchRegistration {
  status: AppMatchRegistrationStatus;
  registration_count: number;
}

export interface AppMatchParticipant {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  status: AppMatchRegistrationStatus;
}

export interface AppMatchGroupDetail {
  id: string;
  kind: AppHomeMatchGroup["kind"];
  team_id: number | null;
  status: AppHomeMatchGroup["status"];
  min_players: number | null;
  max_players: number | null;
  attending_count: number;
  my_registration: AppMatchRegistration | null;
  participants?: AppMatchParticipant[];
}

export interface AppMatchDetailResponse {
  match: AppMatchSummary;
  groups: AppMatchGroupDetail[];
}

export type AppMatchListScope = "all" | "mine" | "others";

export interface AppMatchHomeResponse {
  action_items: AppHomeActionMatch[];
  action_has_more: boolean;
  ended_items: AppHomeEndedMatch[];
  ended_has_more: boolean;
}

export interface AppMatchListResponse {
  items: AppMatchSummary[];
  total: number;
  page: number;
  page_size: number;
}
