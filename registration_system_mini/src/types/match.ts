export type AppMatchStatus = "registering" | "ongoing" | "ended" | "cancelled";
export type AppMatchUiPhase = "upcoming" | "ongoing" | "ended" | "excluded";
export type AppMatchRegistrationStatus = "unknown" | "attending" | "leave" | "absent" | "cancelled";
export type AppMatchPublicationMode = "offline_confirmed" | "online_team" | "online_individual" | "online_pickup";
export type AppMatchPaymentMode = "postpaid" | "prepaid";

/** 主队队长资料：详情接口返回，供「联系队长」留言入口使用。 */
export interface AppMatchCaptain {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
}

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
  participants?: AppMatchParticipant[];
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
  /** 最终比分；null 表示尚未录入。 */
  host_score?: number | null;
  away_score?: number | null;
  participants?: AppMatchParticipant[];
}

export interface AppMatchRegistrationGroupSummary {
  kind: AppHomeMatchGroup["kind"];
  team_id: number | null;
  min_players: number | null;
  max_players: number | null;
  attending_count: number;
}

export interface AppMatchSummary extends AppMatchPhaseSource {
  name: string;
  publication_mode: AppMatchPublicationMode;
  opponent_state: "no_recruitment" | "recruiting" | "confirmed";
  /** 散人约球（online_pickup）没有主队。 */
  host_team_id: number | null;
  host_team_name: string;
  away_team_id: number | null;
  away_team_name: string | null;
  opponent_name: string | null;
  /** 发布者用户 ID：散人约球无主队，用它判定「我创建的比赛」以显示取消入口。 */
  created_by_user_id?: number | null;
  players_per_team: number;
  /** 主队比分；null 表示尚未录入（比赛管理员/管理端录入）。 */
  host_score?: number | null;
  /** 客队比分；null 表示尚未录入。 */
  away_score?: number | null;
  registration_start_at: string | null;
  registration_end_at: string | null;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  description: string | null;
  is_free?: boolean;
  payment_mode?: AppMatchPaymentMode;
  fee_per_person_cents?: number;
  host_color?: string | null;
  away_color?: string | null;
  registration_groups?: AppMatchRegistrationGroupSummary[];
  /** 主队队长资料（详情接口填充；无主队或未设队长为 null）。 */
  host_captain?: AppMatchCaptain | null;
  created_at: string;
  updated_at: string;
}

export interface AppMatchRegistration {
  status: AppMatchRegistrationStatus;
  registration_count: number;
  /** 报名费是否已支付（赛前支付订单核销后为 true）。 */
  paid?: boolean;
}

export interface AppMatchParticipant {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  status: AppMatchRegistrationStatus;
  /** 该成员报名占用的人数；散人约球一人代多人时大于 1，其余恒为 1。 */
  registration_count?: number;
  /** 本次报名的落库时间；后端旧数据缺失时为 null，排序需回退。 */
  registered_at?: string | null;
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

export type AppTeamApplicationStatus = "pending" | "selected" | "rejected" | "withdrawn";

export interface AppTeamApplication {
  id: string;
  match_id: string;
  applicant_team_id: number;
  applicant_team_name?: string;
  introduction: string;
  status: AppTeamApplicationStatus;
  created_by_user_id: number;
  selected_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
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
