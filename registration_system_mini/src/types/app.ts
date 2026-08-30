export type AppUserStatus = "active" | "frozen";

export interface AppUser {
  id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  phone_number: string | null;
  status: AppUserStatus;
  /** 比赛管理员（管理端设置）：可在比赛详情页录入比赛比分。 */
  is_match_admin?: boolean;
}

export interface LoginResponse {
  token: string;
  user: AppUser;
}

export interface WebViewCodeResponse {
  code: string;
  expires_at: string;
}

export interface WebViewExchangeResponse {
  token: string;
}

export type MyTeamRole = "captain" | "leader" | "vice_captain" | "member";

export interface MyTeam {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  role: MyTeamRole;
  joined_at: string;
}

export interface AppTeamDetail {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  captain_id: number | null;
  status: string;
  my_role: MyTeamRole;
}

export interface AppTeamMember {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
  real_name: string | null;
  role: MyTeamRole;
  status: string;
  joined_at: string;
}

export interface TestLoginUser {
  id: number;
  display_name: string;
  avatar_url: string | null;
  teams: Array<{ id: number; name: string; role: MyTeamRole }>;
}

export interface TestLoginUsersResponse {
  items: TestLoginUser[];
  default_user_id: number;
}
