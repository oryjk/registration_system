export interface BackendApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
}

export interface BackendUser {
  id: number;
  open_id: string;
  username: string;
  nickname: string;
  real_name: string;
  avatar_url: string;
  phone_number: string;
  is_manager: boolean;
}

export interface BackendUserLoginResponse {
  access_token: string;
  token_type: string;
  user: BackendUser;
}

export interface BackendAvatarUploadResult {
  avatar_url: string;
}

export interface BackendTeamLogoUploadResult {
  logo_url: string;
}

export interface BackendWxLoginResponse {
  openid: string;
  session_key?: string | null;
  unionid?: string | null;
}

export interface BackendWxPhoneNumberResponse {
  phone_number: string;
}

export interface BackendWxMiniPaymentParams {
  time_stamp: string;
  nonce_str: string;
  package: string;
  sign_type: string;
  pay_sign: string;
}

export type BackendPaymentOrderType = "recharge" | "activity" | "team_membership";
export type BackendPaymentOrderState = "unpaid" | "paid" | "cancelled" | "refunded";

export interface BackendPaymentOrder {
  order_no: string;
  user_id: number;
  amount: string;
  order_type: BackendPaymentOrderType;
  status: BackendPaymentOrderState;
  prepay_id?: string | null;
  transaction_id?: string | null;
  description?: string | null;
}

export interface BackendPaymentOrderResult {
  order_no: string;
  params: BackendWxMiniPaymentParams;
}

export interface BackendPaymentOrderStatus {
  status?: BackendPaymentOrderState | null;
  order?: BackendPaymentOrder | null;
}

export interface BackendSyncOrderStatusResult {
  paid: boolean;
  status: string;
  trade_state?: string | null;
  transaction_id?: string | null;
}

export interface BackendCancelOrderResult {
  success: boolean;
  message: string;
}

export type BackendChallengeStatus = "open" | "matched" | "cancelled";
export type BackendChallengeKind = "team" | "individual";

export interface BackendChallenge {
  id: string;
  title: string;
  kind: BackendChallengeKind;
  host_team_id: string;
  host_user_id: number;
  guest_team_id?: string | null;
  accepted_by_user_id?: number | null;
  activity_id?: string | null;
  holding_date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
  players_per_team: number;
  fee_per_person?: string | null;
  note?: string | null;
  status: BackendChallengeStatus;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendChallengeSummary {
  challenge: BackendChallenge;
  host_team_name: string;
  host_team_credit_score: number;
  host_team_trust_label: string;
  guest_team_name?: string | null;
  guest_team_credit_score?: number | null;
  guest_team_trust_label?: string | null;
  current_team_relation?: string | null;
  accepted_count: number;
  current_user_joined: boolean;
  can_accept: boolean;
}

export interface BackendChallengeActivityRef {
  id: string;
  name: string;
  holding_date: string;
  start_time: string;
  end_time: string;
  location: string;
  home_team_id?: string | null;
  away_team_id?: string | null;
  players_per_team?: number | null;
}

export interface BackendChallengeDetail {
  summary: BackendChallengeSummary;
  activity?: BackendChallengeActivityRef | null;
}

export interface BackendNotification {
  id: string;
  user_id: number;
  kind: string;
  title: string;
  content: string;
  related_type?: string | null;
  related_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface BackendNotificationUnreadCountResult {
  unread_count: number;
}

export interface BackendNotificationMarkAllReadResult {
  affected: number;
}

export interface BackendTeam {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  captain_id?: number | null;
  status: number;
  credit_score: number;
  vip_until?: string | null;
  trust_label: string;
  is_vip: boolean;
}

export interface BackendTeamSummary extends BackendTeam {
  member_count: number;
}

export interface BackendTeamPasswordInfo {
  team_id: string;
  requires_password: boolean;
}

export interface BackendTeamMember {
  user_id: number;
  role: string;
  jersey_number?: string | null;
  joined_at: string;
  status: number;
}

export interface BackendTeamDetail {
  team: BackendTeam;
  members: BackendTeamMember[];
}

export interface BackendTeamMemberAttendanceRecord {
  activity_id: string;
  activity_name: string;
  holding_date: string;
  location: string;
  stand: number;
  registration_count: number;
  operation_time?: string | null;
  registered: boolean;
}

export interface BackendTeamMemberAttendance {
  records: BackendTeamMemberAttendanceRecord[];
}

export interface BackendTeamCreditOverview {
  team: BackendTeam;
  trust_label: string;
  is_vip: boolean;
}

export interface BackendTeamCreditTransaction {
  id: number;
  team_id: string;
  activity_id?: string | null;
  transaction_type: string;
  delta: number;
  score_before: number;
  score_after: number;
  rating?: number | null;
  amount?: string | null;
  membership_months?: number | null;
  note?: string | null;
  reviewer_team_id?: string | null;
  created_by_user_id?: number | null;
  created_by_admin_id?: number | null;
  created_at: string;
}

export interface BackendActivity {
  id: string;
  name: string;
  location: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
  status: number;
  holding_date: string;
  start_time: string;
  end_time: string;
  opposing?: string | null;
  cover?: string | null;
  description?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  color?: string | null;
  opposing_color?: string | null;
  players_per_team?: number | null;
  match_kind?: "external" | "internal" | null;
  source_activity_id?: string | null;
  team_registration_count?: number | null;
  team_checkin_configs: BackendActivityTeamCheckInConfig[];
}

export interface BackendCreateActivityCheckInConfig {
  team_id: string;
  enabled: boolean;
  radius_meters: number;
  open_minutes_before: number;
  close_minutes_after: number;
}

export interface BackendActivityListPage {
  items: BackendActivity[];
  total: number;
  page: number;
  page_size: number;
  counts: {
    total: number;
    registering: number;
    ongoing: number;
    ended: number;
    cancelled: number;
  };
}

export interface BackendUserActivityRecord {
  activity_id: string;
  user_id: number;
  stand: number;
  registration_count: number;
  operation_time: string;
}

export interface BackendUserAttendanceRecord {
  activity_id: string;
  activity_name: string;
  holding_date: string;
  location: string;
  stand: number;
  registration_count: number;
  operation_time: string;
}

export interface BackendAttendanceRankingItem {
  user_id: number;
  user_name: string;
  avatar_url?: string | null;
  attended_count: number;
}

export interface BackendRegistration {
  user_id: number;
  stand: number;
  registration_count: number;
  paid: number;
  operation_time: string;
  checked_in_at?: string | null;
  checkin_distance_meters?: number | null;
}

export interface BackendActivityTeamCheckInConfig {
  team_id: string;
  enabled: boolean;
  radius_meters: number;
  open_minutes_before: number;
  close_minutes_after: number;
  checkin_open_at: string;
  checkin_close_at: string;
  updated_by_user_id?: number | null;
  updated_at: string;
}

export interface BackendActivityCheckInRecord {
  activity_id: string;
  team_id: string;
  user_id: number;
  distance_meters: number;
  checked_in_at: string;
}

export interface BackendOngoingActivityResult {
  has_ongoing: boolean;
  activity?: BackendActivity | null;
}

export interface BackendLocationSearchResult {
  provider_place_id: string;
  title: string;
  address: string;
  display_name: string;
  latitude: string;
  longitude: string;
}

export type BackendMapProvider = "tencent" | "amap";

export interface BackendMapPreviewSettings {
  selected_provider: BackendMapProvider;
  tencent_map_key: string;
}

export interface BackendMiniAppRuntimeConfig {
  home: {
    match_card_limit: number;
    challenge_card_limit: number;
    activity_fetch_page_size: number;
    hide_matches_after_holding_time: boolean;
  };
  matches: {
    related_activity_limit: number;
    participant_avatar_limit: number;
    capacity_extra_slots: number;
  };
  checkin: {
    default_radius_meters: number;
    default_open_minutes_before: number;
    default_close_minutes_after: number;
  };
  billing: {
    recent_order_limit: number;
  };
  notifications: {
    list_limit: number;
  };
}

export interface BackendUserAccount {
  user_id: number;
  balance: string;
  total_recharge: string;
  total_expense: string;
  total_penalty: string;
}

export interface BackendBillingFlowRecord {
  id: string;
  record_type: string;
  type_name: string;
  amount: string;
  description: string;
  activity_id?: string | null;
  created_at: string;
  balance: string;
}

export interface BackendBillingFlowResult {
  records: BackendBillingFlowRecord[];
  final_balance: string;
}
