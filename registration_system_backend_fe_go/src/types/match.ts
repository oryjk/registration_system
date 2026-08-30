export type PublicationMode =
  | "offline_confirmed"
  | "online_team"
  | "online_individual"
  | "online_pickup";
export type PaymentMode = "postpaid" | "prepaid";
export type OpponentState = "no_recruitment" | "recruiting" | "confirmed";
export type MatchStatus = "registering" | "ongoing" | "ended" | "cancelled";
export type GroupKind = "host_team" | "guest_team" | "individual_opponent";
export type GroupStatus = "open" | "closed" | "cancelled";
export type MatchRegistrationStatus =
  | "unknown"
  | "attending"
  | "leave"
  | "absent"
  | "cancelled"
  | "unregistered";

export interface MatchItem {
  id: string;
  name: string;
  publication_mode: PublicationMode;
  opponent_state: OpponentState;
  status: MatchStatus;
  /** 散人约球（online_pickup）没有主队。 */
  host_team_id: number | null;
  host_team_name: string;
  away_team_id: number | null;
  away_team_name: string | null;
  opponent_name: string | null;
  players_per_team: number;
  /** 主队比分；null 表示尚未录入（进行中/结束后录入）。 */
  host_score: number | null;
  /** 客队比分；null 表示尚未录入。 */
  away_score: number | null;
  start_time: string;
  end_time: string;
  registration_start_at: string | null;
  registration_end_at: string | null;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  host_color: string | null;
  away_color: string | null;
  created_by_user_id: number | null;
  created_by_admin_id: number | null;
  created_at: string;
  updated_at: string;
  is_free: boolean;
  payment_mode: PaymentMode;
  fee_per_person_cents: number;
}

export interface MatchRegistrationEntry {
  user_id: number;
  nickname: string;
  real_name: string | null;
  avatar_url: string | null;
  member_role: string | null;
  status: MatchRegistrationStatus;
  /** 该行报名占用的人数；散人约球一人代多人时大于 1，其余恒为 1。 */
  registration_count: number;
  /** 报名费是否已支付（散人约球赛前支付场景）。 */
  paid: boolean;
}

export interface RegistrationGroup {
  id: string;
  kind: GroupKind;
  team_id: number | null;
  min_players: number | null;
  max_players: number | null;
  status: GroupStatus;
  registrations: MatchRegistrationEntry[];
}

export interface MatchDetail {
  match: MatchItem;
  groups: RegistrationGroup[];
}

export interface MatchListPage {
  items: MatchItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MatchListQuery {
  search?: string;
  status?: MatchStatus;
  page?: number;
  page_size?: number;
}

export interface CreateMatchPayload {
  name: string;
  publication_mode: PublicationMode;
  /** 散人约球（online_pickup）不传；其余模式必填。 */
  host_team_id?: number;
  opponent_name?: string | null;
  players_per_team: number;
  host_capacity_limit?: number | null;
  start_time: string;
  end_time: string;
  registration_start_at: string | null;
  registration_end_at: string | null;
  location: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
  description?: string | null;
  is_free?: boolean;
  host_color?: string | null;
  away_color?: string | null;
}

export interface UpdateMatchPayload {
  name: string;
  start_time: string;
  end_time: string;
  registration_start_at: string | null;
  registration_end_at: string | null;
  location: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
  description?: string | null;
  // 手工对手名称；null 表示本次编辑不修改。
  opponent_name?: string | null;
  // 主队报名组满员上限；null 表示本次编辑不修改容量。
  host_capacity_limit?: number | null;
  // 球服颜色（#RRGGBB 小写）；null 表示本次编辑不修改。
  host_color?: string | null;
  away_color?: string | null;
}
