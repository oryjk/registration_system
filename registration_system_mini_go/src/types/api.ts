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
