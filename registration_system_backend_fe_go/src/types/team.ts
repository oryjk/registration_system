export type TeamStatus = "active" | "frozen";

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
