export type LineupPosition = "GK" | "DF" | "MF" | "FW";

export type LineupTeamSize = 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type MiniProgramEnv = "release" | "trial" | "develop";

export interface MatchLineupSlot {
  slot: number;
  player_id: number | null;
  x: number;
  y: number;
  sub_player_ids: number[];
}

export interface MatchLineupPlayer {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
}

export interface MatchLineupRecord {
  match_id: string;
  players_per_team: number;
  formation: string;
  slots: MatchLineupSlot[];
  players: MatchLineupPlayer[];
  updated_by_user_id: number | null;
  updated_at: string;
}

export interface MatchLineupResponse {
  lineup: MatchLineupRecord | null;
}

export interface SaveMatchLineupPayload {
  formation: string;
  slots: MatchLineupSlot[];
}

export interface MatchLineupMiniCodeResponse {
  image_url: string;
}

export interface LineupCandidate extends MatchLineupPlayer {
  source: "attending" | "team" | "saved";
}

export interface PitchSlotView {
  slot: number;
  position: LineupPosition;
  label: string;
  x: number;
  y: number;
  starter: MatchLineupPlayer | null;
  subs: MatchLineupPlayer[];
}

export type CurrentUserLineupRole =
  | {
      kind: "starter";
      slot: number;
      label: string;
      subs: MatchLineupPlayer[];
    }
  | {
      kind: "sub";
      slot: number;
      label: string;
      starter: MatchLineupPlayer | null;
    };
