export interface BackendApiResponse<T> {
  code: number;
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
  is_venue: boolean;
}

export interface BackendUserLoginResponse {
  access_token: string;
  token_type: string;
  user: BackendUser;
}

export interface BackendAvatarUploadResult {
  avatar_url: string;
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

export type BackendPaymentOrderKind = "recharge" | "team_membership" | "match_registration" | "tip";

export interface BackendPaymentOrder {
  order_no: string;
  user_id: number;
  amount_cents: number;
  provider: string;
  channel: string;
  kind: BackendPaymentOrderKind | string;
  team_id?: number | null;
  match_id?: string | null;
  months?: number | null;
  status: string;
  prepay_id?: string;
  transaction_id?: string;
  paid_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Go 后端统一下单响应：订单 + 微信 JSAPI 支付参数（H5 场景使用，可能为 null）。 */
export interface BackendPaymentOrderResult {
  order: BackendPaymentOrder;
  payment: Record<string, unknown> | null;
}

export interface BackendPaymentOrderListResult {
  items: BackendPaymentOrder[];
  total: number;
  page: number;
  page_size: number;
}

export interface BackendSyncOrderStatusResult {
  order: BackendPaymentOrder;
}

export type BackendChallengeStatus = "open" | "matched" | "cancelled";
export type BackendChallengeKind = "team" | "individual";
export type BackendChallengePaymentMode = "prepaid" | "postpaid";
export type BackendChallengePaymentStatus = "unpaid" | "paid" | "cancelled";

export interface BackendChallenge {
  id: string;
  title: string;
  kind: BackendChallengeKind;
  payment_mode: BackendChallengePaymentMode;
  host_team_id?: number | null;
  host_user_id: number;
  guest_team_id?: number | null;
  accepted_by_user_id?: number | null;
  activity_id?: string | null;
  holding_date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
  players_per_team: number;
  min_players?: number | null;
  max_players?: number | null;
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
  home_team_id?: number | null;
  away_team_id?: number | null;
  players_per_team?: number | null;
}

export interface BackendChallengeIndividualParticipant {
  user_id: number;
  display_name: string;
  avatar_url?: string | null;
}

export interface BackendCurrentUserIndividualAcceptance {
  payment_status: BackendChallengePaymentStatus;
  payment_deadline_at?: string | null;
  payment_order_no?: string | null;
}

export interface BackendChallengeDetail {
  summary: BackendChallengeSummary;
  activity?: BackendChallengeActivityRef | null;
  individual_participants: BackendChallengeIndividualParticipant[];
  current_user_acceptance?: BackendCurrentUserIndividualAcceptance | null;
}

export interface BackendNotification {
  id: number;
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
  id: number;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  captain_id?: number | null;
  status: number;
  credit_score: number;
  vip_until?: string | null;
  trust_label: string;
  is_vip: boolean;
  member_count?: number;
  my_role?: string;
  joined_at?: string;
}

export interface BackendTeamSummary extends BackendTeam {
  member_count: number;
}

export interface BackendTeamPasswordInfo {
  team_id: number;
  requires_password: boolean;
}

export interface BackendTeamMember {
  user_id: number;
  role: string;
  jersey_number?: string | null;
  is_member: boolean;
  joined_at: string;
  status: number;
  /** 用户资料：新接口的队员列表自带；legacy 结构可能缺失，展示层需兜底。 */
  nickname?: string;
  avatar_url?: string | null;
  real_name?: string | null;
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

export interface BackendTeamAttendanceRankingItem {
  user_id: number;
  user_name: string;
  avatar_url?: string | null;
  total_count: number;
  attended_count: number;
  leave_count: number;
  late_count: number;
  unregistered_count: number;
}

export interface BackendTeamMatchAttendanceMember {
  user_id: number;
  nickname: string;
  avatar_url?: string | null;
  stand: number;
  registration_count: number;
  operation_time?: string | null;
  registered: boolean;
}

export interface BackendTeamMatchAttendance {
  match: {
    activity_id: string;
    activity_name: string;
    holding_date: string;
    location: string;
  };
  records: BackendTeamMatchAttendanceMember[];
}

export interface BackendTeamAttendanceSummary {
  my_records: BackendTeamMemberAttendanceRecord[];
  ranking: BackendTeamAttendanceRankingItem[];
}

export interface BackendTeamCreditOverview {
  team: BackendTeam;
  trust_label: string;
  is_vip: boolean;
}

export interface BackendTeamCreditTransaction {
  id: number;
  team_id: number;
  activity_id?: string | null;
  transaction_type: string;
  delta: number;
  score_before: number;
  score_after: number;
  rating?: number | null;
  amount?: string | null;
  membership_months?: number | null;
  note?: string | null;
  reviewer_team_id?: number | null;
  created_by_user_id?: number | null;
  created_by_admin_id?: number | null;
  created_at: string;
}

export interface BackendMiniReviewStatus {
  project_code: string;
  version: string;
  is_reviewing: boolean;
  status_text: string;
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
  /** 报名窗口；Go 接口返回，legacy 活动无此字段。 */
  registration_start_at?: string | null;
  registration_end_at?: string | null;
  opposing?: string | null;
  cover?: string | null;
  description?: string | null;
  home_team_id?: number | null;
  away_team_id?: number | null;
  color?: string | null;
  opposing_color?: string | null;
  players_per_team?: number | null;
  team_capacity_limit?: number | null;
  match_kind?: "external" | "internal" | null;
  source_activity_id?: string | null;
  team_registration_count?: number | null;
  team_checkin_configs: BackendActivityTeamCheckInConfig[];
}

export interface BackendCreateActivityCheckInConfig {
  team_id: number;
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
  team_id: number;
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
  team_id: number;
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

export interface BackendMiniAppHomeHeroBanner {
  title: string;
  subtitle: string;
  button_text: string;
  image_url: string;
  enabled: boolean;
  sort_order: number;
}

export interface BackendMiniAppRuntimeConfig {
  home: {
    match_card_limit: number;
    challenge_card_limit: number;
    activity_fetch_page_size: number;
    hide_matches_after_holding_time: boolean;
    hero_banners: BackendMiniAppHomeHeroBanner[];
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
  profile: {
    require_phone_binding: boolean;
  };
  debug: {
    clear_profile_enabled: boolean;
    review_status_toggle_enabled: boolean;
  };
}

/** 队费记账：我在各球队的队费余额。 */
export interface BackendTeamFundBalance {
  team_id: number;
  team_name: string;
  balance_cents: number;
}

/** 队费记账：带符号流水，正=入账（充值/冲正回加），负=扣费。 */
export interface BackendTeamFundTransaction {
  id: number;
  team_id: number;
  team_name: string;
  amount_cents: number;
  balance_after_cents: number;
  source: "membership_payment" | "match_settlement" | "settlement_reversal" | "admin_credit" | string;
  match_id?: string | null;
  match_name?: string | null;
  description: string;
  created_at: string;
}

export interface BackendMatchSettlementItem {
  user_id: number;
  user_name: string;
  team_id: number;
  amount_cents: number;
  balance_after_cents: number;
}

export interface BackendMatchSettlementBatch {
  batch_no: number;
  operation_type: "settle" | "reverse" | string;
  description: string;
  total_amount_cents: number;
  user_count: number;
  created_at: string;
}

/** 比赛结算摘要；未结算时 items 为可扣名单预填（amount_cents=人均费）。 */
export interface BackendMatchSettlementSummary {
  settled: boolean;
  batch_no: number;
  settled_at?: string | null;
  description: string;
  total_amount_cents: number;
  items: BackendMatchSettlementItem[];
  history: BackendMatchSettlementBatch[];
}

/** 结算提交响应：含冲正批次号（>0 表示发生了重算）。 */
export interface BackendMatchSettleResult {
  batch_no: number;
  reversed_batch_no: number;
  description: string;
  total_amount_cents: number;
  items: BackendMatchSettlementItem[];
}
