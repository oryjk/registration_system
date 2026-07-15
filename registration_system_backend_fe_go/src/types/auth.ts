export type AdminRole = "admin" | "super_admin";
export type AdminStatus = "active" | "frozen";

export interface AdminUser {
  id: number;
  username: string;
  role: AdminRole;
  status: AdminStatus;
  is_super_admin: boolean;
}

export interface AdminLoginResult {
  access_token: string;
  token_type: "Bearer";
  admin: AdminUser;
}
