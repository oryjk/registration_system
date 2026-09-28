/** 管理端的微信用户条目（后端不暴露 openid）。 */
export interface WeChatUser {
  id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  phone_number: string | null;
  status: "active" | "frozen";
  is_match_admin: boolean;
  last_active_at: string | null;
  created_at: string;
}

export interface WeChatUserListPage {
  items: WeChatUser[];
  total: number;
  page: number;
  page_size: number;
}

export type WeChatUserActivity = "all" | "active_7d" | "inactive_30d" | "never";

export interface WeChatUserListQuery {
  search?: string;
  match_admin_only?: boolean;
  activity?: WeChatUserActivity;
  page?: number;
  page_size?: number;
}
